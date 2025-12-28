import type RollPlugin from "../main";
import type { PageType } from "./pages/types";

/**
 * Register all plugin commands
 */
export function registerCommands(plugin: RollPlugin): void {
	// Command to open Now page (creates if doesn't exist)
	plugin.addCommand({
		id: "open-now",
		name: "Open 'Now' page",
		callback: async () => {
			await plugin.openPage("now");
		},
	});

	// Command to open Next page (creates if doesn't exist)
	plugin.addCommand({
		id: "open-next",
		name: "Open 'Next' page",
		callback: async () => {
			await plugin.openPage("next");
		},
	});

	// Command to rollover the active page (works on Now or Next)
	plugin.addCommand({
		id: "rollover-page",
		name: "Rollover this page",
		checkCallback: (checking: boolean) => {
			const pageType = getActivePageType(plugin);
			if (!pageType) return false;

			if (!checking) {
				plugin.rolloverPage(pageType);
			}
			return true;
		},
	});
}

/**
 * Get the page type of the currently active file, if it's a Roll page
 */
function getActivePageType(plugin: RollPlugin): PageType | null {
	const activeFile = plugin.app.workspace.getActiveFile();
	if (!activeFile) return null;

	return plugin.detectPageType(activeFile.path);
}
