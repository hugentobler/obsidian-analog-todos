/**
 * Filename utility functions
 * Pure functions - no Obsidian dependencies
 */

import { PAGE_CONFIG, type PageType } from "../pages/types";

/**
 * Format archived page filename with date range
 *
 * Format: "{PageType} {started}~{ended}.md" or "{PageType} {started}~{ended} (n).md"
 * Examples:
 * - "Now 2024-12-20~2024-12-26.md"
 * - "Next 2024-12-26~2024-12-26.md" (same-day)
 * - "Now 2024-12-26~2024-12-26 (2).md" (counter for duplicates)
 *
 * @param pageType - Type of page (now, next)
 * @param started - Start date in YYYY-MM-DD format
 * @param ended - End date in YYYY-MM-DD format
 * @param counter - Optional counter for duplicate filenames (2, 3, etc.)
 * @returns Formatted filename
 */
export function formatArchivedFileName(
	pageType: PageType,
	started: string,
	ended: string,
	counter?: number,
): string {
	const displayName = PAGE_CONFIG[pageType].displayName;
	const base = `${displayName} ${started}~${ended}`;
	if (counter && counter > 1) {
		return `${base} (${counter}).md`;
	}
	return `${base}.md`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("filenames", () => {
		describe("formatArchivedFileName", () => {
			it("formats Now page date range correctly", () => {
				expect(formatArchivedFileName("now", "2024-12-20", "2024-12-26")).toBe(
					"Now 2024-12-20~2024-12-26.md",
				);
			});

			it("formats Next page date range correctly", () => {
				expect(formatArchivedFileName("next", "2024-12-20", "2024-12-26")).toBe(
					"Next 2024-12-20~2024-12-26.md",
				);
			});

			it("handles same-day rollover", () => {
				expect(formatArchivedFileName("now", "2024-12-26", "2024-12-26")).toBe(
					"Now 2024-12-26~2024-12-26.md",
				);
			});

			it("adds counter for duplicates", () => {
				expect(formatArchivedFileName("now", "2024-12-26", "2024-12-26", 2)).toBe(
					"Now 2024-12-26~2024-12-26 (2).md",
				);
				expect(formatArchivedFileName("next", "2024-12-26", "2024-12-26", 3)).toBe(
					"Next 2024-12-26~2024-12-26 (3).md",
				);
			});

			it("ignores counter of 1", () => {
				expect(formatArchivedFileName("now", "2024-12-20", "2024-12-26", 1)).toBe(
					"Now 2024-12-20~2024-12-26.md",
				);
			});
		});
	});
}
