import { MarkdownView, Notice, Plugin, type TFile } from "obsidian";
import { registerCheckboxes } from "./src/checkboxes";
import { registerCommands } from "./src/commands";
import { registerMenus } from "./src/menus";
import { buildNowTemplate } from "./src/now/template";
import { registerRibbonActions } from "./src/ribbon-actions";
import {
	DEFAULT_SETTINGS,
	type RollSettings,
	registerSettings,
} from "./src/settings";
import { getTodayDate } from "./src/utils/dates";
import { formatArchivedNowFileName } from "./src/utils/filenames";
import { filterIncompleteSections, parseSections } from "./src/utils/tasks";

export default class RollPlugin extends Plugin {
	settings: RollSettings;

	async onload() {
		await this.loadSettings();

		registerCheckboxes(this);
		registerRibbonActions(this);
		registerCommands(this);
		registerMenus(this);
		registerSettings(this);
	}

	onunload() {}

	/**
	 * Get the path to Now.md
	 */
	getNowFilePath(): string {
		const folderPath = this.settings.rollFolder;
		return folderPath ? `${folderPath}/Now.md` : "Now.md";
	}

	/**
	 * Get the existing Now.md file and its frontmatter, or null if it doesn't exist
	 */
	getNowFile(): { file: TFile; started?: string; ended?: string } | null {
		const filePath = this.getNowFilePath();
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
	 * Open Now.md, creating it if it doesn't exist
	 */
	async openNow() {
		try {
			const now = this.getNowFile();

			if (now) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(now.file);
				const dateDisplay = now.started ?? "unknown start date";
				new Notice(`Opened Now page from ${dateDisplay}`);
				return;
			}

			// Create new Now.md
			await this.createNowFile();
		} catch (error) {
			console.error("Roll: Error opening Now page", error);
			new Notice("Error opening Now page. Check console for details.");
		}
	}

	/**
	 * Rollover: archive current Now.md and create a new one with rolled over tasks
	 */
	async rolloverNow() {
		try {
			const now = this.getNowFile();

			if (!now) {
				new Notice("No Now page to rollover. Use 'Open Now' first.");
				return;
			}

			const today = getTodayDate();
			const folderPath = this.settings.rollFolder;

			// Extract incomplete sections from current Now
			const content = await this.app.vault.read(now.file);
			const allSections = parseSections(content);
			const rolledSections = filterIncompleteSections(allSections);

			// 1. Create new file with temp name first (safe - doesn't touch old file)
			const tempPath = folderPath ? `${folderPath}/Now.tmp.md` : "Now.tmp.md";
			const template = buildNowTemplate(today, rolledSections);
			const tempFile = await this.app.vault.create(tempPath, template);

			// 2. Mark old file as ended and archive it
			await this.markAsEnded(now.file, today);
			await this.archiveFile(now.file, now.started ?? today, today);

			// 3. Rename temp file to Now.md
			const nowPath = this.getNowFilePath();
			await this.app.fileManager.renameFile(tempFile, nowPath);

			// Open the new Now page
			const newFile = this.app.vault.getAbstractFileByPath(nowPath) as TFile;
			await this.openFileAndPositionCursor(newFile, template);

			const taskCount = rolledSections.reduce((sum, s) => sum + s.tasks.length, 0);
			if (taskCount > 0) {
				new Notice(
					`Rolled over • ${taskCount} task${taskCount > 1 ? "s" : ""} rolled forward`,
				);
			} else {
				new Notice("Rolled over • No tasks rolled forward");
			}
		} catch (error) {
			console.error("Roll: Error rolling over Now page", error);
			new Notice("Error rolling over Now page. Check console for details.");
		}
	}

	/**
	 * Create a new Now.md file (for initial creation only)
	 */
	async createNowFile() {
		const folderPath = this.settings.rollFolder;
		const filePath = this.getNowFilePath();
		const today = getTodayDate();

		// Create folder if it doesn't exist
		if (folderPath) {
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				await this.app.vault.createFolder(folderPath);
			}
		}

		// Create new Now page
		const template = buildNowTemplate(today);
		const file = await this.app.vault.create(filePath, template);
		await this.openFileAndPositionCursor(file, template);
		new Notice("Created new Now page");
	}

	/**
	 * Open a file and position cursor at end
	 */
	async openFileAndPositionCursor(file: TFile, content: string) {
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
	async markAsEnded(file: TFile, endDate: string) {
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
	async archiveFile(file: TFile, startedDate: string, endedDate: string) {
		const rollFolder = this.settings.rollFolder;
		const archiveFolder = this.settings.archiveFolder;
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
		let archivedFileName = formatArchivedNowFileName(startedDate, endedDate);
		while (this.app.vault.getAbstractFileByPath(`${archivePath}/${archivedFileName}`)) {
			counter++;
			archivedFileName = formatArchivedNowFileName(startedDate, endedDate, counter);
		}

		// Move and rename file to archive
		const newPath = `${archivePath}/${archivedFileName}`;
		await this.app.fileManager.renameFile(file, newPath);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
