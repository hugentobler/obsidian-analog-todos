import type RollPlugin from "../main";

/**
 * Register file and editor context menus
 */
export function registerMenus(plugin: RollPlugin): void {
	const nowPath = () => plugin.getNowFilePath();

	// File menu (right-click in file explorer)
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (file.path !== nowPath()) return;

			menu.addItem((item) => {
				item.setTitle("Roll: Rollover Page").onClick(async () => {
					await plugin.rolloverNow();
				});
			});
		}),
	);

	// Editor menu (right-click in editor)
	plugin.registerEvent(
		plugin.app.workspace.on("editor-menu", (menu, _editor, view) => {
			if (view.file?.path !== nowPath()) return;

			menu.addItem((item) => {
				item.setTitle("Roll: Rollover Page").onClick(async () => {
					await plugin.rolloverNow();
				});
			});
		}),
	);
}
