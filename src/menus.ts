import type { Menu } from "obsidian";
import type RollPlugin from "../main";
import { PAGE_CONFIG } from "./pages/types";

/**
 * Register file and editor context menus
 */
export function registerMenus(plugin: RollPlugin): void {
	// File menu (right-click in file explorer)
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			addRolloverMenuItem(plugin, menu, file.path);
		}),
	);

	// Editor menu (right-click in editor)
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu, _editor, view) => {
			if (view.file) {
				addRolloverMenuItem(plugin, menu, view.file.path);
			}
		}),
	);
}

/**
 * Add rollover menu item if file is a Roll page
 */
function addRolloverMenuItem(
	plugin: RollPlugin,
	menu: Menu,
	filePath: string,
): void {
	const pageType = plugin.detectPageType(filePath);
	if (!pageType) return;

	const displayName = PAGE_CONFIG[pageType].displayName;
	menu.addItem((item) => {
		item.setTitle(`Roll: Rollover ${displayName}`).onClick(async () => {
			await plugin.rolloverPage(pageType);
		});
	});
}
