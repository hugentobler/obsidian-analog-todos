/**
 * Date utility functions
 * Pure functions - no Obsidian dependencies
 */

/**
 * Get the current date in YYYY-MM-DD format
 * Uses Obsidian's bundled moment.js instance
 */
export function getTodayDate(): string {
	return window.moment().format("YYYY-MM-DD");
}
