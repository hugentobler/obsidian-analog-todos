import {
	type App,
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

		// Tri-state checkbox: capture phase intercepts before Obsidian's handler
		this.registerDomEvent(
			document,
			"click",
			(evt) => this.handleCheckboxClick(evt),
			true,
		);

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

	/**
	 * Tri-state checkbox toggling: [ ] → [/] → [x] → [ ]
	 *
	 * Key implementation details:
	 * 1. Use capture phase (3rd param = true) to intercept clicks before Obsidian
	 * 2. Read state from markdown (not DOM) since DOM may be stale
	 * 3. Use CodeMirror's posAtDOM() for accurate line detection (CM virtualizes DOM)
	 * 4. Double requestAnimationFrame to sync checkbox :checked state after CM re-renders
	 */
	handleCheckboxClick(evt: MouseEvent) {
		const target = evt.target as HTMLElement;

		if (!(target instanceof HTMLInputElement)) return;
		if (target.type !== "checkbox") return;
		if (!target.classList.contains("task-list-item-checkbox")) return;

		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView?.editor) return;

		const editor = activeView.editor;
		const lineNumber = this.getLineNumberFromCheckbox(target, activeView);
		if (lineNumber === null) return;

		evt.preventDefault();
		evt.stopPropagation();

		// Read current state from markdown source (DOM data-task may be stale)
		const lineContent = editor.getLine(lineNumber);
		const taskPattern = /^(\s*- \[)([^\]])(\])/;
		const match = lineContent.match(taskPattern);
		if (!match) return;

		const currentState = match[2];
		const nextState =
			currentState === " " ? "/" : currentState === "/" ? "x" : " ";

		editor.setLine(
			lineNumber,
			lineContent.replace(taskPattern, `$1${nextState}$3`),
		);

		// Sync DOM :checked state after CodeMirror re-renders
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const checkbox = target
					.closest(".cm-line")
					?.querySelector(
						"input.task-list-item-checkbox",
					) as HTMLInputElement | null;
				if (checkbox) checkbox.checked = nextState === "x";
			});
		});
	}

	/** Map DOM element to editor line number via CodeMirror's posAtDOM */
	getLineNumberFromCheckbox(
		checkbox: HTMLElement,
		view: MarkdownView,
	): number | null {
		// @ts-expect-error - cm exists at runtime but not in type definitions
		const cm = view.editor.cm;
		if (!cm) return null;

		try {
			const pos = cm.posAtDOM(checkbox);
			return cm.state.doc.lineAt(pos).number - 1; // CM is 1-indexed, Editor is 0-indexed
		} catch {
			return null;
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

### Project name
- [ ] planned task
- [/] in-progress task
- [x] finished task
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

	async findMostRecentUnclosedToday(beforeDate: string): Promise<TFile | null> {
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
			console.error(`Analog Todos: Error marking ${file.name} as ended`, error);
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
