import {
	type App,
	type EditorPosition,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	type TFile,
} from "obsidian";

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

		// Register checkbox click handler for 3-state cycling
		// Use capture phase to intercept before Obsidian's handlers
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			console.log("Click detected:", target);
			if (target.matches("input.task-list-item-checkbox[data-task]")) {
				console.log("Checkbox matched, handling click");
				this.handleCheckboxClick(evt, target as HTMLInputElement);
			}
		}, { capture: true });
	}

	onunload() {}

	handleCheckboxClick(evt: MouseEvent, checkbox: HTMLInputElement) {
		const currentTask = checkbox.getAttribute("data-task");
		console.log("Current task:", currentTask);
		
		// Cycle: ' ' -> '/' -> 'x' -> ' '
		let nextTask = " ";
		if (currentTask === " ") nextTask = "/";
		else if (currentTask === "/") nextTask = "x";
		else if (currentTask === "x") nextTask = " ";
		else {
			console.log("Unknown task type, returning");
			return; // Unknown task type, let default behavior happen
		}
		
		console.log("Next task:", nextTask);

		// Prevent default toggle - stop all propagation
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		// Find the line in the editor and update it
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		console.log("View:", view, "Mode:", view?.getMode());
		if (!view || view.getMode() !== "source") {
			console.log("Not in source mode");
			return;
		}

		const editor = view.editor;
		
		// Get the text content of the task (sibling text node or span)
		const lineElement = checkbox.closest(".cm-line");
		if (!lineElement) {
			console.log("No .cm-line element found");
			return;
		}
		
		// Get the task text (content after the checkbox)
		const taskText = lineElement.textContent?.trim() || "";
		console.log("Task text from DOM:", taskText);
		
		// Search through editor lines to find matching content
		const lineCount = editor.lineCount();
		const taskRegex = /^(\s*- \[)(.)\](\s*)(.*)/;
		
		let found = false;
		for (let i = 0; i < lineCount; i++) {
			const editorLine = editor.getLine(i);
			const match = editorLine.match(taskRegex);
			
			// Match both the task type and the task text content
			if (match && match[2] === currentTask && match[4].trim() === taskText) {
				console.log("Found matching line at", i, ":", editorLine);
				const newLine = editorLine.replace(taskRegex, `$1${nextTask}]$3$4`);
				console.log("Setting new line:", newLine);
				editor.setLine(i, newLine);
				
				// Force a refresh to ensure DOM updates
				editor.refresh();
				
				found = true;
				return;
			}
		}
		
		if (!found) {
			console.log("No matching line found. Searched", lineCount, "lines");
		}
	}

	async createOrOpenToday() {
		try {
			const today = window.moment().format("YYYY-MM-DD");
			const fileName = `Today ${today}.md`;
			const folderPath = this.settings.todayFolder;
			const filePath = folderPath ? `${folderPath}/${fileName}` : fileName;

			// 1. Check if today's file already exists
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile) {
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(existingFile as TFile);
				return;
			}

			// 2. Find and close the most recent unclosed Today page
			const previousToday = await this.findMostRecentUnclosedToday(today);
			if (previousToday) {
				await this.markAsEnded(previousToday, today);
			}

			// 3. Create folder if it doesn't exist
			if (folderPath) {
				const folder = this.app.vault.getAbstractFileByPath(folderPath);
				if (!folder) {
					await this.app.vault.createFolder(folderPath);
				}
			}

			// 4. Create new Today page with started date
			const template = `---
started: ${today}
---

## Priority Tasks
- [ ] 
- [ ] 
- [ ] 

## In Progress
- [/] 

## Notes

`;

			const file = await this.app.vault.create(filePath, template);
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);

			if (previousToday) {
				new Notice(`Started new day • Previous day closed`);
			} else {
				new Notice(`Started new day`);
			}
		} catch (error) {
			console.error("Analog Todos: Error creating Today page", error);
			new Notice("Error creating Today page. Check console for details.");
		}
	}

	async findMostRecentUnclosedToday(
		beforeDate: string,
	): Promise<TFile | null> {
		try {
			const folderPath = this.settings.todayFolder;
			const files = this.app.vault.getMarkdownFiles();

			// Filter files that match Today pattern and are in the correct folder
			const todayPattern = /^Today \d{4}-\d{2}-\d{2}\.md$/;
			const todayFiles = files.filter((file) => {
				const inCorrectFolder = folderPath
					? file.path.startsWith(`${folderPath}/`)
					: !file.path.contains("/");
				const matchesPattern = todayPattern.test(file.name);
				return inCorrectFolder && matchesPattern;
			});

			// Find unclosed Today pages (has started, no ended, and started < today)
			let mostRecent: TFile | null = null;
			let mostRecentDate = "";

			for (const file of todayFiles) {
				const cache = this.app.metadataCache.getFileCache(file);
				const frontmatter = cache?.frontmatter;

				// Defensive: only consider files with proper frontmatter structure
				if (!frontmatter?.started) continue;
				if (frontmatter.ended) continue;
				
				// Validate date format (YYYY-MM-DD)
				const datePattern = /^\d{4}-\d{2}-\d{2}$/;
				if (!datePattern.test(frontmatter.started)) continue;
				
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
			console.error(
				`Analog Todos: Error marking ${file.name} as ended`,
				error,
			);
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
