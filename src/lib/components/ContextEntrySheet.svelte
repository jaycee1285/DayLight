<script lang="ts">
	import Sheet from './Sheet.svelte';
	import { dateToContextKey, loadContextEntry, saveContextEntry } from '$lib/storage/context';

	interface Props {
		open: boolean;
		date: string;
		onclose: () => void;
	}

	let { open, date, onclose }: Props = $props();

	let entry = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let error = $state('');
	let loadedKey = $state<string | null>(null);

	const dateKey = $derived(dateToContextKey(date));

	$effect(() => {
		if (!open) {
			loadedKey = null;
			return;
		}
		if (loadedKey === dateKey) return;

		loadedKey = dateKey;
		loading = true;
		saving = false;
		error = '';

		loadContextEntry(date)
			.then((value) => {
				entry = value;
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : 'Failed to load context';
				entry = '';
			})
			.finally(() => {
				loading = false;
			});
	});

	async function handleSave() {
		saving = true;
		error = '';

		try {
			await saveContextEntry(date, entry);
			window.dispatchEvent(new CustomEvent('daylight:context-updated', { detail: { date } }));
			onclose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save context';
			saving = false;
		}
	}
</script>

<Sheet {open} {onclose} title={`Context ${dateKey}`} centered>
	<div class="context-entry">
		<div class="section">
			<span class="section-label">Entry</span>
			<textarea
				class="entry-input"
				bind:value={entry}
				rows="8"
				disabled={loading || saving}
				placeholder="Context for this date..."
			></textarea>
		</div>

		{#if error}
			<div class="error-msg">{error}</div>
		{/if}

		<div class="actions">
			<button type="button" class="cancel-btn" onclick={onclose} disabled={saving}>
				Cancel
			</button>
			<button type="button" class="save-btn" onclick={handleSave} disabled={loading || saving}>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	</div>
</Sheet>

<style>
	.context-entry {
		padding: 0.5rem 0;
	}

	.section {
		padding: 0.5rem 0;
	}

	.section-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.6;
		margin-bottom: 0.5rem;
	}

	.entry-input {
		width: 100%;
		min-height: 12rem;
		font-size: 1rem;
		line-height: 1.45;
		padding: 0.75rem;
		background-color: rgb(var(--color-surface-100));
		border-radius: 0.5rem;
		border: 1px solid rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
		resize: vertical;
	}

	:global([data-mode='dark']) .entry-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.entry-input:focus {
		outline: none;
		border-color: rgb(var(--color-primary-500));
	}

	.error-msg {
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-error-100));
		color: rgb(var(--color-error-700));
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding-top: 1rem;
	}

	.cancel-btn,
	.save-btn {
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-weight: 600;
		cursor: pointer;
		border: none;
	}

	.cancel-btn {
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--body-text-color));
	}

	.save-btn {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.cancel-btn:disabled,
	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
