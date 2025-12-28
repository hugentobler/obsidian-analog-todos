import { Component, MarkdownRenderer } from "obsidian";
import type RollPlugin from "../main";
import { filterIncompleteSections, parseSections } from "./utils/tasks";

/**
 * Register code block processors
 */
export function registerCodeBlocks(plugin: RollPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"roll-next",
		async (_source, el, ctx) => {
			await renderNextTasks(plugin, el, ctx.sourcePath);
		},
	);
}

/**
 * Render incomplete tasks from Next.md into the given element
 */
async function renderNextTasks(
	plugin: RollPlugin,
	el: HTMLElement,
	sourcePath: string,
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

	// Task list - render each task as full Markdown
	const taskContainer = el.createDiv({ cls: "roll-next-list" });
	const taskMarkdown = tasks.map((t) => `- [${t.state}] ${t.text}`).join("\n");
	await MarkdownRenderer.render(
		plugin.app,
		taskMarkdown,
		taskContainer,
		sourcePath,
		new Component(),
	);
}
