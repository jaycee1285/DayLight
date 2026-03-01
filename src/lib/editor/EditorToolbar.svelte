<script lang="ts">
	import type { EditorHandle } from './milkdown-adapter';
	import { editorViewCtx } from '@milkdown/kit/core';
	import { toggleStrongCommand, toggleEmphasisCommand } from '@milkdown/kit/preset/commonmark';
	import { callCommand } from '@milkdown/kit/utils';
	import { undoCommand, redoCommand } from '@milkdown/kit/plugin/history';

	import IconEye from '~icons/lucide/eye';
	import IconUndo from '~icons/lucide/undo-2';
	import IconRedo from '~icons/lucide/redo-2';
	import IconBold from '~icons/lucide/bold';
	import IconItalic from '~icons/lucide/italic';
	import IconStrikethrough from '~icons/lucide/strikethrough';
	import IconHeading from '~icons/lucide/heading';
	import IconList from '~icons/lucide/list';
	import IconListChecks from '~icons/lucide/list-checks';
	import IconQuote from '~icons/lucide/quote';
	import IconCode from '~icons/lucide/code';
	import IconLink from '~icons/lucide/link';
	import IconMinus from '~icons/lucide/minus';

	interface Props {
		editor: EditorHandle | null;
		onTogglePreview: () => void;
		previewing: boolean;
	}

	let { editor, onTogglePreview, previewing }: Props = $props();

	let expandedGroup: string | null = $state(null);

	function cmd(command: Parameters<typeof callCommand>[0]) {
		if (!editor) return;
		editor.action(callCommand(command));
	}

	function insertText(prefix: string, suffix: string = '') {
		if (!editor) return;
		editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			const { state } = view;
			const { from, to } = state.selection;
			const selectedText = state.doc.textBetween(from, to);
			const insertion = `${prefix}${selectedText}${suffix}`;
			const tr = state.tr.replaceRangeWith(
				from,
				to,
				state.schema.text(insertion)
			);
			view.dispatch(tr);
			view.focus();
		});
	}

	function insertLinePrefix(prefix: string) {
		if (!editor) return;
		editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			const { state } = view;
			const { from } = state.selection;
			// Find start of current line
			const pos = state.doc.resolve(from);
			const lineStart = pos.start(pos.depth);
			const tr = state.tr.insertText(prefix, lineStart);
			view.dispatch(tr);
			view.focus();
		});
	}

	function toggleExpanded(group: string) {
		expandedGroup = expandedGroup === group ? null : group;
	}

	type ToolbarAction = {
		id: string;
		icon: any;
		label: string;
		action: () => void;
		disabled?: boolean;
		expandable?: boolean;
		subItems?: { id: string; label: string; action: () => void }[];
	};

	const actions = $derived.by<ToolbarAction[]>(() => [
		{
			id: 'preview',
			icon: IconEye,
			label: 'Preview',
			action: () => onTogglePreview()
		},
		{
			id: 'undo',
			icon: IconUndo,
			label: 'Undo',
			action: () => cmd(undoCommand.key),
			disabled: previewing
		},
		{
			id: 'redo',
			icon: IconRedo,
			label: 'Redo',
			action: () => cmd(redoCommand.key),
			disabled: previewing
		},
		{
			id: 'bold',
			icon: IconBold,
			label: 'Bold',
			action: () => cmd(toggleStrongCommand.key),
			disabled: previewing
		},
		{
			id: 'italic',
			icon: IconItalic,
			label: 'Italic',
			action: () => cmd(toggleEmphasisCommand.key),
			disabled: previewing
		},
		{
			id: 'strikethrough',
			icon: IconStrikethrough,
			label: 'Strikethrough',
			action: () => insertText('~~', '~~'),
			disabled: previewing
		},
		{
			id: 'heading',
			icon: IconHeading,
			label: 'Heading',
			action: () => toggleExpanded('heading'),
			disabled: previewing,
			expandable: true,
			subItems: [
				{ id: 'h1', label: 'H1', action: () => insertLinePrefix('# ') },
				{ id: 'h2', label: 'H2', action: () => insertLinePrefix('## ') },
				{ id: 'h3', label: 'H3', action: () => insertLinePrefix('### ') }
			]
		},
		{
			id: 'list',
			icon: IconList,
			label: 'List',
			action: () => insertLinePrefix('- '),
			disabled: previewing
		},
		{
			id: 'checklist',
			icon: IconListChecks,
			label: 'Checklist',
			action: () => insertLinePrefix('- [ ] '),
			disabled: previewing
		},
		{
			id: 'blockquote',
			icon: IconQuote,
			label: 'Quote',
			action: () => insertLinePrefix('> '),
			disabled: previewing
		},
		{
			id: 'code',
			icon: IconCode,
			label: 'Code',
			action: () => insertText('`', '`'),
			disabled: previewing
		},
		{
			id: 'link',
			icon: IconLink,
			label: 'Link',
			action: () => insertText('[', '](url)'),
			disabled: previewing
		},
		{
			id: 'hr',
			icon: IconMinus,
			label: 'Horizontal Rule',
			action: () => insertText('\n---\n'),
			disabled: previewing
		}
	]);
</script>

<div class="editor-toolbar">
	{#if expandedGroup === 'heading'}
		<div class="toolbar-expanded">
			{#each actions.find((a) => a.id === 'heading')?.subItems ?? [] as sub}
				<button
					type="button"
					class="toolbar-btn toolbar-sub-btn"
					onclick={() => { sub.action(); expandedGroup = null; }}
					aria-label={sub.label}
				>
					<span class="toolbar-text-icon">{sub.label}</span>
				</button>
			{/each}
			<button
				type="button"
				class="toolbar-btn toolbar-close-btn"
				onclick={() => (expandedGroup = null)}
				aria-label="Close"
			>
				<span class="toolbar-text-icon">&times;</span>
			</button>
		</div>
	{:else}
		<div class="toolbar-scroll">
			{#each actions as item}
				{@const Icon = item.icon}
				<button
					type="button"
					class="toolbar-btn"
					class:active={item.id === 'preview' && previewing}
					disabled={item.disabled && !item.expandable}
					onclick={item.action}
					aria-label={item.label}
					title={item.label}
				>
					<Icon />
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.editor-toolbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		height: 3rem;
		background-color: rgb(var(--color-surface-100));
		border-top: 1px solid rgb(var(--color-surface-300));
		z-index: 50;
		padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px));
	}

	:global([data-mode='dark']) .editor-toolbar {
		background-color: rgb(var(--color-surface-800));
		border-top-color: rgb(var(--color-surface-600));
	}

	.toolbar-scroll {
		display: flex;
		align-items: center;
		height: 3rem;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding: 0 0.25rem;
	}

	.toolbar-scroll::-webkit-scrollbar {
		display: none;
	}

	.toolbar-expanded {
		display: flex;
		align-items: center;
		height: 3rem;
		padding: 0 0.25rem;
		gap: 0.25rem;
	}

	.toolbar-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		border-radius: 0.375rem;
		color: rgb(var(--color-surface-700));
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	:global([data-mode='dark']) .toolbar-btn {
		color: rgb(var(--color-surface-300));
	}

	.toolbar-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .toolbar-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-surface-700));
	}

	.toolbar-btn:disabled {
		opacity: 0.35;
	}

	.toolbar-btn.active {
		color: rgb(var(--color-primary-500));
		background-color: rgb(var(--color-primary-500) / 0.1);
	}

	.toolbar-btn :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}

	.toolbar-sub-btn {
		width: auto;
		padding: 0 1rem;
		font-weight: 700;
		font-size: 0.875rem;
	}

	.toolbar-text-icon {
		font-size: 1rem;
		font-weight: 700;
	}

	.toolbar-close-btn {
		color: rgb(var(--color-error-500));
	}
</style>
