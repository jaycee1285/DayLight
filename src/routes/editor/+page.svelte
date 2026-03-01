<script lang="ts">
	import { goto } from '$app/navigation';
	import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
	import { join } from '@tauri-apps/api/path';
	import { marked } from 'marked';
	import { createEditor, type EditorHandle } from '$lib/editor/milkdown-adapter';
	import EditorToolbar from '$lib/editor/EditorToolbar.svelte';
	import FileBrowser from '$lib/editor/FileBrowser.svelte';
	import { getDataPath } from '$lib/storage/storage';
	import { parseMarkdown } from '$lib/storage/frontmatter';
	import { markdownStore, updateTaskWithBody } from '$lib/stores/markdown-store.svelte';
	import IconChevronLeft from '~icons/lucide/chevron-left';
	import IconSave from '~icons/lucide/save';
	import IconPlus from '~icons/lucide/plus';

type View = 'browser' | 'editor' | 'preview';
const EDITOR_PATH_KEY = 'daylight-editor-path';

	let view = $state<View>('browser');
	let basePath = $state('');
	let currentFilePath = $state('');
	let currentFileName = $state('');
	let originalContent = $state('');
	let currentMarkdown = $state('');
	let editorHandle = $state<EditorHandle | null>(null);
	let editorRoot: HTMLDivElement | null = $state(null);
	let saving = $state(false);
	let dirty = $state(false);
let previewing = $state(false);
let initError = $state<string | null>(null);
	let loadingPhase = $state<'init' | 'browser'>('init');
	let initialized = $state(false);
	let editorPathInput = $state('');
	let pathError = $state<string | null>(null);
	let showFolderDialog = $state(false);
	let currentDirectory = $state('');
	let showNewNoteDialog = $state(false);
	let newNoteName = $state('');
	let newNoteError = $state<string | null>(null);

	async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
		let timer: ReturnType<typeof setTimeout> | null = null;
		try {
			return await Promise.race([
				promise,
				new Promise<T>((_, reject) => {
					timer = setTimeout(() => reject(new Error(message)), ms);
				})
			]);
		} finally {
			if (timer) clearTimeout(timer);
		}
	}

	function renderMarkdown(markdown: string): string {
		const parsed = marked.parse(markdown, { async: false });
		return typeof parsed === 'string' ? parsed : '';
	}

	function closeOnOverlayKey(
		event: KeyboardEvent,
		close: () => void
	): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			close();
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close();
		}
	}

	const renderedHtml = $derived(previewing ? renderMarkdown(currentMarkdown) : '');

async function loadBasePath() {
	initError = null;
	basePath = '';
	loadingPhase = 'init';

	try {
		const savedEditorPath = typeof localStorage !== 'undefined'
			? localStorage.getItem(EDITOR_PATH_KEY)
			: null;
		if (savedEditorPath && savedEditorPath.trim()) {
			basePath = savedEditorPath.trim();
			editorPathInput = basePath;
			return;
		}

		const savedPath = typeof localStorage !== 'undefined'
			? localStorage.getItem('daylight-data-path')
			: null;
		if (savedPath && savedPath.trim()) {
			basePath = savedPath.trim();
			editorPathInput = basePath;
			return;
		}

		const dataPath = await withTimeout(
			getDataPath(),
			5000,
			'Timed out resolving data path'
		);
		basePath = dataPath;
		editorPathInput = dataPath;
	} catch (e) {
		initError = e instanceof Error ? e.message : String(e);
	}
}

	$effect(() => {
		if (initialized) return;
		initialized = true;
		void loadBasePath();
	});

	$effect(() => {
		return () => {
			editorHandle?.destroy();
			editorHandle = null;
		};
	});

	async function openFile(relativePath: string, fileName: string) {
		try {
			loadingPhase = 'browser';
			const fullPath = await join(basePath, relativePath);
			const content = await readTextFile(fullPath);

			currentFilePath = relativePath;
			currentFileName = fileName;
			originalContent = content;
			currentMarkdown = content;
			dirty = false;
			previewing = false;
			view = 'editor';

			// Mount editor after DOM updates
			await mountEditor();
		} catch (e) {
			console.error('Failed to open file:', e);
		}
	}

	async function mountEditor() {
		// Wait for DOM
		await new Promise((r) => requestAnimationFrame(r));
		if (!editorRoot) return;

		editorHandle?.destroy();
		editorHandle = await createEditor({
			root: editorRoot,
			initialMarkdown: currentMarkdown,
			onMarkdownChange: (md) => {
				currentMarkdown = md;
				dirty = md !== originalContent;
			}
		});
		editorHandle.focus();
	}

	async function saveFile() {
		if (!currentFilePath || saving) return;
		saving = true;
		try {
			const savedThroughTaskStore = await saveTaskFileIfManaged();
			if (!savedThroughTaskStore) {
				const fullPath = await join(basePath, currentFilePath);
				await writeTextFile(fullPath, currentMarkdown);
			}
			originalContent = currentMarkdown;
			dirty = false;
		} catch (e) {
			console.error('Failed to save:', e);
		} finally {
			saving = false;
		}
	}

	function goBack() {
		if (view === 'editor' || view === 'preview') {
			editorHandle?.destroy();
			editorHandle = null;
			view = 'browser';
			previewing = false;
		}
	}

function togglePreview() {
	previewing = !previewing;
}

async function browseEditorFolder() {
	pathError = null;
	try {
		const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
		if (isMobile) {
			const picker = (window as Window & {
				AndroidDirectoryPicker?: { pickDirectory: () => void };
				__DIRECTORY_PICKER_RESOLVE__?: (path: string | null) => void;
			}).AndroidDirectoryPicker;
			if (!picker) {
				pathError = 'Directory picker not available on this device.';
				return;
			}

			const selected = await new Promise<string | null>((resolve) => {
				(window as Window & { __DIRECTORY_PICKER_RESOLVE__?: (path: string | null) => void }).__DIRECTORY_PICKER_RESOLVE__ = resolve;
				picker.pickDirectory();
			});
			if (selected) editorPathInput = selected;
			return;
		}

		const { open } = await import('@tauri-apps/plugin-dialog');
		const selected = await open({
			directory: true,
			multiple: false,
			title: 'Select Editor Folder'
		});
		if (selected && typeof selected === 'string') {
			editorPathInput = selected;
		}
	} catch (e) {
		pathError = e instanceof Error ? e.message : 'Could not open folder picker';
	}
}

function useEditorFolder() {
	const trimmed = editorPathInput.trim();
	if (!trimmed) {
		pathError = 'Enter a folder path first.';
		return;
	}
	basePath = trimmed;
	initError = null;
	pathError = null;
	showFolderDialog = false;
	try {
		localStorage.setItem(EDITOR_PATH_KEY, trimmed);
	} catch {
		// Ignore storage errors.
	}
}

	function resetEditorFolder() {
	try {
		localStorage.removeItem(EDITOR_PATH_KEY);
	} catch {
		// Ignore storage errors.
	}
	showFolderDialog = false;
	void loadBasePath();
}

	function openNewNoteDialog() {
		newNoteName = '';
		newNoteError = null;
		showNewNoteDialog = true;
	}

	function normalizeNoteFilename(value: string): string {
		const stripped = value.trim().replace(/[\\/]/g, '');
		return stripped.toLowerCase().endsWith('.md') ? stripped : `${stripped}.md`;
	}

	async function createNewNote() {
		const trimmed = newNoteName.trim();
		if (!trimmed) {
			newNoteError = 'Enter a note name.';
			return;
		}

		const filename = normalizeNoteFilename(trimmed);
		const relativePath = currentDirectory ? `${currentDirectory}/${filename}` : filename;

		try {
			const fullPath = await join(basePath, relativePath);
			if (await exists(fullPath)) {
				newNoteError = 'A note with that name already exists in this folder.';
				return;
			}
			await writeTextFile(fullPath, '');
			showNewNoteDialog = false;
			await openFile(relativePath, filename);
		} catch (e) {
			newNoteError = e instanceof Error ? e.message : 'Failed to create note';
		}
	}

	function getFilename(path: string): string | null {
		const parts = path.split('/').filter(Boolean);
		const filename = parts.at(-1);
		return filename && filename.endsWith('.md') ? filename : null;
	}

	async function saveTaskFileIfManaged(): Promise<boolean> {
		const filename = getFilename(currentFilePath);
		if (!filename) return false;
		if (!markdownStore.getTaskFile(filename)) return false;

		const parsed = parseMarkdown(currentMarkdown);
		if (!parsed) return false;

		await updateTaskWithBody(filename, parsed.frontmatter, parsed.body);
		return true;
	}
</script>

<div class="editor-page">
	{#if view === 'browser'}
		{#if basePath}
			<FileBrowser
				{basePath}
				onFileSelect={openFile}
				compactHeader={true}
				onExit={() => goto('/today-bases')}
				onOpenFolderDialog={() => (showFolderDialog = true)}
				onDirectoryChange={(path) => (currentDirectory = path)}
			/>
			<button
				type="button"
				class="note-fab w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
				onclick={openNewNoteDialog}
				aria-label="Create new note"
			>
				<IconPlus width="24" height="24" />
			</button>
		{:else if initError}
			<div class="loading-state error-state">
				<div>Failed to open vault path.</div>
				<code>{initError}</code>
				<button type="button" class="retry-btn" onclick={loadBasePath}>Retry</button>
			</div>
		{:else}
			<div class="loading-state">
				{loadingPhase === 'init' ? 'Loading editor...' : 'Loading files...'}
			</div>
		{/if}
	{:else}
		<!-- Editor/Preview header -->
		<div class="editor-header">
			<button type="button" class="header-btn" onclick={goBack} aria-label="Back to files">
				<IconChevronLeft />
			</button>
			<span class="header-filename" title={currentFileName}>
				{currentFileName.replace(/\.md$/, '')}
			</span>
			<div class="header-actions">
				{#if dirty}
					<button
						type="button"
						class="header-btn save-btn"
						onclick={saveFile}
						disabled={saving}
						aria-label="Save"
					>
						<IconSave />
					</button>
				{/if}
			</div>
		</div>

		<!-- Editor area -->
		<div class="editor-content">
			<div class="milkdown-host" class:hidden={previewing} bind:this={editorRoot}></div>
			<div class="preview-pane" class:hidden={!previewing}>
				{@html renderedHtml}
			</div>
		</div>

		<!-- Toolbar -->
		<EditorToolbar editor={editorHandle} onTogglePreview={togglePreview} {previewing} />
	{/if}
</div>

{#if showFolderDialog}
	<div
		class="folder-dialog-overlay"
		role="button"
		tabindex="0"
		aria-label="Close editor folder dialog"
		onclick={() => (showFolderDialog = false)}
		onkeydown={(e) => closeOnOverlayKey(e, () => (showFolderDialog = false))}
	>
		<div class="folder-dialog" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="folder-dialog-title">Editor Folder</div>
			<input class="path-input" placeholder="/path/to/notes" bind:value={editorPathInput} />
			<div class="path-actions">
				<button type="button" class="path-btn" onclick={browseEditorFolder}>Browse</button>
				<button type="button" class="path-btn" onclick={useEditorFolder}>Use Folder</button>
				<button type="button" class="path-btn" onclick={resetEditorFolder}>Reset</button>
			</div>
			{#if pathError}
				<div class="path-error">{pathError}</div>
			{/if}
		</div>
	</div>
{/if}

{#if showNewNoteDialog}
	<div
		class="folder-dialog-overlay"
		role="button"
		tabindex="0"
		aria-label="Close new note dialog"
		onclick={() => (showNewNoteDialog = false)}
		onkeydown={(e) => closeOnOverlayKey(e, () => (showNewNoteDialog = false))}
	>
		<div class="folder-dialog" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="folder-dialog-title">New Note</div>
			<input
				class="path-input"
				placeholder="Note title"
				bind:value={newNoteName}
				onkeydown={(e) => e.key === 'Enter' && createNewNote()}
			/>
			<div class="path-actions">
				<button type="button" class="path-btn" onclick={createNewNote}>Create</button>
				<button type="button" class="path-btn" onclick={() => (showNewNoteDialog = false)}>Cancel</button>
			</div>
			{#if newNoteError}
				<div class="path-error">{newNoteError}</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.editor-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background-color: rgb(var(--color-surface-50));
	}

	:global([data-mode='dark']) .editor-page {
		background-color: rgb(var(--color-surface-900));
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.5rem;
		height: 100%;
		color: rgb(var(--color-surface-500));
	}

	.error-state {
		padding: 1rem;
		text-align: center;
	}

	.error-state code {
		font-size: 0.8125rem;
		opacity: 0.9;
		word-break: break-word;
	}

	.retry-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
		font-weight: 600;
	}

	.folder-dialog-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 70;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 0.75rem;
	}

	.folder-dialog {
		width: min(42rem, 100%);
		border-radius: 0.75rem;
		padding: 0.875rem;
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	:global([data-mode='dark']) .folder-dialog {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.folder-dialog-title {
		font-weight: 700;
		font-size: 0.95rem;
		color: rgb(var(--color-surface-800));
	}

	:global([data-mode='dark']) .folder-dialog-title {
		color: rgb(var(--color-surface-100));
	}

	.path-input {
		flex: 1;
		min-width: 0;
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-50));
		color: rgb(var(--color-surface-900));
	}

	:global([data-mode='dark']) .path-input {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-900));
		color: rgb(var(--color-surface-100));
	}

	.path-actions {
		display: flex;
		gap: 0.5rem;
	}

	.path-btn {
		padding: 0.4rem 0.7rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-50));
		color: rgb(var(--color-surface-800));
		font-size: 0.875rem;
		font-weight: 600;
	}

	:global([data-mode='dark']) .path-btn {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-700));
		color: rgb(var(--color-surface-100));
	}

	.path-error {
		font-size: 0.75rem;
		color: rgb(var(--color-error-500));
	}

	.note-fab {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 60;
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.note-fab:hover {
		background-color: rgb(var(--color-primary-600));
	}

	/* Editor header */
	.editor-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		min-height: 3rem;
		flex-shrink: 0;
	}

	:global([data-mode='dark']) .editor-header {
		background-color: rgb(var(--color-surface-800));
		border-bottom-color: rgb(var(--color-surface-600));
	}

	.header-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		flex-shrink: 0;
		border-radius: 0.375rem;
		color: rgb(var(--color-surface-600));
	}

	:global([data-mode='dark']) .header-btn {
		color: rgb(var(--color-surface-400));
	}

	.header-btn:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .header-btn:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.header-btn :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}

	.save-btn {
		color: rgb(var(--color-primary-500));
	}

	.save-btn:disabled {
		opacity: 0.5;
	}

	.header-filename {
		flex: 1;
		min-width: 0;
		font-weight: 600;
		font-size: 0.9375rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: rgb(var(--color-surface-800));
	}

	:global([data-mode='dark']) .header-filename {
		color: rgb(var(--color-surface-200));
	}

	.header-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	/* Editor content area */
	.editor-content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding-bottom: 3.5rem;
	}

	/* Milkdown editor host */
	.milkdown-host {
		min-height: 100%;
		padding: 1rem;
	}

	/* ProseMirror base styles */
	:global(.milkdown-host .milkdown) {
		outline: none;
	}

	:global(.milkdown-host .milkdown .editor) {
		outline: none;
		min-height: 50vh;
	}

	:global(.milkdown-host .ProseMirror) {
		outline: none;
		font-size: 1rem;
		line-height: 1.6;
		color: rgb(var(--color-surface-800));
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror) {
		color: rgb(var(--color-surface-200));
	}

	:global(.milkdown-host .ProseMirror p) {
		margin: 0.5em 0;
	}

	:global(.milkdown-host .ProseMirror h1) {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 1em 0 0.5em;
		line-height: 1.2;
	}

	:global(.milkdown-host .ProseMirror h2) {
		font-size: 1.375rem;
		font-weight: 600;
		margin: 0.875em 0 0.4em;
		line-height: 1.3;
	}

	:global(.milkdown-host .ProseMirror h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0.75em 0 0.3em;
		line-height: 1.35;
	}

	:global(.milkdown-host .ProseMirror ul),
	:global(.milkdown-host .ProseMirror ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	:global(.milkdown-host .ProseMirror li) {
		margin: 0.25em 0;
	}

	:global(.milkdown-host .ProseMirror blockquote) {
		border-left: 3px solid rgb(var(--color-surface-300));
		padding-left: 1em;
		margin: 0.5em 0;
		color: rgb(var(--color-surface-600));
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror blockquote) {
		border-left-color: rgb(var(--color-surface-600));
		color: rgb(var(--color-surface-400));
	}

	:global(.milkdown-host .ProseMirror code) {
		background-color: rgb(var(--color-surface-200));
		padding: 0.15em 0.35em;
		border-radius: 0.25em;
		font-size: 0.875em;
		font-family: ui-monospace, monospace;
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror code) {
		background-color: rgb(var(--color-surface-700));
	}

	:global(.milkdown-host .ProseMirror pre) {
		background-color: rgb(var(--color-surface-200));
		padding: 1em;
		border-radius: 0.5em;
		overflow-x: auto;
		margin: 0.75em 0;
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror pre) {
		background-color: rgb(var(--color-surface-800));
	}

	:global(.milkdown-host .ProseMirror pre code) {
		background: none;
		padding: 0;
	}

	:global(.milkdown-host .ProseMirror hr) {
		border: none;
		border-top: 1px solid rgb(var(--color-surface-300));
		margin: 1.5em 0;
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror hr) {
		border-top-color: rgb(var(--color-surface-600));
	}

	:global(.milkdown-host .ProseMirror a) {
		color: rgb(var(--color-primary-500));
		text-decoration: underline;
	}

	:global(.milkdown-host .ProseMirror strong) {
		font-weight: 700;
	}

	:global(.milkdown-host .ProseMirror em) {
		font-style: italic;
	}

	:global(.milkdown-host .ProseMirror table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.75em 0;
	}

	:global(.milkdown-host .ProseMirror th),
	:global(.milkdown-host .ProseMirror td) {
		border: 1px solid rgb(var(--color-surface-300));
		padding: 0.5em 0.75em;
		text-align: left;
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror th),
	:global([data-mode='dark'] .milkdown-host .ProseMirror td) {
		border-color: rgb(var(--color-surface-600));
	}

	:global(.milkdown-host .ProseMirror th) {
		font-weight: 600;
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark'] .milkdown-host .ProseMirror th) {
		background-color: rgb(var(--color-surface-800));
	}

	/* Preview pane */
	.preview-pane {
		min-height: 100%;
		padding: 1rem;
		font-size: 1rem;
		line-height: 1.6;
		color: rgb(var(--color-surface-800));
	}

	.hidden {
		display: none;
	}

	:global([data-mode='dark']) .preview-pane {
		color: rgb(var(--color-surface-200));
	}

	:global(.preview-pane h1) {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 1em 0 0.5em;
	}

	:global(.preview-pane h2) {
		font-size: 1.375rem;
		font-weight: 600;
		margin: 0.875em 0 0.4em;
	}

	:global(.preview-pane h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0.75em 0 0.3em;
	}

	:global(.preview-pane p) {
		margin: 0.5em 0;
	}

	:global(.preview-pane ul),
	:global(.preview-pane ol) {
		padding-left: 1.5em;
		margin: 0.5em 0;
	}

	:global(.preview-pane blockquote) {
		border-left: 3px solid rgb(var(--color-surface-300));
		padding-left: 1em;
		margin: 0.5em 0;
		color: rgb(var(--color-surface-600));
	}

	:global(.preview-pane code) {
		background-color: rgb(var(--color-surface-200));
		padding: 0.15em 0.35em;
		border-radius: 0.25em;
		font-size: 0.875em;
		font-family: ui-monospace, monospace;
	}

	:global([data-mode='dark'] .preview-pane code) {
		background-color: rgb(var(--color-surface-700));
	}

	:global(.preview-pane pre) {
		background-color: rgb(var(--color-surface-200));
		padding: 1em;
		border-radius: 0.5em;
		overflow-x: auto;
	}

	:global([data-mode='dark'] .preview-pane pre) {
		background-color: rgb(var(--color-surface-800));
	}

	:global(.preview-pane pre code) {
		background: none;
		padding: 0;
	}

	:global(.preview-pane hr) {
		border: none;
		border-top: 1px solid rgb(var(--color-surface-300));
		margin: 1.5em 0;
	}

	:global(.preview-pane a) {
		color: rgb(var(--color-primary-500));
		text-decoration: underline;
	}

	:global(.preview-pane table) {
		border-collapse: collapse;
		width: 100%;
		margin: 0.75em 0;
	}

	:global(.preview-pane th),
	:global(.preview-pane td) {
		border: 1px solid rgb(var(--color-surface-300));
		padding: 0.5em 0.75em;
	}

	:global(.preview-pane th) {
		font-weight: 600;
		background-color: rgb(var(--color-surface-100));
	}

	:global(.preview-pane img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.375rem;
	}
</style>
