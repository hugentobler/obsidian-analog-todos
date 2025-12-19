/**
 * Tri-state checkbox handler: [ ] → [/] → [x] → [ ]
 *
 * Implementation notes:
 * - Reads state from markdown (not DOM) since DOM may be stale
 * - Uses CodeMirror's posAtDOM() for accurate line detection
 * - Double requestAnimationFrame to sync checkbox after CM re-renders
 */

import { type App, MarkdownView } from "obsidian";
import type RollPlugin from "../main";
import { isInPluginFolder } from "./utils/files";
import {
	getNextTaskState,
	parseTaskLine,
	type TaskState,
} from "./utils/tasks";

/**
 * Register checkbox handler for tri-state toggling: [ ] → [/] → [x] → [ ]
 */
export function registerCheckboxes(plugin: RollPlugin): void {
	const handler = createCheckboxHandler(plugin.app, () => plugin.settings.rollFolder);
	plugin.registerDomEvent(document, "click", handler, true);
}

/**
 * Creates a click handler for tri-state checkbox toggling: [ ] → [/] → [x] → [ ]
 * Register with capture phase to intercept before Obsidian's handler.
 */
function createCheckboxHandler(app: App, getFolderPath: () => string) {
	return (evt: MouseEvent): void => {
		const target = evt.target as HTMLElement;

		// --- Can we handle this click? If not, let Obsidian handle it ---
		if (!isTaskCheckbox(target)) return;

		const activeView = app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView?.editor) return;

		const file = activeView.file;
		if (!file || !isInPluginFolder(file.path, getFolderPath())) return;

		const lineNumber = getLineNumberFromCheckbox(target, activeView);
		if (lineNumber === null) return;

		// --- We can handle it - prevent Obsidian's default toggle ---
		evt.preventDefault();
		evt.stopPropagation();

		// Read state from markdown source (DOM data-task may be stale)
		const editor = activeView.editor;
		const lineContent = editor.getLine(lineNumber);
		const parsed = parseTaskLine(lineContent);
		if (!parsed) return;

		// Toggle to next state and update editor
		const nextState = getNextTaskState(parsed.state);
		editor.setLine(lineNumber, `${parsed.prefix}${nextState}${parsed.suffix}`);

		// Sync DOM checkbox after CodeMirror re-renders
		syncCheckboxState(target, nextState);
	};
}

function isTaskCheckbox(target: HTMLElement): boolean {
	if (!(target instanceof HTMLInputElement)) return false;
	if (target.type !== "checkbox") return false;
	if (!target.classList.contains("task-list-item-checkbox")) return false;
	return true;
}

function getLineNumberFromCheckbox(
	checkbox: HTMLElement,
	view: MarkdownView,
): number | null {
	// @ts-expect-error - cm exists at runtime but not in type definitions
	const cm = view.editor.cm;
	if (!cm) return null;

	try {
		const pos = cm.posAtDOM(checkbox);
		return cm.state.doc.lineAt(pos).number - 1; // CM is 1-indexed, Editor is 0-indexed
	} catch {
		return null;
	}
}

function syncCheckboxState(target: HTMLElement, newState: TaskState): void {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			const checkbox = target
				.closest(".cm-line")
				?.querySelector(
					"input.task-list-item-checkbox",
				) as HTMLInputElement | null;
			if (checkbox) checkbox.checked = newState === "x";
		});
	});
}


