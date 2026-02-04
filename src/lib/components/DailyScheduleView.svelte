<script lang="ts">
	import TimeBlockComponent from './TimeBlock.svelte';
	import {
		getTimeBlocksForDate,
		detectCollisions,
		minutesToTime,
		snapToGrid,
		getUnplannedTasksForDates,
		getBacklogTasks,
		type ViewTask,
		type TimeBlock
	} from '$lib/services/ViewService';
	import { updateTaskTimeBlock } from '$lib/stores/markdown-store.svelte';
	import { setSelectedDate } from '$lib/stores/markdown-store.svelte';
	import { formatLocalDate } from '$lib/domain/task';
	import { formatDuration } from '$lib/domain/timeLog';

	interface Props {
		selectedDate: string;
		viewTasks: ViewTask[];
		weekDays: string[];
		dayStartHour?: number;
		dayEndHour?: number;
		snapIncrement?: number;
	}

	let {
		selectedDate,
		viewTasks,
		weekDays,
		dayStartHour = 6,
		dayEndHour = 22,
		snapIncrement = 15
	}: Props = $props();

	const SLOT_HEIGHT = 60;
	const dayStartMinutes = $derived(dayStartHour * 60);
	const totalMinutes = $derived((dayEndHour - dayStartHour) * 60);
	const gridHeight = $derived((totalMinutes / 60) * SLOT_HEIGHT);
	const pixelsPerMinute = $derived(SLOT_HEIGHT / 60);

	const hours = $derived(
		Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i)
	);

	const blocks = $derived(getTimeBlocksForDate(viewTasks, selectedDate));
	const collisions = $derived(detectCollisions(blocks));
	const unplanned = $derived(getUnplannedTasksForDates(viewTasks, [selectedDate]));
	const backlog = $derived(getBacklogTasks(viewTasks));

	// Task picker state
	let showPicker = $state(false);
	let pickerMinutes = $state(0);

	function formatDayHeader(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
	}

	function isToday(dateStr: string): boolean {
		const today = new Date();
		const d = new Date(dateStr + 'T00:00:00');
		return d.getDate() === today.getDate() &&
			d.getMonth() === today.getMonth() &&
			d.getFullYear() === today.getFullYear();
	}

	function navigateDay(offset: number) {
		const current = new Date(selectedDate + 'T00:00:00');
		current.setDate(current.getDate() + offset);
		setSelectedDate(formatLocalDate(current));
	}

	function formatHour(hour: number): string {
		const h = hour % 12 || 12;
		const ampm = hour < 12 ? 'a' : 'p';
		return `${h}${ampm}`;
	}

	function handleGridTap(e: MouseEvent) {
		// Don't trigger if tapping on a block
		const target = e.target as HTMLElement;
		if (target.closest('.time-block')) return;

		const grid = e.currentTarget as HTMLElement;
		const rect = grid.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const rawMinutes = dayStartMinutes + (y / pixelsPerMinute);
		pickerMinutes = snapToGrid(rawMinutes, snapIncrement);
		showPicker = true;
	}

	async function placeTask(task: ViewTask) {
		const startTime = minutesToTime(pickerMinutes);
		const duration = task.frontmatter.plannedDuration || 60;
		await updateTaskTimeBlock(task.filename, selectedDate, startTime, duration);
		showPicker = false;
	}

	async function removeBlock(block: TimeBlock) {
		await updateTaskTimeBlock(block.task.filename, block.date, null, null);
	}

	function closePicker() {
		showPicker = false;
	}

	const pickerTasks = $derived([...unplanned, ...backlog]);
</script>

<div class="daily-schedule">
	<!-- Day navigation -->
	<div class="day-nav">
		<button type="button" class="day-nav-btn" onclick={() => navigateDay(-1)} aria-label="Previous day">
			&#x2039;
		</button>
		<div class="day-nav-title" class:today={isToday(selectedDate)}>
			{formatDayHeader(selectedDate)}
		</div>
		<button type="button" class="day-nav-btn" onclick={() => navigateDay(1)} aria-label="Next day">
			&#x203A;
		</button>
	</div>

	<!-- Time grid (scrollable) -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="grid-scroll">
		<div
			class="grid-body"
			style="height: {gridHeight}px;"
			onclick={handleGridTap}
		>
			{#each hours as hour}
				<div
					class="hour-row"
					style="top: {(hour - dayStartHour) * SLOT_HEIGHT}px; height: {SLOT_HEIGHT}px;"
				>
					<span class="hour-label">{formatHour(hour)}</span>
					<div class="hour-line"></div>
				</div>
			{/each}

			{#each blocks as block (block.task.filename)}
				<TimeBlockComponent
					{block}
					{pixelsPerMinute}
					{dayStartMinutes}
					isColliding={collisions.has(block.task.filename)}
					onclick={() => removeBlock(block)}
				/>
			{/each}
		</div>
	</div>

	<!-- Unplanned tasks hint -->
	{#if unplanned.length > 0 && !showPicker}
		<div class="unplanned-hint">
			<span>{unplanned.length} unplanned task{unplanned.length !== 1 ? 's' : ''}</span>
			<span class="hint-text">Tap the grid to place</span>
		</div>
	{/if}

	<!-- Task picker bottom sheet -->
	{#if showPicker}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="picker-overlay" onclick={closePicker}></div>
		<div class="picker-sheet" role="dialog" aria-label="Pick a task to schedule">
			<div class="picker-header">
				<span class="picker-time">{minutesToTime(pickerMinutes)}</span>
				<button type="button" class="picker-close" onclick={closePicker}>&#x2715;</button>
			</div>
			{#if pickerTasks.length > 0}
				<div class="picker-list">
					{#each pickerTasks as task (task.filename)}
						<button
							type="button"
							class="picker-task"
							onclick={() => placeTask(task)}
						>
							<span class="picker-task-title">{task.title}</span>
							<span class="picker-task-duration">
								{formatDuration(task.frontmatter.plannedDuration || 60)}
							</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="picker-empty">No tasks to schedule</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.daily-schedule {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		position: relative;
	}

	/* Day navigation */
	.day-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 4px;
		flex-shrink: 0;
	}

	.day-nav-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		padding: 4px 12px;
		cursor: pointer;
		opacity: 0.7;
		border-radius: 8px;
		color: inherit;
	}

	.day-nav-btn:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .day-nav-btn:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.day-nav-title {
		font-size: 0.9375rem;
		font-weight: 600;
	}

	.day-nav-title.today {
		color: rgb(var(--color-primary-600));
	}

	:global([data-mode='dark']) .day-nav-title.today {
		color: rgb(var(--color-primary-300));
	}

	/* Grid scroll area */
	.grid-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .grid-scroll {
		border-top-color: rgb(var(--color-surface-600));
	}

	.grid-body {
		position: relative;
	}

	/* Hour rows */
	.hour-row {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
	}

	.hour-label {
		width: 36px;
		flex-shrink: 0;
		font-size: 0.625rem;
		opacity: 0.5;
		text-align: right;
		padding-right: 6px;
		transform: translateY(-0.4em);
	}

	.hour-line {
		flex: 1;
		border-top: 1px solid rgb(var(--color-surface-200) / 0.5);
	}

	:global([data-mode='dark']) .hour-line {
		border-top-color: rgb(var(--color-surface-700) / 0.5);
	}

	/* Time blocks get offset for the hour label gutter */
	.grid-body :global(.time-block) {
		left: 40px;
	}

	/* Unplanned hint */
	.unplanned-hint {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 12px;
		font-size: 0.75rem;
		border-top: 1px solid rgb(var(--color-surface-200));
		flex-shrink: 0;
	}

	:global([data-mode='dark']) .unplanned-hint {
		border-top-color: rgb(var(--color-surface-600));
	}

	.hint-text {
		opacity: 0.5;
		font-style: italic;
	}

	/* Picker overlay + sheet */
	.picker-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.3);
		z-index: 50;
	}

	.picker-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background-color: rgb(var(--color-surface-50));
		border-top-left-radius: 16px;
		border-top-right-radius: 16px;
		z-index: 51;
		max-height: 60dvh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
	}

	:global([data-mode='dark']) .picker-sheet {
		background-color: rgb(var(--color-surface-800));
	}

	.picker-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid rgb(var(--color-surface-200));
		flex-shrink: 0;
	}

	:global([data-mode='dark']) .picker-header {
		border-bottom-color: rgb(var(--color-surface-600));
	}

	.picker-time {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.picker-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 4px 8px;
		opacity: 0.6;
		color: inherit;
	}

	.picker-list {
		overflow-y: auto;
		flex: 1;
		min-height: 0;
		padding: 8px 0;
	}

	.picker-task {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 12px 16px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: background-color 0.1s;
	}

	.picker-task:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .picker-task:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.picker-task-title {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.picker-task-duration {
		font-size: 0.75rem;
		opacity: 0.5;
	}

	.picker-empty {
		text-align: center;
		padding: 24px 16px;
		opacity: 0.5;
		font-size: 0.875rem;
	}
</style>
