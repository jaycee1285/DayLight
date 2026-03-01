/**
 * Stripped-down Milkdown adapter for DayLight.
 * Based on jotter's milkdown_adapter.ts, keeping only:
 * - Editor init with commonmark + GFM
 * - History (undo/redo)
 * - Clipboard
 * - Markdown change listener
 * - set/get markdown
 */

import {
	Editor,
	defaultValueCtx,
	editorViewOptionsCtx,
	rootCtx,
	editorViewCtx
} from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import { indent } from '@milkdown/plugin-indent';
import { replaceAll } from '@milkdown/kit/utils';

export interface EditorHandle {
	/** Replace editor content with new markdown */
	setMarkdown(markdown: string): void;
	/** Get current markdown from editor */
	getMarkdown(): string;
	/** Focus the editor */
	focus(): void;
	/** Destroy the editor instance */
	destroy(): void;
	/** Execute a ProseMirror command via milkdown action */
	action: Editor['action'];
}

export interface EditorConfig {
	/** DOM element to mount editor into */
	root: HTMLElement;
	/** Initial markdown content */
	initialMarkdown: string;
	/** Called when markdown content changes */
	onMarkdownChange?: (markdown: string) => void;
}

function normalizeMarkdown(raw: string): string {
	return raw.includes('\u200B') ? raw.replaceAll('\u200B', '') : raw;
}

export async function createEditor(config: EditorConfig): Promise<EditorHandle> {
	const { root, initialMarkdown, onMarkdownChange } = config;
	let currentMarkdown = initialMarkdown;

	const editor = await Editor.make()
		.config((ctx) => {
			ctx.set(rootCtx, root);
			ctx.set(defaultValueCtx, initialMarkdown);
			ctx.set(editorViewOptionsCtx, { editable: () => true });
		})
		.use(commonmark)
		.use(gfm)
		.use(indent)
		.use(listener)
		.use(history)
		.use(clipboard)
		.config((ctx) => {
			const l = ctx.get(listenerCtx);
			l.markdownUpdated((_ctx, markdown, prevMarkdown) => {
				if (markdown === prevMarkdown) return;
				const normalized = normalizeMarkdown(markdown);
				if (normalized === currentMarkdown) return;
				currentMarkdown = normalized;
				onMarkdownChange?.(normalized);
			});
		})
		.create();

	return {
		setMarkdown(markdown: string) {
			currentMarkdown = markdown;
			editor.action(replaceAll(markdown));
		},
		getMarkdown() {
			return currentMarkdown;
		},
		focus() {
			try {
				editor.action((ctx) => {
					const view = ctx.get(editorViewCtx);
					view.focus();
				});
			} catch {
				// editor view may not exist yet
			}
		},
		destroy() {
			editor.destroy();
		},
		action: editor.action.bind(editor)
	};
}
