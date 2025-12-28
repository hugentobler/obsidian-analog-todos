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

export interface Section {
	headers: string[];
	tasks: Task[];
}

/** Header pattern - any markdown header level */
const HEADER_PATTERN = /^#{1,6}\s+.+$/;

/** Task pattern */
const TASK_PATTERN = /^(\s*)- \[([^\]])\]\s*(.*)$/;

/**
 * Parse content into sections
 * A section = consecutive headers + following tasks (text ignored)
 * A new header starts a new section
 */
export function parseSections(content: string): Section[] {
	const sections: Section[] = [];
	const lines = content.split("\n");

	let currentSection: Section | null = null;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check for header - starts new section
		if (HEADER_PATTERN.test(line)) {
			// If we have a current section with tasks, save it
			if (currentSection && currentSection.tasks.length > 0) {
				sections.push(currentSection);
			}
			// Start new section or add to header group
			if (currentSection && currentSection.tasks.length === 0) {
				// No tasks yet, this is a consecutive header
				currentSection.headers.push(line);
			} else {
				// Start fresh section
				currentSection = { headers: [line], tasks: [] };
			}
			continue;
		}

		// Check for task
		const taskMatch = line.match(TASK_PATTERN);
		if (taskMatch) {
			// Create section for orphan tasks (no header)
			if (!currentSection) {
				currentSection = { headers: [], tasks: [] };
			}
			currentSection.tasks.push({
				line: i,
				indent: taskMatch[1],
				state: taskMatch[2] as TaskState,
				text: taskMatch[3],
				raw: line,
			});
		}

		// Other content (blank lines, text) - ignored but doesn't break section
	}

	// Don't forget the last section
	if (currentSection && currentSection.tasks.length > 0) {
		sections.push(currentSection);
	}

	return sections;
}

/**
 * Parse tasks from markdown content (flat list, for backwards compatibility)
 */
export function parseTasks(content: string): Task[] {
	const sections = parseSections(content);
	return sections.flatMap((s) => s.tasks);
}

/**
 * Filter sections that have at least one incomplete task
 * Returns sections with only incomplete tasks
 */
export function filterIncompleteSections(sections: Section[]): Section[] {
	return sections
		.map((section) => ({
			headers: section.headers,
			tasks: section.tasks.filter((t) => t.state === " " || t.state === "/"),
		}))
		.filter((section) => section.tasks.length > 0);
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

/**
 * Convert section to markdown lines
 */
export function sectionToMarkdown(section: Section): string[] {
	const lines: string[] = [];
	for (const header of section.headers) {
		lines.push(header);
	}
	for (const task of section.tasks) {
		lines.push(taskToMarkdown(task));
	}
	return lines;
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

	describe("parseSections", () => {
		it("parses tasks without headers as one section", () => {
			const content = "- [ ] task 1\n- [x] task 2";
			const sections = parseSections(content);

			expect(sections).toHaveLength(1);
			expect(sections[0].headers).toEqual([]);
			expect(sections[0].tasks).toHaveLength(2);
		});

		it("parses header with tasks as section", () => {
			const content = "### Project\n- [ ] task 1\n- [ ] task 2";
			const sections = parseSections(content);

			expect(sections).toHaveLength(1);
			expect(sections[0].headers).toEqual(["### Project"]);
			expect(sections[0].tasks).toHaveLength(2);
		});

		it("groups consecutive headers together", () => {
			const content = "## Big Project\n### Subproject\n- [ ] task 1";
			const sections = parseSections(content);

			expect(sections).toHaveLength(1);
			expect(sections[0].headers).toEqual(["## Big Project", "### Subproject"]);
			expect(sections[0].tasks).toHaveLength(1);
		});

		it("ignores text between headers and tasks", () => {
			const content = "### Project\nSome notes here\n- [ ] task 1";
			const sections = parseSections(content);

			expect(sections).toHaveLength(1);
			expect(sections[0].headers).toEqual(["### Project"]);
			expect(sections[0].tasks).toHaveLength(1);
		});

		it("starts new section on new header", () => {
			const content = "### A\n- [ ] task a\n### B\n- [ ] task b";
			const sections = parseSections(content);

			expect(sections).toHaveLength(2);
			expect(sections[0].headers).toEqual(["### A"]);
			expect(sections[0].tasks).toHaveLength(1);
			expect(sections[1].headers).toEqual(["### B"]);
			expect(sections[1].tasks).toHaveLength(1);
		});

		it("handles orphan tasks before first header", () => {
			const content = "- [ ] orphan\n### Project\n- [ ] task";
			const sections = parseSections(content);

			expect(sections).toHaveLength(2);
			expect(sections[0].headers).toEqual([]);
			expect(sections[0].tasks[0].text).toBe("orphan");
			expect(sections[1].headers).toEqual(["### Project"]);
		});

		it("drops headers with no tasks", () => {
			const content = "### Empty\n\n### Has Tasks\n- [ ] task";
			const sections = parseSections(content);

			expect(sections).toHaveLength(1);
			expect(sections[0].headers).toEqual(["### Empty", "### Has Tasks"]);
		});
	});

	describe("filterIncompleteSections", () => {
		it("keeps sections with incomplete tasks", () => {
			const sections: Section[] = [
				{
					headers: ["### A"],
					tasks: [{ line: 0, state: " ", text: "todo", indent: "", raw: "" }],
				},
				{
					headers: ["### B"],
					tasks: [{ line: 1, state: "x", text: "done", indent: "", raw: "" }],
				},
			];

			const result = filterIncompleteSections(sections);
			expect(result).toHaveLength(1);
			expect(result[0].headers).toEqual(["### A"]);
		});

		it("filters out completed tasks within sections", () => {
			const sections: Section[] = [
				{
					headers: ["### Mixed"],
					tasks: [
						{ line: 0, state: " ", text: "todo", indent: "", raw: "" },
						{ line: 1, state: "x", text: "done", indent: "", raw: "" },
						{ line: 2, state: "/", text: "wip", indent: "", raw: "" },
					],
				},
			];

			const result = filterIncompleteSections(sections);
			expect(result).toHaveLength(1);
			expect(result[0].tasks).toHaveLength(2);
			expect(result[0].tasks.map((t) => t.state)).toEqual([" ", "/"]);
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

	describe("sectionToMarkdown", () => {
		it("converts section with headers and tasks", () => {
			const section: Section = {
				headers: ["## Project", "### Sub"],
				tasks: [
					{ line: 0, state: " ", text: "task 1", indent: "", raw: "" },
					{ line: 1, state: "/", text: "task 2", indent: "  ", raw: "" },
				],
			};

			const lines = sectionToMarkdown(section);
			expect(lines).toEqual([
				"## Project",
				"### Sub",
				"- [ ] task 1",
				"  - [/] task 2",
			]);
		});

		it("converts section without headers", () => {
			const section: Section = {
				headers: [],
				tasks: [{ line: 0, state: " ", text: "orphan", indent: "", raw: "" }],
			};

			const lines = sectionToMarkdown(section);
			expect(lines).toEqual(["- [ ] orphan"]);
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
