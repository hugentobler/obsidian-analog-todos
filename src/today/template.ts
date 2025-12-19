/**
 * Template builder for Today pages
 * Pure functions - no Obsidian dependencies
 */

import { type Task, taskToMarkdown } from "../utils/tasks";

const DEFAULT_TEMPLATE_BODY = `
- [ ] new task
`;

/**
 * Build a Today page template
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param carriedTasks - Tasks to carry over from previous day
 */
export function buildTodayTemplate(
	startDate: string,
	carriedTasks: Task[] = [],
): string {
	const frontmatter = `---\nstarted: ${startDate}\n---\n`;

	if (carriedTasks.length === 0) {
		return frontmatter + DEFAULT_TEMPLATE_BODY;
	}

	const tasksMarkdown = carriedTasks.map(taskToMarkdown).join("\n");
	return `${frontmatter}\n${tasksMarkdown}\n`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("buildTodayTemplate", () => {
		it("uses default template when no carried tasks", () => {
			const result = buildTodayTemplate("2024-12-18");
			expect(result).toContain("started: 2024-12-18");
			expect(result).toContain("- [ ] new task");
		});

		it("includes carried tasks", () => {
			const tasks: Task[] = [
				{ line: 0, state: " ", text: "todo task", indent: "", raw: "" },
				{ line: 1, state: "/", text: "in progress", indent: "", raw: "" },
			];
			const result = buildTodayTemplate("2024-12-18", tasks);

			expect(result).toContain("started: 2024-12-18");
			expect(result).toContain("- [ ] todo task");
			expect(result).toContain("- [/] in progress");
			expect(result).not.toContain("new task");
		});

		it("preserves task indentation", () => {
			const tasks: Task[] = [
				{ line: 0, state: " ", text: "parent", indent: "", raw: "" },
				{ line: 1, state: "/", text: "child", indent: "  ", raw: "" },
			];
			const result = buildTodayTemplate("2024-12-18", tasks);

			expect(result).toContain("- [ ] parent");
			expect(result).toContain("  - [/] child");
		});
	});
}
