<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';
	import { renameTask, updateTaskWithBody } from '$lib/stores/markdown-store.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		habit: ViewTask;
		open: boolean;
		onclose: () => void;
	}

	let { habit, open, onclose }: Props = $props();

	let title = $state('');
	let notes = $state('');
	let habitType = $state<'check' | 'target' | 'limit'>('check');
	let goal = $state('');
	let unit = $state('');
	let timesPerWeek = $state(7);
	let titleError = $state('');
	let saveError = $state('');
	let saving = $state(false);

	const isNumerical = $derived(habitType === 'target' || habitType === 'limit');

	$effect(() => {
		if (!open) return;
		title = habit.title || '';
		notes = habit.body || '';
		habitType = habit.frontmatter.habit_type || 'check';
		goal = habit.frontmatter.habit_goal !== null ? String(habit.frontmatter.habit_goal) : '';
		unit = habit.frontmatter.habit_unit || '';
		timesPerWeek = habit.frontmatter.habit_target_days && habit.frontmatter.habit_target_days >= 1
			? Math.min(7, habit.frontmatter.habit_target_days)
			: 7;
		titleError = '';
		saveError = '';
		saving = false;
	});

	async function handleSave() {
		titleError = '';
		saveError = '';

		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			titleError = 'Title is required';
			return;
		}

		if (isNumerical) {
			const parsedGoal = parseFloat(goal);
			if (!goal || Number.isNaN(parsedGoal) || parsedGoal <= 0) {
				saveError = 'Goal must be a positive number';
				return;
			}
		}

		saving = true;

		try {
			let currentFilename = habit.filename;
			if (trimmedTitle !== habit.title) {
				const result = await renameTask(habit.filename, trimmedTitle);
				if (!result.success) {
					titleError = result.error || 'Failed to rename habit';
					saving = false;
					return;
				}
				currentFilename = result.newFilename || habit.filename;
			}

			const parsedGoal = isNumerical ? parseFloat(goal) : null;
			await updateTaskWithBody(
				currentFilename,
				{
					tags: Array.from(new Set(['habit', ...habit.frontmatter.tags.filter((t) => t !== 'task')])),
					habit_type: habitType,
					habit_goal: isNumerical ? parsedGoal : null,
					habit_unit: isNumerical && unit.trim() ? unit.trim() : null,
					habit_target_days: timesPerWeek < 7 ? timesPerWeek : null
				},
				notes
			);

			onclose();
		} catch (error) {
			saveError = error instanceof Error ? error.message : 'Failed to save habit';
			saving = false;
		}
	}
</script>

<Sheet {open} {onclose} title="Edit Habit">
	<div class="habit-edit">
		<div class="section mb-4">
			<span class="section-label">Name</span>
			<input
				type="text"
				class="field-input"
				class:has-error={Boolean(titleError)}
				bind:value={title}
				placeholder="Habit name"
			/>
			{#if titleError}
				<div class="error-inline">{titleError}</div>
			{/if}
		</div>

		<div class="section mb-4">
			<span class="section-label">Notes</span>
			<textarea
				class="field-input notes-input"
				bind:value={notes}
				rows="3"
				placeholder="Add notes..."
			></textarea>
		</div>

		<div class="section mb-4">
			<span class="section-label">Type</span>
			<div class="type-selector">
				<button
					type="button"
					class="type-btn"
					class:active={habitType === 'check'}
					onclick={() => (habitType = 'check')}
				>
					Check off
				</button>
				<button
					type="button"
					class="type-btn"
					class:active={habitType === 'target'}
					onclick={() => (habitType = 'target')}
				>
					Reach target
				</button>
				<button
					type="button"
					class="type-btn"
					class:active={habitType === 'limit'}
					onclick={() => (habitType = 'limit')}
				>
					Stay under
				</button>
			</div>
		</div>

		{#if isNumerical}
			<div class="section mb-4">
				<span class="section-label">Goal</span>
				<div class="goal-row">
					<input
						type="number"
						class="field-input goal-input"
						bind:value={goal}
						min="1"
						step="1"
						placeholder="8"
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

		<div class="section mb-4">
			<span class="section-label">Frequency</span>
			<div class="freq-selector">
				{#each [7, 6, 5, 4, 3, 2, 1] as n}
					<button
						type="button"
						class="freq-btn"
						class:active={timesPerWeek === n}
						onclick={() => (timesPerWeek = n)}
					>
						{n === 7 ? 'Daily' : `${n}x/wk`}
					</button>
				{/each}
			</div>
		</div>

		{#if saveError}
			<div class="error-msg">{saveError}</div>
		{/if}

		<div class="actions">
			<button type="button" class="cancel-btn" onclick={onclose}>
				Cancel
			</button>
			<button type="button" class="save-btn" onclick={handleSave} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</button>
		</div>
	</div>
</Sheet>

<style>
	.habit-edit {
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

	.notes-input {
		resize: vertical;
		min-height: 4rem;
	}

	.error-inline {
		margin-top: 0.375rem;
		font-size: 0.8125rem;
		color: rgb(var(--color-error-500));
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

	.goal-row {
		display: flex;
		gap: 0.75rem;
	}

	.goal-input {
		width: 5rem;
		flex-shrink: 0;
		text-align: center;
		appearance: textfield;
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
	}

	:global([data-mode='dark']) .cancel-btn {
		background-color: rgb(var(--color-hover-bg-strong));
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
	}

	.save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
