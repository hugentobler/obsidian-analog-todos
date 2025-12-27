/**
 * Filename utility functions
 * Pure functions - no Obsidian dependencies
 */

/**
 * Format archived Now filename with date range
 *
 * Format: "Now {started}~{ended}.md" or "Now {started}~{ended} (n).md"
 * Examples:
 * - "Now 2024-12-20~2024-12-26.md"
 * - "Now 2024-12-26~2024-12-26.md" (same-day)
 * - "Now 2024-12-26~2024-12-26 (2).md" (counter for duplicates)
 *
 * @param started - Start date in YYYY-MM-DD format
 * @param ended - End date in YYYY-MM-DD format
 * @param counter - Optional counter for duplicate filenames (2, 3, etc.)
 * @returns Formatted filename
 */
export function formatArchivedNowFileName(
	started: string,
	ended: string,
	counter?: number,
): string {
	const base = `Now ${started}~${ended}`;
	if (counter && counter > 1) {
		return `${base} (${counter}).md`;
	}
	return `${base}.md`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("filenames", () => {
		describe("formatArchivedNowFileName", () => {
			it("formats date range correctly", () => {
				expect(formatArchivedNowFileName("2024-12-20", "2024-12-26")).toBe(
					"Now 2024-12-20~2024-12-26.md",
				);
			});

			it("handles same-day rollover", () => {
				expect(formatArchivedNowFileName("2024-12-26", "2024-12-26")).toBe(
					"Now 2024-12-26~2024-12-26.md",
				);
			});

			it("adds counter for duplicates", () => {
				expect(formatArchivedNowFileName("2024-12-26", "2024-12-26", 2)).toBe(
					"Now 2024-12-26~2024-12-26 (2).md",
				);
				expect(formatArchivedNowFileName("2024-12-26", "2024-12-26", 3)).toBe(
					"Now 2024-12-26~2024-12-26 (3).md",
				);
			});

			it("ignores counter of 1", () => {
				expect(formatArchivedNowFileName("2024-12-20", "2024-12-26", 1)).toBe(
					"Now 2024-12-20~2024-12-26.md",
				);
			});
		});
	});
}
