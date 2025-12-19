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

interface AnalogTodosSettings {
	todayFolder: string;
}

const DEFAULT_SETTINGS: AnalogTodosSettings = {
	todayFolder: "Analog",
};

export default class AnalogTodosPlugin extends Plugin {
	settings: AnalogTodosSettings;

	async onload() {
		await this.loadSettings();

		// Tri-state checkboxes for files in the configured folder: [ ] → [/] → [x] → [ ]
		// Uses document-level event delegation (capture phase) to intercept before Obsidian
		const triStateHandler = createTriStateHandler(this.app, () => this.settings.todayFolder);
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

		this.addSettingTab(new AnalogTodosSettingTab(this.app, this));
	}

	onunload() {}

	async createOrOpenToday() {
		try {
			const today = getTodayDate();
			const fileName = formatTodayFileName(today);
			const folderPath = this.settings.todayFolder;
			const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

			// 1. Check if today's file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existingFile as TFile);
				return;
			}

			// 2. Find previous unclosed Today page and extract incomplete tasks
			const previousToday = await this.findMostRecentUnclosedToday(today);
			let carriedTasks: ReturnType<typeof filterIncomplete> = [];

			if (previousToday) {
				const content = await this.app.vault.read(previousToday);
				const allTasks = parseTasks(content);
				carriedTasks = filterIncomplete(allTasks);
				await this.markAsEnded(previousToday, today);
				await this.archiveFile(previousToday);
			}

			// 3. Create folder if it doesn't exist
			if (folderPath) {
				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (!folder) {
					await this.app.vault.createFolder(folderPath);
				}
			}

			// 4. Create new Today page (with carried tasks or default template)
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
				new Notice(`Started new day • ${taskCount} task${taskCount > 1 ? "s" : ""} carried over`);
			} else {
				new Notice(`Started new day`);
			}
		} catch (error) {
			console.error("Analog Todos: Error creating Today page", error);
			new Notice("Error creating Today page. Check console for details.");
		}
	}

	async findMostRecentUnclosedToday(beforeDate: string): Promise<TFile | null> {
		try {
			const folderPath = this.settings.todayFolder;
			const files = this.app.vault.getMarkdownFiles();

			// Filter files in the correct folder (not in Archive subfolder)
			const folderFiles = files.filter((file) => {
				if (folderPath) {
					return file.path.startsWith(`${folderPath}/`) && 
						!file.path.startsWith(`${folderPath}/Archive/`);
				}
				return !file.path.includes("/");
			});

			// Find unclosed Today pages by frontmatter (has started, no ended, started < today)
			let mostRecent: TFile | null = null;
			let mostRecentDate = "";

			for (const file of folderFiles) {
				const cache = this.app.metadataCache.getFileCache(file);
				const frontmatter = cache?.frontmatter;

				// Identify Today files by frontmatter, not filename
				if (!frontmatter?.started) continue;
				if (frontmatter.ended) continue;

				// Validate date format (YYYY-MM-DD)
				if (!isValidDateFormat(frontmatter.started)) continue;

				if (frontmatter.started >= beforeDate) continue;

				// Track most recent
				if (frontmatter.started > mostRecentDate) {
					mostRecentDate = frontmatter.started;
					mostRecent = file;
				}
			}

			return mostRecent;
		} catch (error) {
			console.error("Analog Todos: Error finding unclosed Today pages", error);
			return null;
		}
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
			console.error(`Analog Todos: Error marking ${file.name} as ended`, error);
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
			console.error(`Analog Todos: Error archiving ${file.name}`, error);
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

class AnalogTodosSettingTab extends PluginSettingTab {
	plugin: AnalogTodosPlugin;

	constructor(app: App, plugin: AnalogTodosPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Analog Todos Settings" });

		new Setting(containerEl)
			.setName("Today folder")
			.setDesc(
				"Folder where Today pages will be created (leave empty for vault root)",
			)
			.addText((text) =>
				text
					.setPlaceholder("Example: Analog")
					.setValue(this.plugin.settings.todayFolder)
					.onChange(async (value) => {
						this.plugin.settings.todayFolder = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
