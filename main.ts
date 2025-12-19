import { MarkdownView, Notice, Plugin, type TFile } from "obsidian";
import { registerCommands } from "./src/commands";
import { buildNowTemplate } from "./src/now/template";
import { registerRibbonActions } from "./src/ribbon-actions";
import {
	DEFAULT_SETTINGS,
	type RollSettings,
	registerSettings,
} from "./src/settings";
import { registerCheckboxes } from "./src/checkboxes";
import { getTodayDate } from "./src/utils/dates";
import { formatNowFileName } from "./src/utils/filenames";
import { filterIncomplete, parseTasks } from "./src/utils/tasks";

export default class RollPlugin extends Plugin {
	settings: RollSettings;

	async onload() {
		await this.loadSettings();

		registerCheckboxes(this);
		registerRibbonActions(this);
		registerCommands(this);
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

			// Extract incomplete tasks from current Now
			const content = await this.app.vault.read(now.file);
			const allTasks = parseTasks(content);
			const rolledTasks = filterIncomplete(allTasks);

			// Mark as ended and archive
			await this.markAsEnded(now.file, today);
			await this.archiveFile(now.file, now.started);

			// Create new Now.md with rolled over tasks
			await this.createNowFile(rolledTasks);

			const taskCount = rolledTasks.length;
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
	 * Create a new Now.md file with optional rolled over tasks
	 */
	async createNowFile(rolledTasks: ReturnType<typeof filterIncomplete> = []) {
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
		const template = buildNowTemplate(today, rolledTasks);
		const file = await this.app.vault.create(filePath, template);
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);

		// Position cursor at end of template
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view?.editor) {
			const lineCount = template.split("\n").length;
			view.editor.setCursor({ line: lineCount - 1, ch: 0 });
		}

		if (rolledTasks.length === 0) {
			new Notice("Started new Now page");
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
	 * Archive file: rename with started date and move to Archive folder
	 */
	async archiveFile(file: TFile, startedDate?: string) {
		try {
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

			// Generate filename: "Now YYYY-MM-DD.md" or fallback to original name
			const archivedFileName = startedDate
				? formatNowFileName(startedDate)
				: file.name;

			// Move and rename file to archive
			const newPath = `${archivePath}/${archivedFileName}`;
			await this.app.fileManager.renameFile(file, newPath);
		} catch (error) {
			console.error(`Roll: Error archiving ${file.name}`, error);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
