/**
 * Filename utility functions
 * Pure functions - no Obsidian dependencies
 */

/**
 * Format a date for display in Now file name
 *
 * Format: "Now YYYY-MM-DD.md"
 * Examples:
 * - "Now 2024-12-16.md"
 * - "Now 2024-01-01.md"
 *
 * @param date - Date string in YYYY-MM-DD format
 * @returns Formatted filename
 */
export function formatNowFileName(date: string): string {
	return `Now ${date}.md`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("filenames", () => {
		describe("formatNowFileName", () => {
			it("formats date correctly", () => {
				expect(formatNowFileName("2024-12-16")).toBe("Now 2024-12-16.md");
			});

			it("handles different dates", () => {
				expect(formatNowFileName("2024-01-01")).toBe("Now 2024-01-01.md");
				expect(formatNowFileName("2023-12-31")).toBe("Now 2023-12-31.md");
			});
		});
	});
}
