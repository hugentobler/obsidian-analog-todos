import type RollPlugin from "../main";

/**
 * Register all plugin commands
 */
export function registerCommands(plugin: RollPlugin): void {
	// Command to open Now page (creates if doesn't exist)
	plugin.addCommand({
		id: "open-now",
		name: "Open Now",
		callback: async () => {
			await plugin.openNow();
		},
	});

	// Command to rollover Now page (archive current, create new with rolled over tasks)
	plugin.addCommand({
		id: "rollover-now",
		name: "Rollover Now",
		callback: async () => {
			await plugin.rolloverNow();
		},
	});
}
