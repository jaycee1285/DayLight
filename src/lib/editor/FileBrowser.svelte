<script lang="ts">
	import { exists, mkdir, readDir, remove, rename, stat } from '@tauri-apps/plugin-fs';
	import { join } from '@tauri-apps/api/path';
	import IconFolder from '~icons/lucide/folder';
	import IconFile from '~icons/lucide/file-text';
	import IconChevronLeft from '~icons/lucide/chevron-left';
	import IconFolderOpen from '~icons/lucide/folder-open';
	import IconFolderPlus from '~icons/lucide/folder-plus';
	import IconSearch from '~icons/lucide/search';
	import IconPencil from '~icons/lucide/pencil';
	import IconTrash2 from '~icons/lucide/trash-2';
	import IconMoveRight from '~icons/lucide/move-right';
	import SearchDialog from './SearchDialog.svelte';
	import { invalidateEditorSearch, type EditorSearchResult } from './search-index';

	interface Props {
		basePath: string;
		onFileSelect: (filePath: string, fileName: string) => void;
		compactHeader?: boolean;
		onExit?: () => void;
		onOpenFolderDialog?: () => void;
		onDirectoryChange?: (relativePath: string) => void;
	}

	let {
		basePath,
		onFileSelect,
		compactHeader = false,
		onExit,
		onOpenFolderDialog,
		onDirectoryChange
	}: Props = $props();

	type Entry = {
		name: string;
		path: string;
		isDir: boolean;
	};

	let currentPath = $state('');
	let entries = $state<Entry[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showActionSheet = $state(false);
	let actionTarget = $state<Entry | null>(null);
	let showDeleteDialog = $state(false);
	let deleting = $state(false);
	let deleteTarget = $state<Entry | null>(null);
	let showRenameDialog = $state(false);
	let renameValue = $state('');
	let renameError = $state<string | null>(null);
	let renaming = $state(false);
	let showMoveDialog = $state(false);
	let movePickerPath = $state('');
	let moveFolders = $state<Array<{ name: string; path: string }>>([]);
	let moveFoldersLoading = $state(false);
	let moveError = $state<string | null>(null);
	let moving = $state(false);
	let showCreateFolderDialog = $state(false);
	let createFolderValue = $state('');
	let createFolderError = $state<string | null>(null);
	let creatingFolder = $state(false);
	let showSearchDialog = $state(false);
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let suppressNextClick = $state(false);

	const breadcrumbs = $derived(() => {
		if (!currentPath) return [{ label: 'Root', path: '' }];
		const parts = currentPath.split('/').filter(Boolean);
		const crumbs = [{ label: 'Root', path: '' }];
		let accumulated = '';
		for (const part of parts) {
			accumulated = accumulated ? `${accumulated}/${part}` : part;
			crumbs.push({ label: part, path: accumulated });
		}
		return crumbs;
	});

	async function loadDir(relativePath: string) {
		loading = true;
		error = null;
		try {
			const fullPath = relativePath
				? await join(basePath, relativePath)
				: basePath;
			const rawEntries = await readDir(fullPath);

			const mapped: Entry[] = [];
			for (const entry of rawEntries) {
				if (!entry.name) continue;
				// Skip hidden files and non-markdown files (unless directory)
				if (entry.name.startsWith('.')) continue;

				const entryPath = relativePath
					? `${relativePath}/${entry.name}`
					: entry.name;

				const entryFullPath = await join(fullPath, entry.name);
				let isDir = false;
				try {
					const s = await stat(entryFullPath);
					isDir = s.isDirectory;
				} catch {
					// If stat fails, check by extension
					isDir = !entry.name.includes('.');
				}

				if (!isDir && !entry.name.endsWith('.md')) continue;

				mapped.push({
					name: entry.name,
					path: entryPath,
					isDir
				});
			}

			// Sort: folders first, then alphabetical
			mapped.sort((a, b) => {
				if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
				return a.name.localeCompare(b.name);
			});

			entries = mapped;
			currentPath = relativePath;
			onDirectoryChange?.(relativePath);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			entries = [];
		} finally {
			loading = false;
		}
	}

	const currentDirName = $derived(() => {
		const parts = currentPath.split('/').filter(Boolean);
		if (parts.length > 0) return parts.at(-1) ?? '';

		const baseParts = basePath.split('/').filter(Boolean);
		return baseParts.at(-1) ?? 'Root';
	});

	function navigateUp() {
		const parts = currentPath.split('/').filter(Boolean);
		parts.pop();
		loadDir(parts.join('/'));
	}

	function handleEntryClick(entry: Entry) {
		if (suppressNextClick) {
			suppressNextClick = false;
			return;
		}
		if (entry.isDir) {
			loadDir(entry.path);
		} else {
			onFileSelect(entry.path, entry.name);
		}
	}

	function openDeletePrompt(entry: Entry) {
		showActionSheet = false;
		deleteTarget = entry;
		showDeleteDialog = true;
	}

	function openActionMenu(entry: Entry) {
		actionTarget = entry;
		showActionSheet = true;
	}

	function handleEntryContextMenu(event: MouseEvent, entry: Entry) {
		event.preventDefault();
		openActionMenu(entry);
	}

	function handleEntryPointerDown(event: PointerEvent, entry: Entry) {
		if (event.pointerType !== 'touch') return;

		if (longPressTimer) clearTimeout(longPressTimer);
		longPressTimer = setTimeout(() => {
			suppressNextClick = true;
			openActionMenu(entry);
		}, 550);
	}

	function clearLongPressTimer() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	async function confirmDelete() {
		if (!deleteTarget || deleting) return;
		deleting = true;
		try {
			const fullPath = await join(basePath, deleteTarget.path);
			await remove(fullPath, { recursive: deleteTarget.isDir });
			invalidateEditorSearch(basePath);
			showDeleteDialog = false;
			deleteTarget = null;
			await loadDir(currentPath);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			deleting = false;
		}
	}

	function normalizeName(value: string): string {
		const stripped = value.trim().replace(/[\\/]/g, '');
		return stripped;
	}

	function normalizeTargetName(value: string, isDir: boolean): string {
		const stripped = normalizeName(value);
		if (isDir) return stripped;
		return stripped.toLowerCase().endsWith('.md') ? stripped : `${stripped}.md`;
	}

	function getEntryLabel(entry: Entry | null): string {
		if (!entry) return 'item';
		return entry.isDir ? 'folder' : 'note';
	}

	function startRename() {
		if (!actionTarget) return;
		showActionSheet = false;
		renameError = null;
		renameValue = actionTarget.isDir ? actionTarget.name : actionTarget.name.replace(/\.md$/i, '');
		showRenameDialog = true;
	}

	async function confirmRename() {
		if (!actionTarget || renaming) return;
		const targetName = normalizeTargetName(renameValue, actionTarget.isDir);
		if (!targetName || targetName === '.md') {
			renameError = `Enter a valid ${getEntryLabel(actionTarget)} name.`;
			return;
		}

		const currentParts = actionTarget.path.split('/');
		currentParts.pop();
		const parentPath = currentParts.join('/');
		const nextRelative = parentPath ? `${parentPath}/${targetName}` : targetName;

		renaming = true;
		try {
			const src = await join(basePath, actionTarget.path);
			const dst = await join(basePath, nextRelative);
			if (src !== dst && await exists(dst)) {
				renameError = `A ${getEntryLabel(actionTarget)} with that name already exists.`;
				return;
			}
			if (src !== dst) {
				await rename(src, dst);
				invalidateEditorSearch(basePath);
			}
			showRenameDialog = false;
			actionTarget = null;
			await loadDir(currentPath);
		} catch (e) {
			renameError = e instanceof Error ? e.message : String(e);
		} finally {
			renaming = false;
		}
	}

	function startMove() {
		if (!actionTarget) return;
		showActionSheet = false;
		moveError = null;
		movePickerPath = currentPath;
		showMoveDialog = true;
		void loadMoveFolders(movePickerPath);
	}

	async function loadMoveFolders(relativePath: string) {
		moveFoldersLoading = true;
		moveError = null;
		try {
			const fullPath = relativePath ? await join(basePath, relativePath) : basePath;
			const rawEntries = await readDir(fullPath);
			const folders: Array<{ name: string; path: string }> = [];

			for (const entry of rawEntries) {
				if (!entry.name) continue;
				if (entry.name.startsWith('.')) continue;
				const entryFullPath = await join(fullPath, entry.name);
				let isDir = false;
				try {
					const s = await stat(entryFullPath);
					isDir = s.isDirectory;
				} catch {
					isDir = false;
				}
				if (!isDir) continue;

				const path = relativePath ? `${relativePath}/${entry.name}` : entry.name;
				folders.push({ name: entry.name, path });
			}

			folders.sort((a, b) => a.name.localeCompare(b.name));
			moveFolders = folders;
			movePickerPath = relativePath;
		} catch (e) {
			moveError = e instanceof Error ? e.message : String(e);
			moveFolders = [];
		} finally {
			moveFoldersLoading = false;
		}
	}

	function moveNavigateUp() {
		const parts = movePickerPath.split('/').filter(Boolean);
		parts.pop();
		void loadMoveFolders(parts.join('/'));
	}

	function moveOpenFolder(path: string) {
		void loadMoveFolders(path);
	}

	async function confirmMove() {
		if (!actionTarget || moving) return;
		const normalizedTarget = movePickerPath.trim().replace(/^\/+|\/+$/g, '');
		const destinationRelative = normalizedTarget ? `${normalizedTarget}/${actionTarget.name}` : actionTarget.name;
		if (destinationRelative === actionTarget.path) {
			showMoveDialog = false;
			return;
		}
		if (actionTarget.isDir) {
			const actionBase = actionTarget.path.trim().replace(/^\/+|\/+$/g, '');
			if (normalizedTarget === actionBase || normalizedTarget.startsWith(`${actionBase}/`)) {
				moveError = 'Cannot move a folder into itself.';
				return;
			}
		}

		moving = true;
		try {
			const src = await join(basePath, actionTarget.path);
			const dest = await join(basePath, destinationRelative);
			if (await exists(dest)) {
				moveError = `A ${getEntryLabel(actionTarget)} with that name already exists in target folder.`;
				return;
			}

			if (normalizedTarget) {
				const destinationDir = await join(basePath, normalizedTarget);
				await mkdir(destinationDir, { recursive: true });
			}

			await rename(src, dest);
			invalidateEditorSearch(basePath);
			showMoveDialog = false;
			actionTarget = null;
			await loadDir(currentPath);
		} catch (e) {
			moveError = e instanceof Error ? e.message : String(e);
		} finally {
			moving = false;
		}
	}

	function startCreateFolder() {
		createFolderError = null;
		createFolderValue = '';
		showCreateFolderDialog = true;
	}

	async function confirmCreateFolder() {
		const folderName = normalizeName(createFolderValue);
		if (!folderName) {
			createFolderError = 'Enter a valid folder name.';
			return;
		}

		const nextRelative = currentPath ? `${currentPath}/${folderName}` : folderName;
		creatingFolder = true;
		createFolderError = null;
		try {
			const fullPath = await join(basePath, nextRelative);
			if (await exists(fullPath)) {
				createFolderError = 'A folder or note with that name already exists.';
				return;
			}
			await mkdir(fullPath, { recursive: false });
			invalidateEditorSearch(basePath);
			showCreateFolderDialog = false;
			await loadDir(currentPath);
		} catch (e) {
			createFolderError = e instanceof Error ? e.message : String(e);
		} finally {
			creatingFolder = false;
		}
	}

	// Load root on mount
	$effect(() => {
		if (basePath) {
			invalidateEditorSearch(basePath);
			loadDir('');
		}
	});

	function handleSearchSelect(result: EditorSearchResult) {
		onFileSelect(result.path, `${result.name}.md`);
	}
</script>

<div class="file-browser">
	<div class="browser-header">
		{#if compactHeader}
			<button type="button" class="back-btn" onclick={onExit} aria-label="Back to today">
				<IconChevronLeft />
			</button>

			<div class="browser-title">
				{#if currentDirName()}
					<button type="button" class="crumb crumb-current" onclick={navigateUp}>
						{currentDirName()}
					</button>
				{/if}
			</div>

			<button type="button" class="back-btn" onclick={onOpenFolderDialog} aria-label="Change folder">
				<IconFolderOpen />
			</button>
		{:else}
			{#if currentPath}
				<button type="button" class="back-btn" onclick={navigateUp} aria-label="Go back">
					<IconChevronLeft />
				</button>
			{/if}
			<div class="breadcrumbs">
				{#each breadcrumbs() as crumb, i}
					{#if i > 0}<span class="crumb-sep">/</span>{/if}
					<button
						type="button"
						class="crumb"
						class:crumb-current={i === breadcrumbs().length - 1}
						onclick={() => loadDir(crumb.path)}
					>
						{crumb.label}
					</button>
				{/each}
			</div>
		{/if}
		<button type="button" class="back-btn" onclick={() => (showSearchDialog = true)} aria-label="Search notes">
			<IconSearch />
		</button>
		<button type="button" class="back-btn" onclick={startCreateFolder} aria-label="Create folder">
			<IconFolderPlus />
		</button>
	</div>

	<div class="browser-list">
		{#if loading}
			<div class="browser-status">Loading...</div>
		{:else if error}
			<div class="browser-status browser-error">{error}</div>
		{:else if entries.length === 0}
			<div class="browser-status">No files or folders found</div>
		{:else}
			{#each entries as entry (entry.path)}
				<button
					type="button"
					class="file-entry"
					oncontextmenu={(e) => handleEntryContextMenu(e, entry)}
					onpointerdown={(e) => handleEntryPointerDown(e, entry)}
					onpointerup={clearLongPressTimer}
					onpointercancel={clearLongPressTimer}
					onclick={() => handleEntryClick(entry)}
				>
					{#if entry.isDir}
						<IconFolder class="entry-icon entry-icon-folder" />
					{:else}
						<IconFile class="entry-icon entry-icon-file" />
					{/if}
					<span class="entry-name">
						{entry.isDir ? entry.name : entry.name.replace(/\.md$/, '')}
					</span>
				</button>
			{/each}
		{/if}
	</div>
</div>

<SearchDialog
	open={showSearchDialog}
	{basePath}
	onclose={() => (showSearchDialog = false)}
	onselect={handleSearchSelect}
/>

{#if showDeleteDialog && deleteTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="delete-overlay" onclick={() => (showDeleteDialog = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="delete-dialog" onclick={(e) => e.stopPropagation()}>
			<div class="delete-title">Delete {deleteTarget.isDir ? 'folder' : 'note'}?</div>
			<div class="delete-text">
				This will permanently delete <strong>{deleteTarget.name}</strong>.
			</div>
			<div class="delete-actions">
				<button type="button" class="delete-btn" onclick={() => (showDeleteDialog = false)}>Cancel</button>
				<button type="button" class="delete-btn delete-btn-danger" onclick={confirmDelete} disabled={deleting}>
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showActionSheet && actionTarget}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="delete-overlay" onclick={() => (showActionSheet = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="action-sheet" onclick={(e) => e.stopPropagation()}>
			<div class="action-sheet-title">{actionTarget.name}</div>
			<button type="button" class="action-row" onclick={startMove}>
				<IconMoveRight width="18" height="18" />
				<span>Move</span>
			</button>
			<button type="button" class="action-row" onclick={startRename}>
				<IconPencil width="18" height="18" />
				<span>Rename</span>
			</button>
			<button type="button" class="action-row action-row-danger" onclick={() => openDeletePrompt(actionTarget!)}>
				<IconTrash2 width="18" height="18" />
				<span>Delete</span>
			</button>
			<button type="button" class="action-row" onclick={() => (showActionSheet = false)}>
				<span>Cancel</span>
			</button>
		</div>
	</div>
{/if}

{#if showRenameDialog}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="delete-overlay" onclick={() => (showRenameDialog = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="delete-dialog" onclick={(e) => e.stopPropagation()}>
			<div class="delete-title">Rename {getEntryLabel(actionTarget)}</div>
			<input class="rename-input" bind:value={renameValue} placeholder="New name" />
			{#if renameError}
				<div class="delete-text">{renameError}</div>
			{/if}
			<div class="delete-actions">
				<button type="button" class="delete-btn" onclick={() => (showRenameDialog = false)}>Cancel</button>
				<button type="button" class="delete-btn" onclick={confirmRename} disabled={renaming}>
					{renaming ? 'Renaming...' : 'Rename'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showMoveDialog}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="delete-overlay" onclick={() => (showMoveDialog = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="delete-dialog" onclick={(e) => e.stopPropagation()}>
			<div class="delete-title">Move {getEntryLabel(actionTarget)}</div>
			<div class="move-current-path">
				{movePickerPath || '/'}
			</div>
			<div class="move-folder-list">
				{#if movePickerPath}
					<button type="button" class="move-folder-row" onclick={moveNavigateUp}>
						<IconChevronLeft width="16" height="16" />
						<span>..</span>
					</button>
				{/if}
				{#if moveFoldersLoading}
					<div class="browser-status">Loading folders...</div>
				{:else if moveFolders.length === 0}
					<div class="browser-status">No subfolders</div>
				{:else}
					{#each moveFolders as folder}
						<button type="button" class="move-folder-row" onclick={() => moveOpenFolder(folder.path)}>
							<IconFolder width="16" height="16" />
							<span>{folder.name}</span>
						</button>
					{/each}
				{/if}
			</div>
			{#if moveError}
				<div class="delete-text">{moveError}</div>
			{/if}
			<div class="delete-actions">
				<button type="button" class="delete-btn" onclick={() => (showMoveDialog = false)}>Cancel</button>
				<button type="button" class="delete-btn" onclick={confirmMove} disabled={moving || moveFoldersLoading}>
					{moving ? 'Moving...' : 'Move'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showCreateFolderDialog}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="delete-overlay" onclick={() => (showCreateFolderDialog = false)}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="delete-dialog" onclick={(e) => e.stopPropagation()}>
			<div class="delete-title">Create folder</div>
			<input class="rename-input" bind:value={createFolderValue} placeholder="Folder name" />
			{#if createFolderError}
				<div class="delete-text">{createFolderError}</div>
			{/if}
			<div class="delete-actions">
				<button type="button" class="delete-btn" onclick={() => (showCreateFolderDialog = false)}>Cancel</button>
				<button type="button" class="delete-btn" onclick={confirmCreateFolder} disabled={creatingFolder}>
					{creatingFolder ? 'Creating...' : 'Create'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.file-browser {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.browser-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		min-height: 3rem;
	}

	:global([data-mode='dark']) .browser-header {
		background-color: rgb(var(--color-surface-800));
		border-bottom-color: rgb(var(--color-surface-600));
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 0.375rem;
		color: rgb(var(--color-surface-600));
	}

	.back-btn:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .back-btn {
		color: rgb(var(--color-surface-400));
	}

	.back-btn :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		overflow-x: auto;
		white-space: nowrap;
		font-size: 0.875rem;
		scrollbar-width: none;
	}

	.browser-title {
		flex: 1;
		min-width: 0;
		display: flex;
		justify-content: center;
	}

	.breadcrumbs::-webkit-scrollbar {
		display: none;
	}

	.crumb {
		color: rgb(var(--color-surface-500));
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
	}

	.crumb:hover {
		color: rgb(var(--color-surface-700));
	}

	:global([data-mode='dark']) .crumb:hover {
		color: rgb(var(--color-surface-300));
	}

	.crumb-current {
		color: rgb(var(--color-surface-800));
		font-weight: 600;
	}

	:global([data-mode='dark']) .crumb-current {
		color: rgb(var(--color-surface-200));
	}

	.crumb-sep {
		color: rgb(var(--color-surface-400));
		font-size: 0.75rem;
	}

	.browser-list {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.file-entry {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.875rem 1rem;
		text-align: left;
		border-bottom: 1px solid rgb(var(--color-surface-200));
		transition: background-color 0.1s ease;
	}

	.delete-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.delete-dialog {
		width: min(24rem, 100%);
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.75rem;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	:global([data-mode='dark']) .delete-dialog {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.delete-title {
		font-weight: 700;
		color: rgb(var(--color-surface-900));
	}

	:global([data-mode='dark']) .delete-title {
		color: rgb(var(--color-surface-100));
	}

	.delete-text {
		font-size: 0.875rem;
		color: rgb(var(--color-surface-700));
	}

	:global([data-mode='dark']) .delete-text {
		color: rgb(var(--color-surface-300));
	}

	.delete-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.delete-btn {
		padding: 0.4rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--color-surface-800));
		font-weight: 600;
		font-size: 0.875rem;
	}

	:global([data-mode='dark']) .delete-btn {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-700));
		color: rgb(var(--color-surface-100));
	}

	.delete-btn-danger {
		border-color: rgb(var(--color-error-500));
		background-color: rgb(var(--color-error-500));
		color: white;
	}

	.action-sheet {
		width: min(32rem, 100%);
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.75rem 0.75rem 0 0;
		background-color: rgb(var(--color-surface-100));
		overflow: hidden;
	}

	:global([data-mode='dark']) .action-sheet {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.action-sheet-title {
		padding: 0.875rem 1rem 0.5rem;
		font-weight: 700;
		font-size: 0.9rem;
		color: rgb(var(--color-surface-700));
	}

	:global([data-mode='dark']) .action-sheet-title {
		color: rgb(var(--color-surface-300));
	}

	.action-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border-top: 1px solid rgb(var(--color-surface-200));
		color: rgb(var(--color-surface-800));
		text-align: left;
	}

	:global([data-mode='dark']) .action-row {
		border-top-color: rgb(var(--color-surface-700));
		color: rgb(var(--color-surface-100));
	}

	.action-row-danger {
		color: rgb(var(--color-error-500));
	}

	.rename-input {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-50));
		color: rgb(var(--color-surface-900));
	}

	:global([data-mode='dark']) .rename-input {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-900));
		color: rgb(var(--color-surface-100));
	}

	.move-current-path {
		font-size: 0.8rem;
		color: rgb(var(--color-surface-600));
	}

	:global([data-mode='dark']) .move-current-path {
		color: rgb(var(--color-surface-300));
	}

	.move-folder-list {
		max-height: 40vh;
		overflow-y: auto;
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.5rem;
	}

	:global([data-mode='dark']) .move-folder-list {
		border-color: rgb(var(--color-surface-600));
	}

	.move-folder-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.55rem 0.65rem;
		text-align: left;
		border-bottom: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .move-folder-row {
		border-bottom-color: rgb(var(--color-surface-700));
	}

	:global([data-mode='dark']) .file-entry {
		border-bottom-color: rgb(var(--color-surface-700));
	}

	.file-entry:hover {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .file-entry:hover {
		background-color: rgb(var(--color-surface-800));
	}

	.file-entry:active {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .file-entry:active {
		background-color: rgb(var(--color-surface-700));
	}

	:global(.entry-icon) {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	:global(.entry-icon-folder) {
		color: rgb(var(--color-warning-500));
	}

	:global(.entry-icon-file) {
		color: rgb(var(--color-surface-500));
	}

	.entry-name {
		font-size: 0.9375rem;
		color: rgb(var(--color-surface-800));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	:global([data-mode='dark']) .entry-name {
		color: rgb(var(--color-surface-200));
	}

	.browser-status {
		padding: 2rem 1rem;
		text-align: center;
		color: rgb(var(--color-surface-500));
		font-size: 0.875rem;
	}

	.browser-error {
		color: rgb(var(--color-error-500));
	}
</style>
