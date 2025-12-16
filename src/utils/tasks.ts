/**
 * Task parsing and manipulation utilities
 * Pure functions - no Obsidian dependencies
 */

export type TaskState = " " | "/" | "x";

export interface Task {
	line: number;
	state: TaskState;
	text: string;
	indent: string;
	raw: string;
}

/**
 * Parse tasks from markdown content
 * Matches pattern: "- [ ] task text" or "  - [x] nested task"
 */
export function parseTasks(content: string): Task[] {
	const tasks: Task[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(/^(\s*)- \[([^\]])\]\s*(.*)$/);

		if (match) {
			tasks.push({
				line: i,
				indent: match[1],
				state: match[2] as TaskState,
				text: match[3],
				raw: line,
			});
		}
	}

	return tasks;
}

/**
 * Filter tasks that are incomplete (todo or in-progress)
 */
export function filterIncomplete(tasks: Task[]): Task[] {
	return tasks.filter((t) => t.state === " " || t.state === "/");
}

/**
 * Filter tasks that are completed
 */
export function filterCompleted(tasks: Task[]): Task[] {
	return tasks.filter((t) => t.state === "x");
}

/**
 * Get the next state in tri-state cycle: [ ] → [/] → [x] → [ ]
 */
export function getNextTaskState(currentState: TaskState): TaskState {
	switch (currentState) {
		case " ":
			return "/";
		case "/":
			return "x";
		case "x":
			return " ";
	}
}

/**
 * Convert task back to markdown line
 */
export function taskToMarkdown(task: Task): string {
	return `${task.indent}- [${task.state}] ${task.text}`;
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("task-utils", () => {
		describe("parseTasks", () => {
			it("parses basic tasks", () => {
				const content = "- [ ] todo\n- [x] done\n- [/] in progress";
				const tasks = parseTasks(content);

				expect(tasks).toHaveLength(3);
				expect(tasks[0].state).toBe(" ");
				expect(tasks[0].text).toBe("todo");
				expect(tasks[1].state).toBe("x");
				expect(tasks[1].text).toBe("done");
				expect(tasks[2].state).toBe("/");
				expect(tasks[2].text).toBe("in progress");
			});

			it("parses indented tasks", () => {
				const content = "  - [ ] nested task\n    - [x] deeply nested";
				const tasks = parseTasks(content);

				expect(tasks).toHaveLength(2);
				expect(tasks[0].indent).toBe("  ");
				expect(tasks[1].indent).toBe("    ");
			});

			it("ignores non-task lines", () => {
				const content = `# Header
Some text
- [ ] actual task
- regular list item
- [x] another task`;
				const tasks = parseTasks(content);

				expect(tasks).toHaveLength(2);
				expect(tasks[0].text).toBe("actual task");
				expect(tasks[1].text).toBe("another task");
			});

			it("handles empty content", () => {
				expect(parseTasks("")).toEqual([]);
			});

			it("preserves line numbers", () => {
				const content = "line 0\n- [ ] task on line 1\nline 2\n- [x] task on line 3";
				const tasks = parseTasks(content);

				expect(tasks[0].line).toBe(1);
				expect(tasks[1].line).toBe(3);
			});
		});

		describe("filterIncomplete", () => {
			it("filters only incomplete tasks", () => {
				const tasks: Task[] = [
					{ line: 0, state: " ", text: "todo", indent: "", raw: "" },
					{ line: 1, state: "x", text: "done", indent: "", raw: "" },
					{ line: 2, state: "/", text: "wip", indent: "", raw: "" },
				];

				const incomplete = filterIncomplete(tasks);
				expect(incomplete).toHaveLength(2);
				expect(incomplete[0].state).toBe(" ");
				expect(incomplete[1].state).toBe("/");
			});
		});

		describe("filterCompleted", () => {
			it("filters only completed tasks", () => {
				const tasks: Task[] = [
					{ line: 0, state: " ", text: "todo", indent: "", raw: "" },
					{ line: 1, state: "x", text: "done", indent: "", raw: "" },
					{ line: 2, state: "/", text: "wip", indent: "", raw: "" },
				];

				const completed = filterCompleted(tasks);
				expect(completed).toHaveLength(1);
				expect(completed[0].state).toBe("x");
			});
		});

		describe("getNextTaskState", () => {
			it("cycles through states correctly", () => {
				expect(getNextTaskState(" ")).toBe("/");
				expect(getNextTaskState("/")).toBe("x");
				expect(getNextTaskState("x")).toBe(" ");
			});
		});

		describe("taskToMarkdown", () => {
			it("converts task to markdown", () => {
				const task: Task = {
					line: 0,
					state: "x",
					text: "completed task",
					indent: "  ",
					raw: "",
				};

				expect(taskToMarkdown(task)).toBe("  - [x] completed task");
			});
		});
	});
}
