import type RollPlugin from "../main";
import {
	filterIncompleteSections,
	parseSections,
	type Task,
} from "./utils/tasks";

/**
 * Register code block processors
 */
export function registerCodeBlocks(plugin: RollPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"roll-next",
		async (_source, el, _ctx) => {
			await renderNextTasks(plugin, el);
		},
	);
}

/**
 * Render incomplete tasks from Next.md into the given element
 */
async function renderNextTasks(
	plugin: RollPlugin,
	el: HTMLElement,
): Promise<void> {
	const nextFile = plugin.pageManager.getFile("next");
	if (!nextFile) return;

	const content = await plugin.app.vault.read(nextFile.file);
	const sections = parseSections(content);
	const incompleteSections = filterIncompleteSections(sections);
	const tasks = incompleteSections.flatMap((s) => s.tasks);

	if (tasks.length === 0) return;

	// Make the whole block clickable
	el.addClass("roll-next-container");
	el.addEventListener("click", () => {
		plugin.app.workspace.getLeaf(false).openFile(nextFile.file);
	});

	// Divider and heading
	el.createEl("hr", { cls: "roll-next-divider" });
	el.createEl("h4", { text: "Up next", cls: "roll-next-heading" });

	// Task list matching Obsidian's structure
	const list = el.createEl("ul", { cls: "roll-next-list contains-task-list" });
	for (const task of tasks) {
		renderTask(list, task);
	}
}

/**
 * Render a single task as a checkbox list item
 */
function renderTask(list: HTMLElement, task: Task): void {
	const li = list.createEl("li", {
		cls: "roll-next-task task-list-item",
		attr: { "data-task": task.state },
	});

	// Checkbox (disabled - clicking navigates to Next page)
	const checkbox = li.createEl("input", {
		type: "checkbox",
		cls: "task-list-item-checkbox",
		attr: { "data-task": task.state, disabled: "true" },
	});
	if (task.state === "x") {
		checkbox.checked = true;
	}

	// Task text
	li.createSpan({ text: task.text });
}
