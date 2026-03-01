<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';
	import { getTodayDate } from '$lib/domain/task';
	import {
		markTaskComplete,
		markTaskIncomplete,
		logHabitEntry
	} from '$lib/stores/markdown-store.svelte';
	import { isHabitCompletedOnDate } from '$lib/services/ViewService';
	import HabitContextMenu from './HabitContextMenu.svelte';
	import HabitEditModal from './HabitEditModal.svelte';

	import IconMoreVertical from '~icons/lucide/more-vertical';

	interface Props {
		habit: ViewTask;
	}

	let { habit }: Props = $props();
	const today = getTodayDate();

	const habitType = $derived(habit.frontmatter.habit_type || 'check');
	const completed = $derived(isHabitCompletedOnDate(habit.frontmatter, today));
	const todayValue = $derived.by(() => {
		const val = habit.frontmatter.habit_entries[today];
		return val !== undefined ? val : null;
	});

	let menuOpen = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });
	let editModalOpen = $state(false);

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	const LONG_PRESS_DURATION = 500;

	function openContextMenu(x: number, y: number) {
		menuPosition = { x, y };
		menuOpen = true;
	}

	function closeContextMenu() {
		menuOpen = false;
	}

	function handleTouchStart(e: TouchEvent) {
		longPressTimer = setTimeout(() => {
			const touch = e.touches[0];
			openContextMenu(touch.clientX, touch.clientY);
		}, LONG_PRESS_DURATION);
	}

	function clearLongPress() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		openContextMenu(e.clientX, e.clientY);
	}

	async function toggleCheck(e: MouseEvent) {
		e.stopPropagation();
		if (completed) {
			await markTaskIncomplete(habit.filename, today);
		} else {
			await markTaskComplete(habit.filename, today);
		}
	}

	async function handleValueChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const value = parseFloat(input.value);
		if (!Number.isNaN(value) && value >= 0) {
			await logHabitEntry(habit.filename, today, value);
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="habit-row p-3 rounded-lg flex items-center gap-3"
	class:completed
	oncontextmenu={handleContextMenu}
	ontouchstart={handleTouchStart}
	ontouchend={clearLongPress}
	ontouchmove={clearLongPress}
	ontouchcancel={clearLongPress}
>
	{#if habitType === 'check'}
		<button
			type="button"
			class="habit-check w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0"
			class:checked={completed}
			onclick={toggleCheck}
			aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
		>
			{#if completed}
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
					<path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			{/if}
		</button>
	{:else}
		<div
			class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
			class:indicator-success={completed}
			class:indicator-hidden={!completed}
			aria-hidden="true"
		>
			{#if completed}
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
					<path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				</svg>
			{/if}
		</div>
	{/if}

	<span class="habit-title flex-1" class:line-through={completed} class:opacity-60={completed}>
		{habit.title}
	</span>

	{#if habitType === 'target' || habitType === 'limit'}
		<div class="flex items-center gap-1.5" onclick={(e) => e.stopPropagation()}>
			<input
				type="number"
				class="value-input"
				value={todayValue ?? ''}
				min="0"
				step="1"
				placeholder="0"
				onchange={handleValueChange}
			/>
			{#if habit.frontmatter.habit_goal !== null}
				<span class="text-xs opacity-50">/ {habit.frontmatter.habit_goal}</span>
			{/if}
			{#if habit.frontmatter.habit_unit}
				<span class="text-xs opacity-50">{habit.frontmatter.habit_unit}</span>
			{/if}
		</div>
	{/if}

	<div class="actions" onclick={(e) => e.stopPropagation()}>
		<button
			type="button"
			class="action-btn p-2 rounded-lg"
			onclick={(e) => openContextMenu(e.clientX, e.clientY)}
			aria-label="Habit options"
		>
			<IconMoreVertical width="16" height="16" />
		</button>
	</div>
</div>

{#if menuOpen}
	<HabitContextMenu
		{habit}
		x={menuPosition.x}
		y={menuPosition.y}
		onclose={closeContextMenu}
		onedit={() => (editModalOpen = true)}
	/>
{/if}

<HabitEditModal
	{habit}
	open={editModalOpen}
	onclose={() => (editModalOpen = false)}
/>

<style>
	.habit-row {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .habit-row {
		background-color: rgb(var(--color-surface-800));
	}

	.habit-row.completed {
		opacity: 0.8;
	}

	.habit-check {
		border-color: rgb(var(--color-surface-400));
		background: transparent;
		color: transparent;
		cursor: pointer;
		transition: all 0.15s;
	}

	.habit-check.checked {
		border-color: rgb(var(--color-success-500));
		background-color: rgb(var(--color-success-500));
		color: white;
	}

	.indicator-success {
		background-color: rgb(var(--color-success-500));
		color: white;
	}

	.indicator-hidden {
		background-color: transparent;
		opacity: 0;
	}

	.habit-title {
		font-size: 0.9375rem;
	}

	.value-input {
		width: 3.5rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-50));
		color: rgb(var(--body-text-color));
		text-align: center;
		font-size: 0.875rem;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.value-input::-webkit-inner-spin-button,
	.value-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	:global([data-mode='dark']) .value-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.actions {
		display: flex;
		align-items: center;
	}

	.action-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.15s;
		color: rgb(var(--body-text-color));
	}

	.action-btn:hover {
		opacity: 1;
	}
</style>
