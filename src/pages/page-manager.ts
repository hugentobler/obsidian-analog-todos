/**
 * Page manager - handles lifecycle for all page types
 */

import { type App, MarkdownView, Notice, type TFile } from "obsidian";
import type { RollSettings } from "../settings";
import { getTodayDate } from "../utils/dates";
import { formatArchivedFileName } from "../utils/filenames";
import { filterIncompleteSections, parseSections } from "../utils/tasks";
import { buildPageTemplate } from "./templates";
import { PAGE_CONFIG, type PageType } from "./types";

export interface PageInfo {
	file: TFile;
	started?: string;
	ended?: string;
}

export class PageManager {
	constructor(
		private app: App,
		private getSettings: () => RollSettings,
	) {}

	/**
	 * Get the path to a page file
	 */
	getFilePath(pageType: PageType): string {
		const folderPath = this.getSettings().rollFolder;
		const filename = PAGE_CONFIG[pageType].filename;
		return folderPath ? `${folderPath}/${filename}` : filename;
	}

	/**
	 * Get the existing page file and its frontmatter, or null if it doesn't exist
	 */
	getFile(pageType: PageType): PageInfo | null {
		const filePath = this.getFilePath(pageType);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (
			!(
				file instanceof Object &&
				"extension" in file &&
				file.extension === "md"
			)
		) {
			return null;
		}
		const tFile = file as TFile;
		const cache = this.app.metadataCache.getFileCache(tFile);
		const frontmatter = cache?.frontmatter;
		return {
			file: tFile,
			started: frontmatter?.started,
			ended: frontmatter?.ended,
		};
	}

	/**
	 * Detect page type from file path
	 */
	detectPageType(filePath: string): PageType | null {
		for (const [pageType, config] of Object.entries(PAGE_CONFIG)) {
			if (filePath.endsWith(config.filename)) {
				return pageType as PageType;
			}
		}
		return null;
	}

	/**
	 * Open a page, creating it if it doesn't exist
	 */
	async open(pageType: PageType): Promise<void> {
		const displayName = PAGE_CONFIG[pageType].displayName;

		try {
			const page = this.getFile(pageType);

			if (page) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(page.file);
				const dateDisplay = page.started ?? "unknown start date";
				new Notice(`Opened ${displayName} page from ${dateDisplay}`);
				return;
			}

			// Create new page
			await this.create(pageType);
		} catch (error) {
			console.error(`Roll: Error opening ${displayName} page`, error);
			new Notice(
				`Error opening ${displayName} page. Check console for details.`,
			);
		}
	}

	/**
	 * Rollover: archive current page and create a new one with rolled over tasks
	 */
	async rollover(pageType: PageType): Promise<void> {
		const displayName = PAGE_CONFIG[pageType].displayName;

		try {
			const page = this.getFile(pageType);

			if (!page) {
				new Notice(
					`No ${displayName} page to rollover. Use 'Open ${displayName}' first.`,
				);
				return;
			}

			const today = getTodayDate();
			const folderPath = this.getSettings().rollFolder;

			// Extract incomplete sections from current page
			const content = await this.app.vault.read(page.file);
			const allSections = parseSections(content);
			const rolledSections = filterIncompleteSections(allSections);

			// 1. Create new file with temp name first (safe - doesn't touch old file)
			const tempPath = folderPath
				? `${folderPath}/${displayName}.tmp.md`
				: `${displayName}.tmp.md`;
			const template = buildPageTemplate(pageType, today, rolledSections);
			const tempFile = await this.app.vault.create(tempPath, template);

			// 2. Mark old file as ended and archive it
			await this.markAsEnded(page.file, today);
			await this.archive(pageType, page.file, page.started ?? today, today);

			// 3. Rename temp file to actual page name
			const pagePath = this.getFilePath(pageType);
			await this.app.fileManager.renameFile(tempFile, pagePath);

			// Open the new page
			const newFile = this.app.vault.getAbstractFileByPath(pagePath) as TFile;
			await this.openFileAndPositionCursor(newFile, template);

			const taskCount = rolledSections.reduce(
				(sum, s) => sum + s.tasks.length,
				0,
			);
			if (taskCount > 0) {
				new Notice(
					`Rolled over ${displayName} • ${taskCount} task${taskCount > 1 ? "s" : ""} rolled forward`,
				);
			} else {
				new Notice(`Rolled over ${displayName} • No tasks rolled forward`);
			}
		} catch (error) {
			console.error(`Roll: Error rolling over ${displayName} page`, error);
			new Notice(
				`Error rolling over ${displayName} page. Check console for details.`,
			);
		}
	}

	/**
	 * Create a new page file (for initial creation only)
	 */
	async create(pageType: PageType): Promise<void> {
		const displayName = PAGE_CONFIG[pageType].displayName;
		const folderPath = this.getSettings().rollFolder;
		const filePath = this.getFilePath(pageType);
		const today = getTodayDate();

		// Create folder if it doesn't exist
		if (folderPath) {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
			}
		}

		// Create new page
		const template = buildPageTemplate(pageType, today);
		const file = await this.app.vault.create(filePath, template);
		await this.openFileAndPositionCursor(file, template);
		new Notice(`Created new ${displayName} page`);
	}

	/**
	 * Open a file and position cursor at end
	 */
	private async openFileAndPositionCursor(
		file: TFile,
		content: string,
	): Promise<void> {
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.editor) {
			const lineCount = content.split("\n").length;
			view.editor.setCursor({ line: lineCount - 1, ch: 0 });
		}
	}

	/**
	 * Add ended date to frontmatter
	 */
	private async markAsEnded(file: TFile, endDate: string): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				if (!frontmatter.ended && frontmatter.started) {
					frontmatter.ended = endDate;
				}
			});
		} catch (error) {
			console.error(`Roll: Error marking ${file.name} as ended`, error);
		}
	}

	/**
	 * Archive file: rename with date range and move to Archive folder
	 */
	private async archive(
		pageType: PageType,
		file: TFile,
		startedDate: string,
		endedDate: string,
	): Promise<void> {
		const rollFolder = this.getSettings().rollFolder;
		const archiveFolder = this.getSettings().archiveFolder;
		const archivePath = rollFolder
			? `${rollFolder}/${archiveFolder}`
			: archiveFolder;

		// Create archive folder if it doesn't exist
		const existingArchiveFolder =
			this.app.vault.getAbstractFileByPath(archivePath);
		if (!existingArchiveFolder) {
			await this.app.vault.createFolder(archivePath);
		}

		// Find unique filename (handle same-day rollovers)
		let counter = 1;
		let archivedFileName = formatArchivedFileName(
			pageType,
			startedDate,
			endedDate,
		);
		while (
			this.app.vault.getAbstractFileByPath(`${archivePath}/${archivedFileName}`)
		) {
			counter++;
			archivedFileName = formatArchivedFileName(
				pageType,
				startedDate,
				endedDate,
				counter,
			);
		}

		// Move and rename file to archive
		const newPath = `${archivePath}/${archivedFileName}`;
		await this.app.fileManager.renameFile(file, newPath);
	}
}
