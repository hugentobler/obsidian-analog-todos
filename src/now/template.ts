/**
 * Template builder for Now pages
 * Pure functions - no Obsidian dependencies
 */

import { type Section, sectionToMarkdown } from "../utils/tasks";

const DEFAULT_TEMPLATE_BODY = `
- [ ] new task
- [/] in-progress task

### Project title
- [ ] project task
- [x] completed task
`;

/**
 * Build a Now page template
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param rolledSections - Sections rolled over from previous Now page
 */
export function buildNowTemplate(
	startDate: string,
	rolledSections: Section[] = [],
): string {
	const frontmatter = `---\nstarted: ${startDate}\n---\n`;

	if (rolledSections.length === 0) {
		return frontmatter + DEFAULT_TEMPLATE_BODY;
	}

	const lines: string[] = [];
	for (const section of rolledSections) {
		if (lines.length > 0) {
			lines.push(""); // Blank line between sections
		}
		lines.push(...sectionToMarkdown(section));
	}

	return `${frontmatter}\n${lines.join("\n")}\n`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("buildNowTemplate", () => {
		it("uses default template when no rolled sections", () => {
			const result = buildNowTemplate("2024-12-18");
			expect(result).toContain("started: 2024-12-18");
			expect(result).toContain("- [ ] new task");
			expect(result).toContain("- [/] in-progress task");
			expect(result).toContain("### Project title");
			expect(result).toContain("- [ ] project task");
			expect(result).toContain("- [x] completed task");
		});

		it("includes rolled sections with headers", () => {
			const sections: Section[] = [
				{
					headers: ["### Project A"],
					tasks: [
						{ line: 0, state: " ", text: "task 1", indent: "", raw: "" },
						{ line: 1, state: "/", text: "task 2", indent: "", raw: "" },
					],
				},
			];
			const result = buildNowTemplate("2024-12-18", sections);

			expect(result).toContain("started: 2024-12-18");
			expect(result).toContain("### Project A");
			expect(result).toContain("- [ ] task 1");
			expect(result).toContain("- [/] task 2");
			expect(result).not.toContain("new task");
		});

		it("includes nested headers", () => {
			const sections: Section[] = [
				{
					headers: ["## Big Project", "### Subproject"],
					tasks: [{ line: 0, state: " ", text: "task", indent: "", raw: "" }],
				},
			];
			const result = buildNowTemplate("2024-12-18", sections);

			expect(result).toContain("## Big Project");
			expect(result).toContain("### Subproject");
			expect(result).toContain("- [ ] task");
		});

		it("handles orphan tasks without headers", () => {
			const sections: Section[] = [
				{
					headers: [],
					tasks: [{ line: 0, state: " ", text: "orphan", indent: "", raw: "" }],
				},
			];
			const result = buildNowTemplate("2024-12-18", sections);

			expect(result).toContain("- [ ] orphan");
			expect(result).not.toContain("#");
		});

		it("preserves task indentation", () => {
			const sections: Section[] = [
				{
					headers: ["### Project"],
					tasks: [
						{ line: 0, state: " ", text: "parent", indent: "", raw: "" },
						{ line: 1, state: "/", text: "child", indent: "  ", raw: "" },
					],
				},
			];
			const result = buildNowTemplate("2024-12-18", sections);

			expect(result).toContain("- [ ] parent");
			expect(result).toContain("  - [/] child");
		});

		it("adds blank lines between sections", () => {
			const sections: Section[] = [
				{
					headers: ["### A"],
					tasks: [{ line: 0, state: " ", text: "task a", indent: "", raw: "" }],
				},
				{
					headers: ["### B"],
					tasks: [{ line: 1, state: " ", text: "task b", indent: "", raw: "" }],
				},
			];
			const result = buildNowTemplate("2024-12-18", sections);

			expect(result).toContain("- [ ] task a\n\n### B");
		});
	});
}
