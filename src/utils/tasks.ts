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

/** Result of parsing a single task line */
export interface ParsedTaskLine {
	state: TaskState;
	prefix: string;
	suffix: string;
}

/** Task line regex pattern */
const TASK_LINE_PATTERN = /^(\s*- \[)([^\]])(\].*)$/;

/**
 * Parse a single line to extract task state
 * Returns null if line is not a task
 */
export function parseTaskLine(line: string): ParsedTaskLine | null {
	const match = line.match(TASK_LINE_PATTERN);
	if (!match) return null;

	return {
		prefix: match[1],
		state: match[2] as TaskState,
		suffix: match[3],
	};
}

// In-source tests
if (import.meta.vitest) {
	const { describe, it, expect } = import.meta.vitest;

	describe("parseTasks", () => {
		it("parses basic tasks", () => {
			const content = "- [ ] todo\n- [x] done\n- [/] in progress";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(3);
			expect(tasks[0]).toMatchObject({ state: " ", text: "todo" });
			expect(tasks[1]).toMatchObject({ state: "x", text: "done" });
			expect(tasks[2]).toMatchObject({ state: "/", text: "in progress" });
		});

		it("parses indented tasks and preserves line numbers", () => {
			const content = "# Header\n- [ ] task\n  - [x] nested";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(2);
			expect(tasks[0]).toMatchObject({ line: 1, indent: "" });
			expect(tasks[1]).toMatchObject({ line: 2, indent: "  " });
		});

		it("ignores non-task lines", () => {
			const content = "# Header\n- regular list\n- [ ] actual task";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].text).toBe("actual task");
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
			expect(incomplete.map((t) => t.state)).toEqual([" ", "/"]);
		});
	});

	describe("getNextTaskState", () => {
		it("cycles through states", () => {
			expect(getNextTaskState(" ")).toBe("/");
			expect(getNextTaskState("/")).toBe("x");
			expect(getNextTaskState("x")).toBe(" ");
		});
	});

	describe("taskToMarkdown", () => {
		it("converts task to markdown with indentation", () => {
			const task: Task = {
				line: 0,
				state: "/",
				text: "in progress",
				indent: "  ",
				raw: "",
			};
			expect(taskToMarkdown(task)).toBe("  - [/] in progress");
		});
	});

	describe("parseTaskLine", () => {
		it("parses task lines", () => {
			expect(parseTaskLine("- [ ] task")).toEqual({
				prefix: "- [",
				state: " ",
				suffix: "] task",
			});
			expect(parseTaskLine("  - [x] nested")).toEqual({
				prefix: "  - [",
				state: "x",
				suffix: "] nested",
			});
		});

		it("returns null for non-task lines", () => {
			expect(parseTaskLine("# Header")).toBeNull();
			expect(parseTaskLine("- regular list")).toBeNull();
			expect(parseTaskLine("")).toBeNull();
		});
	});
}
