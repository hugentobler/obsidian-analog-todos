import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Enable in-source testing
		includeSource: ["src/**/*.ts"],
		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
		},
	},
});
