import { PluginSettingTab, Setting } from "obsidian";
import type RollPlugin from "../main";

export interface RollSettings {
	rollFolder: string;
	archiveFolder: string;
}

export const DEFAULT_SETTINGS: RollSettings = {
	rollFolder: "Roll",
	archiveFolder: "Archive",
};

/**
 * Register settings tab
 */
export function registerSettings(plugin: RollPlugin): void {
	plugin.addSettingTab(new RollSettingTab(plugin));
}

class RollSettingTab extends PluginSettingTab {
	plugin: RollPlugin;

	constructor(plugin: RollPlugin) {
		super(plugin.app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Roll" });

		new Setting(containerEl)
			.setName("Now page folder")
			.setDesc(
				"Folder for Now pages, relative to vault root. Default is the plugin name.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Roll")
					.setValue(this.plugin.settings.rollFolder)
					.onChange(async (value) => {
						this.plugin.settings.rollFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Archive folder name")
			.setDesc(
				"Subfolder for archived Now pages, relative to the Now page folder.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Archive")
					.setValue(this.plugin.settings.archiveFolder)
					.onChange(async (value) => {
						this.plugin.settings.archiveFolder = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
