import { Plugin } from "obsidian";
import { registerCheckboxes } from "./src/checkboxes";
import { registerCodeBlocks } from "./src/code-blocks";
import { registerCommands } from "./src/commands";
import { registerMenus } from "./src/menus";
import { PageManager } from "./src/pages/page-manager";
import type { PageType } from "./src/pages/types";
import { registerRibbonActions } from "./src/ribbon-actions";
import {
	DEFAULT_SETTINGS,
	type RollSettings,
	registerSettings,
} from "./src/settings";

export default class RollPlugin extends Plugin {
	settings: RollSettings;
	pageManager: PageManager;

	async onload() {
		await this.loadSettings();

		this.pageManager = new PageManager(this.app, () => this.settings);

		registerCheckboxes(this);
		registerCodeBlocks(this);
		registerRibbonActions(this);
		registerCommands(this);
		registerMenus(this);
		registerSettings(this);
	}

	onunload() {}

	// Convenience methods that delegate to PageManager

	/**
	 * Get the path to a page file
	 */
	getPageFilePath(pageType: PageType): string {
		return this.pageManager.getFilePath(pageType);
	}

	/**
	 * Open a page, creating it if it doesn't exist
	 */
	async openPage(pageType: PageType): Promise<void> {
		await this.pageManager.open(pageType);
	}

	/**
	 * Rollover a page: archive current and create new with rolled over tasks
	 */
	async rolloverPage(pageType: PageType): Promise<void> {
		await this.pageManager.rollover(pageType);
	}

	/**
	 * Detect page type from file path
	 */
	detectPageType(filePath: string): PageType | null {
		return this.pageManager.detectPageType(filePath);
	}

	// Legacy convenience methods for Now page (used by ribbon)

	/**
	 * Get the path to Now.md
	 */
	getNowFilePath(): string {
		return this.pageManager.getFilePath("now");
	}

	/**
	 * Open Now.md, creating it if it doesn't exist
	 */
	async openNow(): Promise<void> {
		await this.pageManager.open("now");
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
