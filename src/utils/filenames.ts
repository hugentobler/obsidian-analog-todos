/**
 * Filename utility functions for Analog Todos
 * Pure functions - no Obsidian dependencies
 */

/**
 * Format a date for display in Today file name
 *
 * Format: "Today YYYY-MM-DD.md"
 * Examples:
 * - "Today 2024-12-16.md"
 * - "Today 2024-01-01.md"
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Formatted filename
 */
export function formatTodayFileName(date: string): string {
	return `Today ${date}.md`;
}

// In-source tests
