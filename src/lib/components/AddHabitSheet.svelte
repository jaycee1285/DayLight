<script lang="ts">
	import Sheet from './Sheet.svelte';
	import { addHabit } from '$lib/stores/markdown-store.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let title = $state('');
	let habitType = $state<'check' | 'target' | 'limit'>('check');
	let goal = $state<string>('');
	let unit = $state('');
	let timesPerWeek = $state(7);
	let saving = $state(false);
	let error = $state('');

	// Reset state when sheet opens
	$effect(() => {
		if (open) {
			title = '';
			habitType = 'check';
			goal = '';
			unit = '';
			timesPerWeek = 7;
			saving = false;
			error = '';
		}
	});

	const isNumerical = $derived(habitType === 'target' || habitType === 'limit');

	async function handleSave() {
		const trimmed = title.trim();
		if (!trimmed) {
			error = 'Title is required';
			return;
		}

		if (isNumerical && (!goal || parseFloat(goal) <= 0)) {
			error = 'Goal must be a positive number';
			return;
		}

		saving = true;
		error = '';

		try {
			await addHabit(trimmed, {
				habit_type: habitType,
				habit_goal: isNumerical ? parseFloat(goal) : undefined,
				habit_unit: isNumerical && unit.trim() ? unit.trim() : undefined,
				times_per_week: timesPerWeek
			});
			onclose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create habit';
			saving = false;
		}
	}
</script>

<Sheet {open} {onclose} title="Add Habit">
	<div class="add-habit">
		<!-- Title -->
		<div class="section mb-4">
			<span class="section-label">Name</span>
			<input
				type="text"
				class="field-input"
				class:has-error={error && !title.trim()}
				bind:value={title}
				placeholder="e.g. Drink Water, Morning Stretch"
			/>
		</div>

		<!-- Habit Type -->
		<div class="section mb-4">
			<span class="section-label">Type</span>
			<div class="type-selector">
				<button
					type="button"
					class="type-btn"
					class:active={habitType === 'check'}
					onclick={() => habitType = 'check'}
				>
					Check off
				</button>
				<button
					type="button"
					class="type-btn"
					class:active={habitType === 'target'}
					onclick={() => habitType = 'target'}
				>
					Reach target
				</button>
				<button
					type="button"
					class="type-btn"
					class:active={habitType === 'limit'}
					onclick={() => habitType = 'limit'}
				>
					Stay under
				</button>
			</div>
			<div class="type-hint">
				{#if habitType === 'check'}
					Simply check it off each day
				{:else if habitType === 'target'}
					Reach at least a number each day
				{:else}
					Keep a number at or below a limit
				{/if}
			</div>
		</div>

		<!-- Goal (for numerical types) -->
		{#if isNumerical}
			<div class="section mb-4">
				<span class="section-label">Goal</span>
				<div class="goal-row">
					<input
						type="number"
						class="field-input goal-input"
						class:has-error={error && isNumerical && (!goal || parseFloat(goal) <= 0)}
						bind:value={goal}
						min="1"
						step="1"
						placeholder="e.g. 8"
					/>
					<input
						type="text"
						class="field-input unit-input"
						bind:value={unit}
						placeholder="unit (optional)"
					/>
				</div>
			</div>
		{/if}

		<!-- Frequency -->
		<div class="section mb-4">
			<span class="section-label">Frequency</span>
			<div class="freq-selector">
				{#each [7, 6, 5, 4, 3, 2, 1] as n}
					<button
						type="button"
						class="freq-btn"
						class:active={timesPerWeek === n}
						onclick={() => timesPerWeek = n}
					>
						{n === 7 ? 'Daily' : `${n}x/wk`}
					</button>
				{/each}
			</div>
		</div>

		<!-- Error -->
		{#if error}
			<div class="error-msg">{error}</div>
		{/if}

		<!-- Actions -->
		<div class="actions">
			<button type="button" class="cancel-btn" onclick={onclose}>
				Cancel
			</button>
			<button type="button" class="save-btn" onclick={handleSave} disabled={saving}>
				{saving ? 'Adding...' : 'Add Habit'}
			</button>
		</div>
	</div>
</Sheet>

<style>
	.add-habit {
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

	.field-input {
		width: 100%;
		font-size: 1rem;
		padding: 0.5rem 0.75rem;
		background-color: rgb(var(--color-surface-100));
		border-radius: 0.5rem;
		border: 1px solid rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .field-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.field-input:focus {
		outline: none;
		border-color: rgb(var(--color-primary-500));
	}

	.field-input.has-error {
		border-color: rgb(var(--color-error-500));
	}

	.type-selector {
		display: flex;
		gap: 0.5rem;
	}

	.type-btn {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--body-text-color));
		cursor: pointer;
		transition: all 0.15s;
	}

	:global([data-mode='dark']) .type-btn {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.type-btn:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .type-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.type-btn.active {
		background-color: rgb(var(--color-primary-500));
		border-color: rgb(var(--color-primary-500));
		color: white;
	}

	.type-hint {
		margin-top: 0.375rem;
		font-size: 0.75rem;
		opacity: 0.5;
	}

	.goal-row {
		display: flex;
		gap: 0.75rem;
	}

	.goal-input {
		width: 5rem;
		flex-shrink: 0;
		text-align: center;
		-moz-appearance: textfield;
	}

	.goal-input::-webkit-inner-spin-button,
	.goal-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.unit-input {
		flex: 1;
	}

	.freq-selector {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.freq-btn {
		padding: 0.375rem 0.625rem;
		border-radius: 9999px;
		font-size: 0.8125rem;
		border: none;
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--body-text-color));
		cursor: pointer;
		transition: all 0.15s;
	}

	:global([data-mode='dark']) .freq-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.freq-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .freq-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.freq-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.error-msg {
		margin-bottom: 0.75rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.8125rem;
		color: rgb(var(--color-error-500));
		background-color: rgb(var(--color-error-500) / 0.1);
		border-radius: 0.5rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .actions {
		border-top-color: rgb(var(--color-surface-600));
	}

	.cancel-btn {
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		background-color: rgb(var(--color-hover-bg));
		color: rgb(var(--body-text-color));
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .cancel-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.cancel-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .cancel-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.save-btn {
		padding: 0.625rem 1.25rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		background-color: rgb(var(--color-primary-500));
		color: white;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.save-btn:hover {
		background-color: rgb(var(--color-primary-600));
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
