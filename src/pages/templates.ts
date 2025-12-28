/**
 * Template builders for page types
 * Pure functions - no Obsidian dependencies
 */

import {
	type Section,
	sectionToMarkdown,
	taskToMarkdown,
} from "../utils/tasks";
import type { PageType } from "./types";

const DEFAULT_NOW_TEMPLATE_BODY = `
- [ ] new task
- [/] in-progress task

### Project title
- [ ] project task
- [x] completed task
`;

const DEFAULT_NEXT_TEMPLATE_BODY = `
- [ ] task coming up soon
- [ ] another task coming up later
`;

const DEFAULT_TEMPLATE_BODIES: Record<PageType, string> = {
	now: DEFAULT_NOW_TEMPLATE_BODY,
	next: DEFAULT_NEXT_TEMPLATE_BODY,
};

/**
 * Build a page template
 * @param pageType - Type of page (now, next)
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param rolledSections - Sections rolled over from previous page
 */
export function buildPageTemplate(
	pageType: PageType,
	startDate: string,
	rolledSections: Section[] = [],
): string {
	const frontmatter = `---\nstarted: ${startDate}\n---\n`;

	if (rolledSections.length === 0) {
		return frontmatter + DEFAULT_TEMPLATE_BODIES[pageType];
	}

	if (pageType === "next") {
		// Next page: flatten to tasks only (no headers, no indentation, no blank lines)
		return frontmatter + formatFlatTasks(rolledSections);
	}

	// Now page: preserve sections with headers
	const lines: string[] = [];
	for (const section of rolledSections) {
		if (lines.length > 0) {
			lines.push(""); // Blank line between sections
		}
		lines.push(...sectionToMarkdown(section));
	}

	return `${frontmatter}\n${lines.join("\n")}\n`;
}

/**
 * Format sections as flat task list (no headers, no indentation)
 */
function formatFlatTasks(sections: Section[]): string {
	const tasks = sections.flatMap((s) => s.tasks);
	// Reset indentation to root level
	const flatTasks = tasks.map((t) => ({ ...t, indent: "" }));
	const lines = flatTasks.map((t) => taskToMarkdown(t));
	return `\n${lines.join("\n")}\n`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("buildPageTemplate", () => {
		describe("now page", () => {
			it("uses default now template when no rolled sections", () => {
				const result = buildPageTemplate("now", "2024-12-18");
				expect(result).toContain("started: 2024-12-18");
				expect(result).toContain("- [ ] new task");
				expect(result).toContain("- [/] in-progress task");
				expect(result).toContain("### Project title");
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
				const result = buildPageTemplate("now", "2024-12-18", sections);

				expect(result).toContain("started: 2024-12-18");
				expect(result).toContain("### Project A");
				expect(result).toContain("- [ ] task 1");
				expect(result).toContain("- [/] task 2");
				expect(result).not.toContain("new task");
			});
		});

		describe("next page", () => {
			it("uses default next template when no rolled sections", () => {
				const result = buildPageTemplate("next", "2024-12-18");
				expect(result).toContain("started: 2024-12-18");
				expect(result).toContain("- [ ] future task");
				expect(result).toContain("### Upcoming project");
				expect(result).toContain("- [ ] planned task");
			});

			it("flattens tasks without headers on rollover", () => {
				const sections: Section[] = [
					{
						headers: ["### Future Project"],
						tasks: [
							{ line: 0, state: " ", text: "future task", indent: "", raw: "" },
						],
					},
				];
				const result = buildPageTemplate("next", "2024-12-18", sections);

				expect(result).not.toContain("### Future Project");
				expect(result).toContain("- [ ] future task");
				expect(result).not.toContain("Upcoming project");
			});

			it("removes indentation from nested tasks", () => {
				const sections: Section[] = [
					{
						headers: ["### Project"],
						tasks: [
							{ line: 0, state: " ", text: "parent", indent: "", raw: "" },
							{ line: 1, state: "/", text: "child", indent: "  ", raw: "" },
							{
								line: 2,
								state: " ",
								text: "grandchild",
								indent: "    ",
								raw: "",
							},
						],
					},
				];
				const result = buildPageTemplate("next", "2024-12-18", sections);

				expect(result).toContain("- [ ] parent\n- [/] child\n- [ ] grandchild");
				expect(result).not.toContain("  -"); // No indented tasks
			});

			it("merges tasks from multiple sections without blank lines between", () => {
				const sections: Section[] = [
					{
						headers: ["### A"],
						tasks: [
							{ line: 0, state: " ", text: "task a", indent: "", raw: "" },
						],
					},
					{
						headers: ["### B"],
						tasks: [
							{ line: 1, state: " ", text: "task b", indent: "", raw: "" },
						],
					},
				];
				const result = buildPageTemplate("next", "2024-12-18", sections);

				expect(result).not.toContain("###");
				// Tasks are consecutive, no blank lines between them
				expect(result).toContain("- [ ] task a\n- [ ] task b");
			});
		});

		describe("now page sections", () => {
			it("includes nested headers", () => {
				const sections: Section[] = [
					{
						headers: ["## Big Project", "### Subproject"],
						tasks: [{ line: 0, state: " ", text: "task", indent: "", raw: "" }],
					},
				];
				const result = buildPageTemplate("now", "2024-12-18", sections);

				expect(result).toContain("## Big Project");
				expect(result).toContain("### Subproject");
				expect(result).toContain("- [ ] task");
			});

			it("handles orphan tasks without headers", () => {
				const sections: Section[] = [
					{
						headers: [],
						tasks: [
							{ line: 0, state: " ", text: "orphan", indent: "", raw: "" },
						],
					},
				];
				const result = buildPageTemplate("now", "2024-12-18", sections);

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
				const result = buildPageTemplate("now", "2024-12-18", sections);

				expect(result).toContain("- [ ] parent");
				expect(result).toContain("  - [/] child");
			});

			it("adds blank lines between sections", () => {
				const sections: Section[] = [
					{
						headers: ["### A"],
						tasks: [
							{ line: 0, state: " ", text: "task a", indent: "", raw: "" },
						],
					},
					{
						headers: ["### B"],
						tasks: [
							{ line: 1, state: " ", text: "task b", indent: "", raw: "" },
						],
					},
				];
				const result = buildPageTemplate("now", "2024-12-18", sections);

				expect(result).toContain("- [ ] task a\n\n### B");
			});
		});
	});
}
