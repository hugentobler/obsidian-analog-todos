/**
 * Filename utility functions
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
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("filenames", () => {
		describe("formatTodayFileName", () => {
			it("formats date correctly", () => {
				expect(formatTodayFileName("2024-12-16")).toBe("Today 2024-12-16.md");
			});

			it("handles different dates", () => {
				expect(formatTodayFileName("2024-01-01")).toBe("Today 2024-01-01.md");
				expect(formatTodayFileName("2023-12-31")).toBe("Today 2023-12-31.md");
			});
		});
	});
}
