<script lang="ts">
	import {
		searchEditor,
		invalidateEditorSearch,
		getEditorSearchDebugInfo,
		type EditorSearchResult,
		type EditorSearchDebugInfo
	} from './search-index';
	import IconSearch from '~icons/lucide/search';
	import IconRefreshCw from '~icons/lucide/refresh-cw';
	import IconFolderOpen from '~icons/lucide/folder-open';

	interface Props {
		open: boolean;
		basePath: string;
		onclose: () => void;
		onselect: (result: EditorSearchResult) => void;
	}

	let { open, basePath, onclose, onselect }: Props = $props();

	let query = $state('');
	let results = $state<EditorSearchResult[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let searchInput: HTMLInputElement | null = $state(null);
	let showDebug = $state(false);
	let debug = $state<EditorSearchDebugInfo>(getEditorSearchDebugInfo());
	let debugPoller: ReturnType<typeof setInterval> | null = null;
	let searchNonce = $state(0);

	$effect(() => {
		if (!open) {
			query = '';
			results = [];
			error = null;
			debug = getEditorSearchDebugInfo();
			if (debugPoller) {
				clearInterval(debugPoller);
				debugPoller = null;
			}
			return;
		}

		queueMicrotask(() => searchInput?.focus());
	});

	$effect(() => {
		if (!open || !loading) return;
		debugPoller = setInterval(() => {
			debug = getEditorSearchDebugInfo();
		}, 150);
		return () => {
			if (debugPoller) {
				clearInterval(debugPoller);
				debugPoller = null;
			}
		};
	});

	$effect(() => {
		if (!open) return;
		searchNonce;

		const trimmed = query.trim();
		if (!trimmed) {
			results = [];
			error = null;
			debug = getEditorSearchDebugInfo();
			return;
		}

		let cancelled = false;
		loading = true;
		error = null;
		debug = getEditorSearchDebugInfo();

		void searchEditor(basePath, trimmed, 10)
			.then((next) => {
				if (cancelled) return;
				results = next;
				debug = getEditorSearchDebugInfo();
			})
			.catch((err) => {
				if (cancelled) return;
				error = err instanceof Error ? err.message : String(err);
				debug = getEditorSearchDebugInfo();
			})
			.finally(() => {
				if (cancelled) return;
				loading = false;
				debug = getEditorSearchDebugInfo();
			});

		return () => {
			cancelled = true;
		};
	});

	function choose(result: EditorSearchResult) {
		onselect(result);
		onclose();
	}

	function refreshFolderIndex() {
		invalidateEditorSearch(basePath);
		error = null;
		debug = getEditorSearchDebugInfo();
		searchNonce += 1;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="delete-overlay" onclick={onclose}>
		<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
		<div class="delete-dialog search-dialog" onclick={(e) => e.stopPropagation()}>
			<div class="search-input-row">
				<IconSearch width="18" height="18" />
				<input
					class="search-input"
					bind:value={query}
					placeholder="Search tasks and markdown files"
					bind:this={searchInput}
				/>
			</div>

			<div class="search-results">
				{#if loading}
					<div class="browser-status">Searching...</div>
				{:else if error}
					<div class="browser-status browser-error">{error}</div>
				{:else if query.trim() && results.length === 0}
					<div class="browser-status">No matches</div>
				{:else}
					{#each results as result (result.path)}
						<button type="button" class="search-result-row" onclick={() => choose(result)}>
							<div class="search-result-head">
								<span class="search-result-name">{result.name}</span>
								<span class="search-result-source">{result.source}</span>
							</div>
							<div class="search-result-path">{result.path}</div>
							{#if result.snippet}
								<div class="search-result-snippet">{result.snippet}</div>
							{/if}
						</button>
					{/each}
				{/if}
			</div>

			<div class="debug-block">
				<button type="button" class="debug-toggle" onclick={() => (showDebug = !showDebug)}>
					{showDebug ? 'Hide' : 'Show'} Search Debug
				</button>
				{#if showDebug}
					<div class="debug-grid">
						<div class="debug-row">
							<strong>State</strong>
							<span>{debug.state} | docs={debug.indexedDocs}</span>
						</div>
						<div class="debug-row">
							<strong>Authority</strong>
							<span>{debug.authority}</span>
						</div>
						<div class="debug-row">
							<strong>Observation</strong>
							<span>{debug.observation}{#if debug.lastQueryMs !== null} | {debug.lastQueryMs}ms{/if}</span>
						</div>
						<div class="debug-row">
							<strong>Staleness</strong>
							<span>{debug.staleness}</span>
						</div>
						{#if debug.indexPath}
							<div class="debug-row">
								<strong>Index Path</strong>
								<span class="debug-code">{debug.indexPath}</span>
							</div>
						{/if}
						{#if debug.lastIndexedAt}
							<div class="debug-row">
								<strong>Index Built</strong>
								<span>{debug.lastIndexedAt}</span>
							</div>
						{/if}
						{#if debug.lastError}
							<div class="debug-row">
								<strong>Error</strong>
								<span>{debug.lastError}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="dialog-actions">
				<button
					type="button"
					class="delete-btn delete-btn-wide"
					onclick={refreshFolderIndex}
					aria-label="Refresh folder index"
					title="Refresh folder index"
				>
					<IconRefreshCw width="16" height="16" />
					<IconFolderOpen width="16" height="16" />
				</button>
				<button type="button" class="delete-btn" onclick={onclose}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.delete-overlay {
		position: fixed;
		inset: 0;
		z-index: 120;
		background: rgba(0, 0, 0, 0.45);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.delete-dialog {
		width: min(42rem, 100%);
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.75rem;
		padding: 0.875rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
	}

	:global([data-mode='dark']) .delete-dialog {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.search-input-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		color: rgb(var(--color-surface-500));
	}

	.search-input {
		flex: 1;
		width: 100%;
		padding: 0.55rem 0.65rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-50));
		color: rgb(var(--color-surface-900));
	}

	:global([data-mode='dark']) .search-input {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-900));
		color: rgb(var(--color-surface-100));
	}

	.search-results {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 22rem;
		overflow-y: auto;
	}

	.search-result-row {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		width: 100%;
		padding: 0.7rem 0.8rem;
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.5rem;
		text-align: left;
		background-color: rgb(var(--color-surface-50));
	}

	:global([data-mode='dark']) .search-result-row {
		background-color: rgb(var(--color-surface-900));
		border-color: rgb(var(--color-surface-700));
	}

	.search-result-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.search-result-name {
		font-weight: 600;
		color: rgb(var(--color-surface-900));
	}

	:global([data-mode='dark']) .search-result-name {
		color: rgb(var(--color-surface-100));
	}

	.search-result-source,
	.search-result-path,
	.search-result-snippet,
	.debug-row span {
		font-size: 0.8rem;
		color: rgb(var(--color-surface-600));
	}

	:global([data-mode='dark']) .search-result-source,
	:global([data-mode='dark']) .search-result-path,
	:global([data-mode='dark']) .search-result-snippet,
	:global([data-mode='dark']) .debug-row span {
		color: rgb(var(--color-surface-300));
	}

	.search-result-source {
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.browser-status {
		font-size: 0.875rem;
		color: rgb(var(--color-surface-700));
		padding: 0.5rem 0.25rem;
	}

	:global([data-mode='dark']) .browser-status {
		color: rgb(var(--color-surface-300));
	}

	.browser-error {
		color: rgb(var(--color-error-600));
	}

	.debug-block {
		border-top: 1px solid rgb(var(--color-surface-300));
		padding-top: 0.65rem;
	}

	:global([data-mode='dark']) .debug-block {
		border-top-color: rgb(var(--color-surface-600));
	}

	.debug-toggle {
		font-size: 0.85rem;
		font-weight: 600;
		color: rgb(var(--color-surface-700));
	}

	:global([data-mode='dark']) .debug-toggle {
		color: rgb(var(--color-surface-200));
	}

	.debug-grid {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.5rem;
	}

	.debug-row {
		display: grid;
		grid-template-columns: 7rem 1fr;
		gap: 0.5rem;
		align-items: start;
	}

	.debug-row strong {
		font-size: 0.8rem;
		color: rgb(var(--color-surface-800));
	}

	:global([data-mode='dark']) .debug-row strong {
		color: rgb(var(--color-surface-100));
	}

	.debug-code {
		font-family: monospace;
		word-break: break-all;
	}

	.dialog-actions {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.4rem 0.75rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--color-surface-800));
		font-weight: 600;
		font-size: 0.875rem;
	}

	.delete-btn-wide {
		min-width: 5.5rem;
		padding-inline: 0.9rem;
	}

	:global([data-mode='dark']) .delete-btn {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-700));
		color: rgb(var(--color-surface-100));
	}
</style>
