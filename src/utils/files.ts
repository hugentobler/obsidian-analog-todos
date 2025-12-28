/**
 * File path utility functions
 * Pure functions - no Obsidian dependencies
 */

/**
 * Check if a file path is within the plugin folder
 * @param filePath - Full path to the file
 * @param folderPath - Plugin folder path (empty string = vault root)
 */
export function isInPluginFolder(
	filePath: string,
	folderPath: string,
): boolean {
	// If no folder configured (vault root), check file is at root level
	if (!folderPath) {
		return !filePath.includes("/");
	}
	return filePath.startsWith(`${folderPath}/`);
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("isInPluginFolder", () => {
		it("returns true for file directly in folder", () => {
			expect(isInPluginFolder("Roll/Now.md", "Roll")).toBe(true);
		});

		it("returns true for file in subfolder", () => {
			expect(isInPluginFolder("Roll/Archive/Now 2024-01-01.md", "Roll")).toBe(
				true,
			);
		});

		it("returns false for file in different folder", () => {
			expect(isInPluginFolder("Other/file.md", "Roll")).toBe(false);
		});

		it("returns false for file at root when folder is set", () => {
			expect(isInPluginFolder("file.md", "Roll")).toBe(false);
		});

		it("returns true for root file when no folder configured", () => {
			expect(isInPluginFolder("Now.md", "")).toBe(true);
		});

		it("returns false for nested file when no folder configured", () => {
			expect(isInPluginFolder("Roll/Now.md", "")).toBe(false);
		});
	});
}
