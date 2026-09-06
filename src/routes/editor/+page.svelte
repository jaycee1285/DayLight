<script lang="ts">
	import { goto } from '$app/navigation';
	import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
	import { join } from '@tauri-apps/api/path';
	import { renderMarkdown, hasExtendedTables } from '$lib/markdown';
	import { createEditor, type EditorHandle } from '$lib/editor/milkdown-adapter';
	import EditorToolbar from '$lib/editor/EditorToolbar.svelte';
	import FileBrowser from '$lib/editor/FileBrowser.svelte';
	import { getDataPath } from '$lib/storage/storage';
	import { parseMarkdown } from '$lib/storage/frontmatter';
	import { markdownStore, updateTaskWithBody } from '$lib/stores/markdown-store.svelte';
	import IconChevronLeft from '~icons/lucide/chevron-left';
	import IconSave from '~icons/lucide/save';
	import IconPlus from '~icons/lucide/plus';
	import IconFolderSearch from '~icons/lucide/folder-search';
	import IconX from '~icons/lucide/x';
	import IconHistory from '~icons/lucide/history';

type View = 'browser' | 'editor' | 'preview';
const EDITOR_PATH_KEY = 'daylight-editor-path';
const FERRITE_DIR = '.ferrite';
const FERRITE_STATE = 'state.json';
const MAX_RECENT = 20;

interface FerriteState {
	recent_files: string[];
	expanded_paths: string[];
	file_tree_width: number;
	show_file_tree: boolean;
}

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
// Decided at file-open time from content: extended-table files edit as raw text
// (milkdown would corrupt the grammar); everything else uses milkdown. Computed
// once on open, not reactively, so typing a table mid-edit doesn't yank the
// surface out from under you.
let rawEdit = $state(false);
let showUnsavedDialog = $state(false);
let pendingNavAction: (() => void) | null = null;
let showCommandDrawer = $state(false);
let showToolbar = $state(false);
let swipeStartY = $state(0);
let swipeStartX = $state(0);
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
	let showRecentFiles = $state(false);
	let recentFiles = $state<string[]>([]);

	async function readFerriteState(): Promise<FerriteState | null> {
		try {
			const statePath = await join(basePath, FERRITE_DIR, FERRITE_STATE);
			if (!(await exists(statePath))) return null;
			const content = await readTextFile(statePath);
			return JSON.parse(content) as FerriteState;
		} catch {
			return null;
		}
	}

	async function writeFerriteState(state: FerriteState): Promise<void> {
		try {
			const dirPath = await join(basePath, FERRITE_DIR);
			const { mkdir } = await import('@tauri-apps/plugin-fs');
			try { await mkdir(dirPath); } catch { /* already exists */ }
			const statePath = await join(dirPath, FERRITE_STATE);
			await writeTextFile(statePath, JSON.stringify(state, null, 2));
		} catch (e) {
			console.error('Failed to write .ferrite/state.json:', e);
		}
	}

	async function loadRecentFiles(): Promise<void> {
		const state = await readFerriteState();
		recentFiles = state?.recent_files ?? [];
	}

	async function trackRecentFile(absolutePath: string): Promise<void> {
		let state = await readFerriteState();
		if (!state) {
			state = {
				recent_files: [],
				expanded_paths: [basePath],
				file_tree_width: 250.0,
				show_file_tree: true
			};
		}
		// Remove if already in list, then prepend
		state.recent_files = state.recent_files.filter((f) => f !== absolutePath);
		state.recent_files.unshift(absolutePath);
		// Cap at MAX_RECENT to match Ferrite's behavior
		if (state.recent_files.length > MAX_RECENT) {
			state.recent_files = state.recent_files.slice(0, MAX_RECENT);
		}
		await writeFerriteState(state);
		recentFiles = state.recent_files;
	}

	function recentFileDisplayName(absolutePath: string): string {
		const parts = absolutePath.split('/');
		const filename = parts.at(-1) ?? absolutePath;
		return filename.replace(/\.md$/, '');
	}

	function recentFileRelativePath(absolutePath: string): string | null {
		if (!absolutePath.startsWith(basePath)) return null;
		let rel = absolutePath.slice(basePath.length);
		if (rel.startsWith('/')) rel = rel.slice(1);
		return rel;
	}

	async function openRecentFile(absolutePath: string): Promise<void> {
		showRecentFiles = false;
		const rel = recentFileRelativePath(absolutePath);
		if (!rel) return;
		const filename = absolutePath.split('/').at(-1) ?? '';
		// Check file still exists
		try {
			if (!(await exists(absolutePath))) return;
		} catch { return; }
		await openFile(rel, filename);
	}

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

	// Make the raw textarea auto-grow to its content, the way milkdown's
	// contenteditable does — so .main-content (the page) owns the scroll and the
	// textarea fills naturally instead of needing a hardcoded viewport height.
	// The min-height:50vh floor (milkdown's value) covers empty/short files.
	function autogrow(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		return {
			// Re-fit when the bound value changes from outside (e.g. file open).
			update: () => resize(),
			destroy: () => node.removeEventListener('input', resize)
		};
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

	// Load recent files whenever basePath is set/changed
	$effect(() => {
		if (basePath) {
			void loadRecentFiles();
		}
	});

	$effect(() => {
		function handleBeforeUnload(e: BeforeUnloadEvent) {
			if (dirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		}
		function handleKeydown(e: KeyboardEvent) {
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault();
				if (dirty && !saving) saveFile();
			}
			if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
				e.preventDefault();
				showCommandDrawer = !showCommandDrawer;
			}
			// Ctrl/Cmd-E toggles preview ↔ edit. togglePreview hides whichever edit
			// surface is mounted (milkdown WYSIWYG, or the raw textarea for
			// extended-table files) and shows the preview pane, so it handles both
			// modes without branching. stopPropagation so the layout's Ctrl-E
			// (go-to-editor) doesn't also fire.
			if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
				e.preventDefault();
				e.stopPropagation();
				togglePreview();
			}
		}
		window.addEventListener('beforeunload', handleBeforeUnload);
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			window.removeEventListener('keydown', handleKeydown);
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
			rawEdit = hasExtendedTables(content);
			view = 'editor';

			// Track in .ferrite/state.json for cross-app history
			trackRecentFile(fullPath);

			// Mount editor after DOM updates
			await mountEditor();
		} catch (e) {
			console.error('Failed to open file:', e);
		}
	}

	async function mountEditor() {
		// Extended-table files edit as raw text — no milkdown to corrupt the
		// grammar. The textarea binds currentMarkdown directly (see template).
		if (rawEdit) {
			editorHandle?.destroy();
			editorHandle = null;
			return;
		}

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

	function guardedNav(action: () => void) {
		if (dirty) {
			pendingNavAction = action;
			showUnsavedDialog = true;
		} else {
			action();
		}
	}

	function confirmDiscard() {
		showUnsavedDialog = false;
		dirty = false;
		const action = pendingNavAction;
		pendingNavAction = null;
		action?.();
	}

	async function confirmSaveAndGo() {
		showUnsavedDialog = false;
		await saveFile();
		const action = pendingNavAction;
		pendingNavAction = null;
		action?.();
	}

	function cancelNav() {
		showUnsavedDialog = false;
		pendingNavAction = null;
	}

	function doGoBack() {
		editorHandle?.destroy();
		editorHandle = null;
		view = 'browser';
		previewing = false;
	}

	function goBack() {
		if (view === 'editor' || view === 'preview') {
			guardedNav(doGoBack);
		}
	}

function togglePreview() {
	previewing = !previewing;
}

function handleEditorTouchStart(e: TouchEvent) {
	const touch = e.touches[0];
	swipeStartY = touch.clientY;
	swipeStartX = touch.clientX;
}

function handleEditorTouchEnd(e: TouchEvent) {
	const touch = e.changedTouches[0];
	const deltaY = swipeStartY - touch.clientY;
	const deltaX = touch.clientX - swipeStartX;
	const absDeltaX = Math.abs(deltaX);
	const absDeltaY = Math.abs(deltaY);

	// Swipe up from bottom area → toggle toolbar
	if (deltaY > 60 && absDeltaY > absDeltaX && swipeStartY > window.innerHeight - 80) {
		showToolbar = true;
	}
	// Swipe down near bottom → hide toolbar
	if (deltaY < -60 && absDeltaY > absDeltaX && showToolbar) {
		showToolbar = false;
	}
	// Swipe left (finger moves right-to-left from right edge) → open command drawer
	if (deltaX < -60 && absDeltaX > absDeltaY && swipeStartX > window.innerWidth - 40) {
		showCommandDrawer = true;
	}
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
	void loadRecentFiles();
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
			<!-- Recent files FAB -->
			{#if recentFiles.length > 0}
				<button
					type="button"
					class="recent-fab"
					onclick={() => (showRecentFiles = !showRecentFiles)}
					aria-label="Recent files"
				>
					<IconHistory width="22" height="22" />
				</button>
			{/if}
			<!-- Recent files popup -->
			{#if showRecentFiles}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="recent-popup-overlay" onclick={() => (showRecentFiles = false)}>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="recent-popup" onclick={(e) => e.stopPropagation()}>
						{#each recentFiles.slice(0, 3) as filePath}
							{@const rel = recentFileRelativePath(filePath)}
							{#if rel}
								<button
									type="button"
									class="recent-item"
									onclick={() => openRecentFile(filePath)}
								>
									<span class="recent-item-name">{recentFileDisplayName(filePath)}</span>
									<span class="recent-item-path">{rel.split('/').slice(0, -1).join('/') || '/'}</span>
								</button>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
			<!-- Add note FAB -->
			<button
				type="button"
				class="note-fab"
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
					<span class="dirty-indicator" title="Unsaved changes"></span>
				{/if}
			</div>
		</div>

		<!-- Editor area -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="editor-content"
			class:toolbar-visible={showToolbar}
			ontouchstart={handleEditorTouchStart}
			ontouchend={handleEditorTouchEnd}
		>
			{#if rawEdit}
				<textarea
					class="raw-editor"
					class:hidden={previewing}
					spellcheck="false"
					bind:value={currentMarkdown}
					use:autogrow={currentMarkdown}
					oninput={() => (dirty = currentMarkdown !== originalContent)}
				></textarea>
			{:else}
				<div class="milkdown-host" class:hidden={previewing} bind:this={editorRoot}></div>
			{/if}
			<div class="preview-pane" class:hidden={!previewing}>
				{@html renderedHtml}
			</div>
		</div>

		<!-- Toolbar (collapsible) -->
		{#if showToolbar}
			<EditorToolbar editor={editorHandle} onTogglePreview={togglePreview} {previewing} />
		{/if}

		<!-- Floating save FAB — shifts up when toolbar visible -->
		{#if dirty}
			<button
				type="button"
				class="save-fab"
				class:save-fab-toolbar-visible={showToolbar}
				onclick={saveFile}
				disabled={saving}
				aria-label="Save file"
			>
				<IconSave width="22" height="22" />
			</button>
		{/if}

		<!-- Swipe-up hint bar (visible when toolbar hidden) -->
		{#if !showToolbar}
			<div class="toolbar-hint" onclick={() => (showToolbar = true)} role="button" tabindex="-1">
				<div class="toolbar-hint-pill"></div>
			</div>
		{/if}

		<!-- Command drawer (swipe-in from right / Ctrl+M) -->
		{#if showCommandDrawer}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="command-drawer-overlay" onclick={() => (showCommandDrawer = false)}>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="command-drawer" onclick={(e) => e.stopPropagation()}>
					<div class="command-drawer-header">
						<span class="command-drawer-title">{currentFileName.replace(/\.md$/, '')}</span>
						<button type="button" class="header-btn" onclick={() => (showCommandDrawer = false)} aria-label="Close">
							<IconX />
						</button>
					</div>
					<button
						type="button"
						class="command-row"
						onclick={() => { saveFile(); showCommandDrawer = false; }}
						disabled={!dirty || saving}
					>
						<IconSave width="20" height="20" />
						<span>Save</span>
						{#if dirty}<span class="command-hint">unsaved</span>{/if}
					</button>
					<button
						type="button"
						class="command-row"
						onclick={() => { showCommandDrawer = false; goBack(); }}
					>
						<IconFolderSearch width="20" height="20" />
						<span>Back to files</span>
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if showUnsavedDialog}
	<div
		class="folder-dialog-overlay"
		role="button"
		tabindex="0"
		aria-label="Close unsaved changes dialog"
		onclick={cancelNav}
		onkeydown={(e) => closeOnOverlayKey(e, cancelNav)}
	>
		<div class="folder-dialog" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<div class="folder-dialog-title">Unsaved Changes</div>
			<p class="unsaved-message">You have unsaved changes. What would you like to do?</p>
			<div class="path-actions">
				<button type="button" class="path-btn save-action-btn" onclick={confirmSaveAndGo}>Save</button>
				<button type="button" class="path-btn discard-action-btn" onclick={confirmDiscard}>Discard</button>
				<button type="button" class="path-btn" onclick={cancelNav}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

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
		align-items: center;
		justify-content: center;
		padding: 1rem;
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
		bottom: calc(1rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
		z-index: 60;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.note-fab:hover {
		background-color: rgb(var(--color-primary-600));
	}

	.recent-fab {
		position: fixed;
		right: 1rem;
		bottom: calc(5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
		z-index: 60;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--color-surface-700));
		border: 1px solid rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .recent-fab {
		background-color: rgb(var(--color-surface-800));
		color: rgb(var(--color-surface-300));
		border-color: rgb(var(--color-surface-600));
	}

	.recent-fab:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .recent-fab:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.recent-popup-overlay {
		position: fixed;
		inset: 0;
		z-index: 65;
	}

	.recent-popup {
		position: fixed;
		right: 1rem;
		bottom: calc(8.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
		z-index: 66;
		width: min(18rem, calc(100vw - 2rem));
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.75rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		overflow: hidden;
		animation: recent-slide-up 0.15s ease-out;
	}

	:global([data-mode='dark']) .recent-popup {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}

	@keyframes recent-slide-up {
		from { opacity: 0; transform: translateY(0.5rem); }
		to { opacity: 1; transform: translateY(0); }
	}

	.recent-item {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 0.75rem 1rem;
		text-align: left;
		border-bottom: 1px solid rgb(var(--color-surface-200));
		color: rgb(var(--color-surface-800));
	}

	:global([data-mode='dark']) .recent-item {
		border-bottom-color: rgb(var(--color-surface-700));
		color: rgb(var(--color-surface-100));
	}

	.recent-item:last-child {
		border-bottom: none;
	}

	.recent-item:hover {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.recent-item:hover .recent-item-path {
		color: rgb(var(--color-on-primary));
		opacity: 0.75;
	}

	.recent-item-name {
		font-weight: 600;
		font-size: 0.9375rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.recent-item-path {
		font-size: 0.75rem;
		color: rgb(var(--color-surface-500));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 0.125rem;
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

	.dirty-indicator {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background-color: rgb(var(--color-warning-500));
		margin-right: 0.25rem;
	}

	.save-fab {
		position: fixed;
		right: 1rem;
		bottom: calc(1.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
		z-index: 55;
		transition: bottom 0.2s ease;
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
	}

	.save-fab:hover {
		background-color: rgb(var(--color-primary-600));
	}

	.save-fab:disabled {
		opacity: 0.5;
	}

	.save-fab-toolbar-visible {
		bottom: calc(4rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
	}

	.unsaved-message {
		font-size: 0.875rem;
		color: rgb(var(--color-surface-600));
		margin: 0;
	}

	:global([data-mode='dark']) .unsaved-message {
		color: rgb(var(--color-surface-400));
	}

	.save-action-btn {
		background-color: rgb(var(--color-primary-500)) !important;
		color: rgb(var(--color-on-primary)) !important;
		border-color: rgb(var(--color-primary-500)) !important;
	}

	.discard-action-btn {
		color: rgb(var(--color-error-500)) !important;
		border-color: rgb(var(--color-error-500)) !important;
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
		padding-bottom: calc(1.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
		transition: padding-bottom 0.2s ease;
	}

	.editor-content.toolbar-visible {
		padding-bottom: calc(3.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px)));
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

	/* Raw-text edit surface for extended-table files (milkdown would corrupt the
	   grammar on reserialize). Plain textarea, no syntax highlighting by design.

	   Height is driven by the `autogrow` action (JS sets height = scrollHeight on
	   input/open), so the textarea grows with its content exactly like milkdown's
	   contenteditable and .main-content (the page) owns the scroll. CSS only sets
	   the floor for empty/short files — min-height:50vh, milkdown's own value.
	   overflow:hidden so the textarea never shows its own scrollbar (the page
	   scrolls); resize:none so the JS-set height isn't fought by the drag handle. */
	.raw-editor {
		display: block;
		width: 100%;
		min-height: 50vh;
		overflow: hidden;
		resize: none;
		border: none;
		outline: none;
		background: transparent;
		color: rgb(var(--color-surface-900));
		padding: 1rem;
		font-family: ui-monospace, 'Cascadia Code', monospace;
		font-size: 0.95rem;
		line-height: 1.55;
		tab-size: 2;
	}

	/* .raw-editor sets display:block, which (same specificity, defined later) would
	   override the shared .hidden rule and keep the textarea visible during preview.
	   This higher-specificity rule restores hiding when previewing. */
	.raw-editor.hidden {
		display: none;
	}

	:global([data-mode='dark']) .raw-editor {
		color: rgb(var(--color-surface-100));
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

	/* Toolbar hint bar */
	.toolbar-hint {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 45;
		display: flex;
		justify-content: center;
		padding: 0.375rem 0;
		padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px));
		cursor: pointer;
	}

	.toolbar-hint-pill {
		width: 2.5rem;
		height: 0.25rem;
		border-radius: 0.125rem;
		background-color: rgb(var(--color-surface-400));
		opacity: 0.6;
	}

	/* Command drawer (bottom sheet) */
	.command-drawer-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(0, 0, 0, 0.35);
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.command-drawer {
		width: min(28rem, 100%);
		background-color: rgb(var(--color-surface-50));
		border-top: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.75rem 0.75rem 0 0;
		display: flex;
		flex-direction: column;
		padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback, 0px));
		animation: sheet-slide-up 0.2s ease-out;
	}

	:global([data-mode='dark']) .command-drawer {
		background-color: rgb(var(--color-surface-900));
		border-top-color: rgb(var(--color-surface-600));
	}

	@keyframes sheet-slide-up {
		from { transform: translateY(100%); }
		to { transform: translateY(0); }
	}

	.command-drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .command-drawer-header {
		border-bottom-color: rgb(var(--color-surface-700));
	}

	.command-drawer-title {
		font-weight: 600;
		font-size: 0.9375rem;
		color: rgb(var(--color-surface-800));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global([data-mode='dark']) .command-drawer-title {
		color: rgb(var(--color-surface-200));
	}

	.command-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-bottom: 1px solid rgb(var(--color-surface-200));
		color: rgb(var(--color-surface-800));
		text-align: left;
		font-size: 0.9375rem;
	}

	:global([data-mode='dark']) .command-row {
		border-bottom-color: rgb(var(--color-surface-700));
		color: rgb(var(--color-surface-100));
	}

	.command-row:disabled {
		opacity: 0.4;
	}

	.command-row:hover:not(:disabled) {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .command-row:hover:not(:disabled) {
		background-color: rgb(var(--color-surface-800));
	}

	.command-hint {
		margin-left: auto;
		font-size: 0.75rem;
		color: rgb(var(--color-warning-500));
		font-weight: 600;
	}
</style>
