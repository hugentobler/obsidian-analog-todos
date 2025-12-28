import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Enable in-source testing
		includeSource: ["src/**/*.ts"],
		// Exclude files that depend on Obsidian APIs (can't be unit tested)
		exclude: [
			"**/node_modules/**",
			"src/ui/**", // UI components depend on Obsidian
			"src/pages/page-manager.ts", // Page manager depends on Obsidian
		],
		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
		},
	},
});
