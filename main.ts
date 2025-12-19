import {
	type App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	type TFile,
} from "obsidian";
import { buildTodayTemplate } from "./src/today/template";
import { createTriStateHandler } from "./src/ui/tri-state-handler";
import { getTodayDate, isValidDateFormat } from "./src/utils/dates";
import { formatTodayFileName } from "./src/utils/filenames";
import { filterIncomplete, parseTasks } from "./src/utils/tasks";

interface RollSettings {
	todayFolder: string;
}

const DEFAULT_SETTINGS: RollSettings = {
	todayFolder: "Roll",
};

export default class RollPlugin extends Plugin {
	settings: RollSettings;

	async onload() {
		await this.loadSettings();

		// Tri-state checkboxes for files in the configured folder: [ ] → [/] → [x] → [ ]
		// Uses document-level event delegation (capture phase) to intercept before Obsidian
		const triStateHandler = createTriStateHandler(
			this.app,
			() => this.settings.todayFolder,
		);
		this.registerDomEvent(document, "click", triStateHandler, true);

		// Ribbon icon to create/open Today page
		this.addRibbonIcon(
			"check-circle",
			"Open Today",
			async (_evt: MouseEvent) => {
				await this.createOrOpenToday();
			},
		);

		// Command to create/open Today page
		this.addCommand({
			id: "open-today",
			name: "Open Today",
			callback: async () => {
				await this.createOrOpenToday();
			},
		});

		this.addSettingTab(new RollSettingTab(this.app, this));
	}

	onunload() {}

	async createOrOpenToday() {
		try {
			const today = getTodayDate();
			const folderPath = this.settings.todayFolder;

			// 1. Find today's file and previous unclosed
			const { todayFile, previousUnclosed } = await this.findTodayFiles(today);

			if (todayFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(todayFile);
				return;
			}

			// 2. Generate path for new file
			const fileName = formatTodayFileName(today);
			const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

			// 3. Extract incomplete tasks from previous unclosed
			let carriedTasks: ReturnType<typeof filterIncomplete> = [];

			if (previousUnclosed) {
				const content = await this.app.vault.read(previousUnclosed);
				const allTasks = parseTasks(content);
				carriedTasks = filterIncomplete(allTasks);
				await this.markAsEnded(previousUnclosed, today);
				await this.archiveFile(previousUnclosed);
			}

			// 4. Create folder if it doesn't exist
			if (folderPath) {
				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (!folder) {
					await this.app.vault.createFolder(folderPath);
				}
			}

			// 5. Create new Today page (with carried tasks or default template)
			const template = buildTodayTemplate(today, carriedTasks);
			const file = await this.app.vault.create(filePath, template);
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			// Position cursor at end of template
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view?.editor) {
				const lineCount = template.split("\n").length;
				view.editor.setCursor({ line: lineCount - 1, ch: 0 });
			}

			const taskCount = carriedTasks.length;
			if (taskCount > 0) {
				new Notice(
					`Started new day • ${taskCount} task${taskCount > 1 ? "s" : ""} carried over`,
				);
			} else {
				new Notice(`Started new day`);
			}
		} catch (error) {
			console.error("Roll: Error creating Today page", error);
			new Notice("Error creating Today page. Check console for details.");
		}
	}

	/**
	 * Find Today files in one pass:
	 * - todayFile: file with started === today
	 * - previousUnclosed: most recent file with started < today and no ended
	 */
	async findTodayFiles(today: string): Promise<{
		todayFile: TFile | null;
		previousUnclosed: TFile | null;
	}> {
		const folderPath = this.settings.todayFolder;
		const files = this.app.vault.getMarkdownFiles();

		// Filter files in the correct folder (not in Archive subfolder)
		const folderFiles = files.filter((file) => {
			if (folderPath) {
				return (
					file.path.startsWith(`${folderPath}/`) &&
					!file.path.startsWith(`${folderPath}/Archive/`)
				);
			}
			return !file.path.includes("/");
		});

		let todayFile: TFile | null = null;
		let previousUnclosed: TFile | null = null;
		let previousUnclosedDate = "";

		for (const file of folderFiles) {
			const cache = this.app.metadataCache.getFileCache(file);
			const frontmatter = cache?.frontmatter;

			if (!frontmatter?.started) continue;
			if (!isValidDateFormat(frontmatter.started)) continue;

			// Check for today's file
			if (frontmatter.started === today) {
				todayFile = file;
				continue;
			}

			// Check for previous unclosed (started < today, no ended)
			if (!frontmatter.ended && frontmatter.started < today) {
				if (frontmatter.started > previousUnclosedDate) {
					previousUnclosedDate = frontmatter.started;
					previousUnclosed = file;
				}
			}
		}

		return { todayFile, previousUnclosed };
	}

	async markAsEnded(file: TFile, endDate: string) {
		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Defensive: only add ended if it doesn't already exist
				// and the frontmatter has a valid started date
				if (!frontmatter.ended && frontmatter.started) {
					frontmatter.ended = endDate;
				}
			});
		} catch (error) {
			console.error(`Roll: Error marking ${file.name} as ended`, error);
			// Don't throw - just log and continue
		}
	}

	async archiveFile(file: TFile) {
		try {
			const folderPath = this.settings.todayFolder;
			const archivePath = folderPath ? `${folderPath}/Archive` : "Archive";

			// Create archives folder if it doesn't exist
			const archiveFolder = this.app.vault.getAbstractFileByPath(archivePath);
			if (!archiveFolder) {
				await this.app.vault.createFolder(archivePath);
			}

			// Move file to archives
			const newPath = `${archivePath}/${file.name}`;
			await this.app.fileManager.renameFile(file, newPath);
		} catch (error) {
			console.error(`Roll: Error archiving ${file.name}`, error);
			// Don't throw - just log and continue
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class RollSettingTab extends PluginSettingTab {
	plugin: RollPlugin;

	constructor(app: App, plugin: RollPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Roll" });

		new Setting(containerEl)
			.setName("Today folder")
			.setDesc(
				"Folder where Today pages will be created (leave empty for vault root)",
			)
			.addText((text) =>
				text
					.setPlaceholder("Example: Roll")
					.setValue(this.plugin.settings.todayFolder)
					.onChange(async (value) => {
						this.plugin.settings.todayFolder = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
