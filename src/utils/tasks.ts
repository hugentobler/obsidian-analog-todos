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
	header: string | null; // Header directly preceding this task group
}

/** Header pattern - any markdown header level */
const HEADER_PATTERN = /^#{1,6}\s+.+$/;

/** Task pattern */
const TASK_PATTERN = /^(\s*)- \[([^\]])\]\s*(.*)$/;

/**
 * Parse tasks from markdown content
 * Tracks headers directly preceding task groups
 */
export function parseTasks(content: string): Task[] {
	const tasks: Task[] = [];
	const lines = content.split("\n");

	let currentHeader: string | null = null;
	let headerValid = false; // True if only blank lines/tasks since header

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Check for header
		if (HEADER_PATTERN.test(line)) {
			currentHeader = line;
			headerValid = true;
			continue;
		}

		// Check for task
		const taskMatch = line.match(TASK_PATTERN);
		if (taskMatch) {
			tasks.push({
				line: i,
				indent: taskMatch[1],
				state: taskMatch[2] as TaskState,
				text: taskMatch[3],
				raw: line,
				header: headerValid ? currentHeader : null,
			});
			continue;
		}

		// Blank line - doesn't break header association
		if (trimmed === "") {
			continue;
		}

		// Any other content breaks header association
		headerValid = false;
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
			expect(tasks[0]).toMatchObject({ state: " ", text: "todo", header: null });
			expect(tasks[1]).toMatchObject({ state: "x", text: "done", header: null });
			expect(tasks[2]).toMatchObject({ state: "/", text: "in progress", header: null });
		});

		it("parses indented tasks and preserves line numbers", () => {
			const content = "# Header\n- [ ] task\n  - [x] nested";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(2);
			expect(tasks[0]).toMatchObject({ line: 1, indent: "", header: "# Header" });
			expect(tasks[1]).toMatchObject({ line: 2, indent: "  ", header: "# Header" });
		});

		it("tracks headers directly preceding tasks", () => {
			const content = "### Project A\n- [ ] task 1\n- [ ] task 2";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(2);
			expect(tasks[0].header).toBe("### Project A");
			expect(tasks[1].header).toBe("### Project A");
		});

		it("breaks header association when other content intervenes", () => {
			const content = "### Project A\nSome notes\n- [ ] task 1";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].header).toBeNull();
		});

		it("allows blank lines between header and tasks", () => {
			const content = "### Project A\n\n\n- [ ] task 1";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(1);
			expect(tasks[0].header).toBe("### Project A");
		});

		it("handles multiple headers", () => {
			const content = "### A\n- [ ] task a\n### B\n- [ ] task b";
			const tasks = parseTasks(content);

			expect(tasks).toHaveLength(2);
			expect(tasks[0].header).toBe("### A");
			expect(tasks[1].header).toBe("### B");
		});
	});

	describe("filterIncomplete", () => {
		it("filters only incomplete tasks", () => {
			const tasks: Task[] = [
				{ line: 0, state: " ", text: "todo", indent: "", raw: "", header: null },
				{ line: 1, state: "x", text: "done", indent: "", raw: "", header: null },
				{ line: 2, state: "/", text: "wip", indent: "", raw: "", header: null },
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
				header: null,
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
