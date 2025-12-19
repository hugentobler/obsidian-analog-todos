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

/**
 * Validate if a string matches YYYY-MM-DD format
 * 
 * Pattern: /^\d{4}-\d{2}-\d{2}$/
 * Valid: "2024-12-16", "2024-01-01"
 * Invalid: "2024-1-1", "12/16/2024", ""
 */
export function isValidDateFormat(date: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * Compare two date strings (YYYY-MM-DD format)
 * Uses lexicographic comparison (works because of YYYY-MM-DD format)
 * 
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareDates(date1: string, date2: string): number {
	if (date1 < date2) return -1;
	if (date1 > date2) return 1;
	return 0;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("date-utils", () => {
		describe("compareDates", () => {
			it("compares dates correctly", () => {
				expect(compareDates("2024-12-15", "2024-12-16")).toBe(-1);
				expect(compareDates("2024-12-16", "2024-12-15")).toBe(1);
				expect(compareDates("2024-12-16", "2024-12-16")).toBe(0);
			});

			it("handles year boundaries", () => {
				expect(compareDates("2023-12-31", "2024-01-01")).toBe(-1);
			});
		});
	});
}
