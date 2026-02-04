<script lang="ts">
	import { onMount } from 'svelte';
	import {
		scanForConflicts,
		resolveConflict,
		keepBothVersions,
		getArchivedConflicts,
		deleteArchivedConflict,
		compareJsonFiles,
		type ConflictInfo
	} from '$lib/storage/conflicts';
	import { getDataPath } from '$lib/storage/storage';
	import { join } from '@tauri-apps/api/path';

	let conflicts = $state<ConflictInfo[]>([]);
	let archivedFiles = $state<string[]>([]);
	let isScanning = $state(false);
	let showArchive = $state(false);
	let comparisons = $state<Map<string, { file1Count: number; file2Count: number; description: string }>>(new Map());

	onMount(() => {
		handleScan();
	});

	async function handleScan() {
		isScanning = true;
		try {
			conflicts = await scanForConflicts();
			archivedFiles = await getArchivedConflicts();

			// Get comparison info for each conflict
			const dataPath = await getDataPath();
			for (const conflict of conflicts) {
				const canonicalPath = await join(dataPath, conflict.canonicalFile);
				const comparison = await compareJsonFiles(canonicalPath, conflict.conflictFile);
				comparisons.set(conflict.id, comparison);
			}
			comparisons = new Map(comparisons);
		} catch (error) {
			console.error('Error scanning conflicts:', error);
		} finally {
			isScanning = false;
		}
	}

	async function handleResolve(conflict: ConflictInfo, choice: 'local' | 'remote') {
		try {
			await resolveConflict(conflict, choice);
			await handleScan(); // Refresh
		} catch (error) {
			console.error('Error resolving conflict:', error);
		}
	}

	async function handleKeepBoth(conflict: ConflictInfo) {
		try {
			await keepBothVersions(conflict);
			await handleScan(); // Refresh
		} catch (error) {
			console.error('Error keeping both versions:', error);
		}
	}

	async function handleDeleteArchived(filename: string) {
		try {
			await deleteArchivedConflict(filename);
			archivedFiles = archivedFiles.filter(f => f !== filename);
		} catch (error) {
			console.error('Error deleting archived conflict:', error);
		}
	}

	function formatFileName(name: string): string {
		// Extract readable info from conflict filename
		if (name.includes('_local_')) {
			return name.replace('_local_', ' (local) ').replace('.json', '');
		}
		if (name.includes('_remote_')) {
			return name.replace('_remote_', ' (remote) ').replace('.json', '');
		}
		return name;
	}
</script>

<main class="p-4">
	<header class="flex items-center justify-between mb-6">
		<h1 class="text-2xl font-bold">Conflicts</h1>
		<button
			type="button"
			class="scan-btn"
			onclick={handleScan}
			disabled={isScanning}
		>
			{isScanning ? 'Scanning...' : 'Scan Now'}
		</button>
	</header>

	<!-- Active Conflicts -->
	<section class="mb-8">
		<h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
			<span class="w-2 h-2 rounded-full" style="background-color: rgb(var(--color-error-500))"></span>
			Active Conflicts
			{#if conflicts.length > 0}
				<span class="text-sm font-normal opacity-70">({conflicts.length})</span>
			{/if}
		</h2>

		{#if conflicts.length > 0}
			<div class="space-y-4">
				{#each conflicts as conflict (conflict.id)}
					{@const comparison = comparisons.get(conflict.id)}
					<div class="conflict-card p-4 rounded-lg">
						<div class="flex items-start justify-between mb-3">
							<div>
								<div class="font-semibold">{conflict.canonicalFile}</div>
								<div class="text-sm opacity-70">{conflict.conflictFileName}</div>
							</div>
						</div>

						{#if comparison}
							<div class="comparison-info text-sm mb-4 p-3 rounded">
								<div class="grid grid-cols-2 gap-4 mb-2">
									<div>
										<span class="opacity-70">Local:</span>
										<span class="font-medium">{comparison.file1Count} items</span>
									</div>
									<div>
										<span class="opacity-70">Remote:</span>
										<span class="font-medium">{comparison.file2Count} items</span>
									</div>
								</div>
								<div class="text-xs opacity-70">{comparison.description}</div>
							</div>
						{/if}

						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								class="resolve-btn resolve-local"
								onclick={() => handleResolve(conflict, 'local')}
							>
								Keep Local
							</button>
							<button
								type="button"
								class="resolve-btn resolve-remote"
								onclick={() => handleResolve(conflict, 'remote')}
							>
								Keep Remote
							</button>
							<button
								type="button"
								class="resolve-btn resolve-both"
								onclick={() => handleKeepBoth(conflict)}
							>
								Archive Remote
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty-state text-center py-8">
				<div class="text-4xl mb-2">✓</div>
				<p class="opacity-70">No sync conflicts detected</p>
				<p class="text-sm opacity-50 mt-1">Your data is in sync</p>
			</div>
		{/if}
	</section>

	<!-- Archived Conflicts -->
	<section>
		<button
			type="button"
			class="archive-toggle flex items-center gap-2 text-lg font-semibold mb-3"
			onclick={() => showArchive = !showArchive}
		>
			<span class="transform transition-transform" class:rotate-90={showArchive}>▶</span>
			Archived Conflicts
			{#if archivedFiles.length > 0}
				<span class="text-sm font-normal opacity-70">({archivedFiles.length})</span>
			{/if}
		</button>

		{#if showArchive}
			{#if archivedFiles.length > 0}
				<div class="space-y-2">
					{#each archivedFiles as file}
						<div class="archived-item flex items-center justify-between p-3 rounded-lg">
							<span class="text-sm">{formatFileName(file)}</span>
							<button
								type="button"
								class="delete-btn"
								onclick={() => handleDeleteArchived(file)}
								aria-label="Delete archived file"
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm opacity-70 py-4">No archived conflicts</p>
			{/if}
		{/if}
	</section>
</main>

<style>
	.scan-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background-color: rgb(var(--color-primary-500));
		color: white;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.scan-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.scan-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.conflict-card {
		background-color: rgb(var(--color-surface-100));
		border-left: 4px solid rgb(var(--color-error-500));
	}

	:global([data-mode='dark']) .conflict-card {
		background-color: rgb(var(--color-surface-800));
	}

	.comparison-info {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .comparison-info {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.resolve-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.resolve-local {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.resolve-local:hover {
		background-color: rgb(var(--color-primary-600));
	}

	.resolve-remote {
		background-color: rgb(var(--color-secondary-500));
		color: white;
	}

	.resolve-remote:hover {
		background-color: rgb(var(--color-secondary-600));
	}

	.resolve-both {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .resolve-both {
		background-color: rgb(var(--color-surface-600));
	}

	.resolve-both:hover {
		background-color: rgb(var(--color-surface-400));
	}

	:global([data-mode='dark']) .resolve-both:hover {
		background-color: rgb(var(--color-surface-500));
	}

	.archive-toggle {
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
	}

	.archived-item {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .archived-item {
		background-color: rgb(var(--color-surface-800));
	}

	.delete-btn {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		background-color: rgb(var(--color-surface-300));
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .delete-btn {
		background-color: rgb(var(--color-surface-600));
	}

	.delete-btn:hover {
		background-color: rgb(var(--color-error-500));
		color: white;
	}

	.rotate-90 {
		transform: rotate(90deg);
	}
</style>
