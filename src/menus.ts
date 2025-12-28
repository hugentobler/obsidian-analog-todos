import type RollPlugin from "../main";
import { PAGE_CONFIG } from "./pages/types";

/**
 * Register file and editor context menus
 */
export function registerMenus(plugin: RollPlugin): void {
	// File menu (right-click in file explorer)
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			const pageType = plugin.detectPageType(file.path);
			if (!pageType) return;

			const displayName = PAGE_CONFIG[pageType].displayName;

			menu.addItem((item) => {
				item.setTitle(`Roll: Rollover ${displayName}`).onClick(async () => {
					await plugin.rolloverPage(pageType);
				});
			});
		}),
	);

	// Editor menu (right-click in editor)
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu, _editor, view) => {
			if (!view.file) return;

			const pageType = plugin.detectPageType(view.file.path);
			if (!pageType) return;

			const displayName = PAGE_CONFIG[pageType].displayName;

			menu.addItem((item) => {
				item.setTitle(`Roll: Rollover ${displayName}`).onClick(async () => {
					await plugin.rolloverPage(pageType);
				});
			});
		}),
	);
}
