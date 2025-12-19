/**
 * Template builder for Now pages
 * Pure functions - no Obsidian dependencies
 */

import { type Task, taskToMarkdown } from "../utils/tasks";

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
 * @param rolledTasks - Tasks rolled over from previous Now page
 */
export function buildNowTemplate(
	startDate: string,
	rolledTasks: Task[] = [],
): string {
	const frontmatter = `---\nstarted: ${startDate}\n---\n`;

	if (rolledTasks.length === 0) {
		return frontmatter + DEFAULT_TEMPLATE_BODY;
	}

	// Group tasks by header, preserving order
	const lines: string[] = [];
	let lastHeader: string | null | undefined = undefined; // Track header changes

	for (const task of rolledTasks) {
		// Output header when it changes (including from null to header or header to null)
		if (task.header !== lastHeader) {
			if (task.header) {
				if (lines.length > 0) lines.push(""); // Blank line before new section
				lines.push(task.header);
			}
			lastHeader = task.header;
		}
		lines.push(taskToMarkdown(task));
	}

	return `${frontmatter}\n${lines.join("\n")}\n`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("buildNowTemplate", () => {
		it("uses default template when no rolled tasks", () => {
			const result = buildNowTemplate("2024-12-18");
			expect(result).toContain("started: 2024-12-18");
			expect(result).toContain("- [ ] new task");
			expect(result).toContain("- [/] in-progress task");
			expect(result).toContain("### Project title");
			expect(result).toContain("- [ ] project task");
			expect(result).toContain("- [x] completed task");
		});

		it("includes rolled tasks", () => {
			const tasks: Task[] = [
				{ line: 0, state: " ", text: "todo task", indent: "", raw: "", header: null },
				{ line: 1, state: "/", text: "in progress", indent: "", raw: "", header: null },
			];
			const result = buildNowTemplate("2024-12-18", tasks);

			expect(result).toContain("started: 2024-12-18");
			expect(result).toContain("- [ ] todo task");
			expect(result).toContain("- [/] in progress");
			expect(result).not.toContain("new task");
		});

		it("preserves task indentation", () => {
			const tasks: Task[] = [
				{ line: 0, state: " ", text: "parent", indent: "", raw: "", header: null },
				{ line: 1, state: "/", text: "child", indent: "  ", raw: "", header: null },
			];
			const result = buildNowTemplate("2024-12-18", tasks);

			expect(result).toContain("- [ ] parent");
			expect(result).toContain("  - [/] child");
		});

		it("includes headers directly preceding tasks", () => {
			const tasks: Task[] = [
				{ line: 1, state: " ", text: "task 1", indent: "", raw: "", header: "### Project A" },
				{ line: 2, state: "/", text: "task 2", indent: "", raw: "", header: "### Project A" },
				{ line: 5, state: " ", text: "task 3", indent: "", raw: "", header: "### Project B" },
			];
			const result = buildNowTemplate("2024-12-18", tasks);

			expect(result).toContain("### Project A");
			expect(result).toContain("### Project B");
			expect(result).toContain("- [ ] task 1");
			expect(result).toContain("- [/] task 2");
			expect(result).toContain("- [ ] task 3");
		});

		it("handles mix of tasks with and without headers", () => {
			const tasks: Task[] = [
				{ line: 0, state: " ", text: "orphan task", indent: "", raw: "", header: null },
				{ line: 3, state: " ", text: "project task", indent: "", raw: "", header: "### My Project" },
			];
			const result = buildNowTemplate("2024-12-18", tasks);

			expect(result).toContain("- [ ] orphan task");
			expect(result).toContain("### My Project");
			expect(result).toContain("- [ ] project task");
		});
	});
}
