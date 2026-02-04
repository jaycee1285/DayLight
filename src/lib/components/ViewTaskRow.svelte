<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';
	import { getOffsetDate, getTodayDate, formatLocalDate } from '$lib/domain/task';
	import { rruleToRecurrence } from '$lib/storage/frontmatter';
	import { formatRecurrenceShort } from '$lib/domain/recurrence';
	import { formatDuration } from '$lib/domain/timeLog';
	import {
		markTaskComplete,
		markTaskIncomplete,
		rescheduleTask,
		rescheduleInstance,
		logTime
	} from '$lib/stores/markdown-store.svelte';
	import Sheet from './Sheet.svelte';
	import DatePill from './DatePill.svelte';
	import ClockDrag from './ClockDrag.svelte';
	import TaskContextMenu from './TaskContextMenu.svelte';
	import TaskEditModal from './TaskEditModal.svelte';

	// Icons (compiled at build time via unplugin-icons)
	import IconSun from '~icons/lucide/sun';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconCalendar from '~icons/lucide/calendar';
	import IconMoreVertical from '~icons/lucide/more-vertical';

	interface Props {
		task: ViewTask;
		showContextMenu?: boolean;
		showDetailSheet?: boolean;
	}

	let {
		task,
		showContextMenu = true,
		showDetailSheet = true
	}: Props = $props();

	// Get recurrence from RRULE if available
	const recurrence = $derived.by(() => {
		if (!task.frontmatter.recurrence) return null;
		return rruleToRecurrence(task.frontmatter.recurrence);
	});

	const recurrenceLabel = $derived.by(() => {
		return recurrence ? formatRecurrenceShort(recurrence) : '';
	});

	const isCompleted = $derived.by(() => {
		// For recurring tasks with an instanceDate, check if that instance is completed
		if (task.instanceDate) {
			return task.frontmatter.complete_instances.includes(task.instanceDate);
		}
		// For non-recurring tasks, check status
		return task.frontmatter.status === 'done';
	});
	const timeSpentMinutes = $derived(task.totalTimeTracked);

	// Internal state
	let showReschedule = $state(false);
	let menuOpen = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });
	let sheetOpen = $state(false);
	let editModalOpen = $state(false);
	let timeToLog = $state(0);
	let logDate = $state(getTodayDate());

	// Long-press handling for mobile
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	const LONG_PRESS_DURATION = 500;

	function handleTouchStart(e: TouchEvent) {
		if (showContextMenu) {
			longPressTimer = setTimeout(() => {
				const touch = e.touches[0];
				openContextMenu(touch.clientX, touch.clientY);
			}, LONG_PRESS_DURATION);
		}
	}

	function handleTouchEnd() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handleTouchMove() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handleContextMenu(e: MouseEvent) {
		if (showContextMenu) {
			e.preventDefault();
			openContextMenu(e.clientX, e.clientY);
		}
	}

	function openContextMenu(x: number, y: number) {
		menuPosition = { x, y };
		menuOpen = true;
	}

	function closeContextMenu() {
		menuOpen = false;
	}

	function handleRowClick() {
		if (showDetailSheet) {
			sheetOpen = true;
		}
	}

	function handleCloseSheet() {
		sheetOpen = false;
	}

	function handleOpenEditModal() {
		editModalOpen = true;
	}

	function handleCloseEditModal() {
		editModalOpen = false;
	}

	async function handleCheckbox(e: MouseEvent) {
		e.stopPropagation();
		// Use instanceDate for recurring tasks, default to today for non-recurring
		const dateToUse = task.instanceDate || getTodayDate();
		if (isCompleted) {
			await markTaskIncomplete(task.filename, dateToUse);
		} else {
			await markTaskComplete(task.filename, dateToUse);
		}
	}

	async function quickReschedule(offset: number) {
		const newDate = offset === 0 ? getTodayDate() : getOffsetDate(offset);
		if (task.instanceDate && task.frontmatter.recurrence) {
			await rescheduleInstance(task.filename, task.instanceDate, newDate);
		} else {
			await rescheduleTask(task.filename, newDate);
		}
		showReschedule = false;
	}

	async function handleLogTime() {
		if (timeToLog > 0) {
			await logTime(task.filename, logDate, timeToLog);
			timeToLog = 0;
		}
	}

	function formatShortDate(dateStr: string): string {
		const today = getTodayDate();
		const yesterday = getOffsetDate(-1);
		if (dateStr === today) return 'Today';
		if (dateStr === yesterday) return 'Yesterday';
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatScheduledDate(date: string | null): string {
		if (!date) return '';
		const today = getTodayDate();
		const tomorrow = getOffsetDate(1);
		const yesterday = getOffsetDate(-1);

		if (date === today) return 'Today';
		if (date === tomorrow) return 'Tomorrow';
		if (date === yesterday) return 'Yesterday';

		// Parse as local midnight to avoid UTC offset issues
		const d = new Date(date + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="task-row flex items-start gap-3 p-3 rounded-lg cursor-pointer"
	class:completed={isCompleted}
	onclick={handleRowClick}
	oncontextmenu={handleContextMenu}
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	ontouchmove={handleTouchMove}
	ontouchcancel={handleTouchEnd}
>
	<!-- Checkbox -->
	<button
		type="button"
		class="task-checkbox w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
		class:checked={isCompleted}
		onclick={handleCheckbox}
		aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
	>
		{#if isCompleted}
			<span class="text-sm">&#x2713;</span>
		{/if}
	</button>

	<!-- Task content -->
	<div class="flex-1 min-w-0">
		<div class="flex items-start justify-between gap-2">
			<div
				class="task-title text-left flex-1"
				class:line-through={isCompleted}
				class:opacity-60={isCompleted}
			>
				{task.title || 'Untitled task'}
			</div>
			<div class="flex items-center gap-2">
				{#if timeSpentMinutes > 0}
					<span class="time-spent text-xs whitespace-nowrap">{formatDuration(timeSpentMinutes)}</span>
				{/if}
				{#if recurrenceLabel}
					<span class="recurrence-label text-xs whitespace-nowrap">{recurrenceLabel}</span>
				{/if}
			</div>
		</div>

		<!-- Chips -->
		{#if task.frontmatter.tags.length > 1 || task.frontmatter.contexts.length > 0 || task.frontmatter.projects.length > 0}
			<div class="task-chips flex flex-wrap gap-1 mt-1">
				{#each task.frontmatter.projects as project}
					<span class="chip chip-project">+{project}</span>
				{/each}
				{#each task.frontmatter.contexts as context}
					<span class="chip chip-context">@{context}</span>
				{/each}
				{#each task.frontmatter.tags.filter(t => t !== 'task') as tag}
					<span class="chip chip-tag">#{tag}</span>
				{/each}
			</div>
		{/if}

		<!-- Instance date for recurring tasks -->
		{#if task.instanceDate}
			<div class="task-date text-xs mt-1 opacity-60">
				{#if task.effectiveDate && task.effectiveDate !== task.instanceDate}
					{formatShortDate(task.effectiveDate)}
					<span class="opacity-50">(was {formatShortDate(task.instanceDate)})</span>
				{:else}
					{formatShortDate(task.instanceDate)}
				{/if}
			</div>
		{:else if task.frontmatter.scheduled && task.frontmatter.scheduled !== getTodayDate()}
			<!-- Scheduled date (if not today, non-recurring) -->
			<div class="task-date text-xs mt-1 opacity-60">
				{formatScheduledDate(task.frontmatter.scheduled)}
			</div>
		{/if}
	</div>

	<!-- Action buttons -->
	<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
		<!-- Reschedule button -->
		<div class="relative">
			<button
				type="button"
				class="action-btn p-2 rounded-lg"
				onclick={() => (showReschedule = !showReschedule)}
				aria-label="Reschedule task"
			>
				<IconCalendar width="16" height="16" />
			</button>

			{#if showReschedule}
				<div class="reschedule-dropdown absolute right-0 top-full mt-1 rounded-lg shadow-lg z-50 p-2 min-w-[140px]">
					<button type="button" class="dropdown-item" onclick={() => quickReschedule(0)}>
						Today
					</button>
					<button type="button" class="dropdown-item" onclick={() => quickReschedule(1)}>
						Tomorrow
					</button>
					<button type="button" class="dropdown-item" onclick={() => quickReschedule(3)}>
						In 3 days
					</button>
					<button type="button" class="dropdown-item" onclick={() => quickReschedule(7)}>
						In 1 week
					</button>
				</div>
			{/if}
		</div>

		<!-- Context menu button -->
		{#if showContextMenu}
			<button
				type="button"
				class="action-btn p-2 rounded-lg"
				onclick={(e) => openContextMenu(e.clientX, e.clientY)}
				aria-label="Task options"
			>
				<IconMoreVertical width="16" height="16" />
			</button>
		{/if}
	</div>
</div>

<!-- Context Menu -->
{#if menuOpen}
	<TaskContextMenu
		{task}
		x={menuPosition.x}
		y={menuPosition.y}
		onclose={closeContextMenu}
		onpickdate={() => { sheetOpen = true; }}
		ontracktime={() => { sheetOpen = true; }}
		onedit={handleOpenEditModal}
	/>
{/if}

<!-- Task Edit Modal -->
<TaskEditModal
	{task}
	open={editModalOpen}
	onclose={handleCloseEditModal}
/>

<!-- Task Detail Sheet -->
<Sheet open={sheetOpen} onclose={handleCloseSheet} title={task.title || 'Untitled task'}>
	<div class="task-detail-sheet">
		<!-- Tags, Contexts, Projects with Time Spent -->
		<div class="flex items-start justify-between gap-2 mb-4">
			<div class="flex flex-wrap gap-2">
				{#each task.frontmatter.projects as project}
					<span class="chip chip-project">+{project}</span>
				{/each}
				{#each task.frontmatter.contexts as context}
					<span class="chip chip-context">@{context}</span>
				{/each}
				{#each task.frontmatter.tags.filter(t => t !== 'task') as tag}
					<span class="chip chip-tag">#{tag}</span>
				{/each}
			</div>
			{#if timeSpentMinutes > 0}
				<span class="time-spent-badge text-sm font-medium whitespace-nowrap">
					{formatDuration(timeSpentMinutes)}
				</span>
			{/if}
		</div>

		<!-- Body content if any -->
		{#if task.body}
			<div class="task-body mb-4 p-3 rounded-lg bg-surface-100">
				<pre class="whitespace-pre-wrap text-sm">{task.body}</pre>
			</div>
		{/if}

		<!-- Time Tracking Section -->
		<div class="time-section mb-6">
			<h4 class="text-sm font-medium mb-3 opacity-70">Time Tracking</h4>

			<!-- Time Tracker (ClockDrag) -->
			<ClockDrag bind:minutes={timeToLog} />

			<!-- Log Time Button -->
			<button
				type="button"
				class="log-time-btn w-full py-3 rounded-lg font-medium mt-4"
				disabled={timeToLog === 0}
				onclick={handleLogTime}
			>
				{#if timeToLog > 0}
					Log {formatDuration(timeToLog)} for {formatShortDate(logDate)}
				{:else}
					Select time to log
				{/if}
			</button>

			<!-- Date Selector for Time Logging -->
			<div class="log-date-section mt-4">
				<div class="flex items-center gap-2">
					<input
						type="date"
						class="date-input flex-1 p-2 rounded-lg"
						value={logDate}
						max={getTodayDate()}
						onchange={(e) => logDate = (e.target as HTMLInputElement).value}
					/>
					<div class="quick-dates flex gap-1">
						<button
							type="button"
							class="quick-date-btn"
							class:active={logDate === getTodayDate()}
							onclick={() => (logDate = getTodayDate())}
						>
							Today
						</button>
						<button
							type="button"
							class="quick-date-btn"
							class:active={logDate === getOffsetDate(-1)}
							onclick={() => (logDate = getOffsetDate(-1))}
						>
							Yesterday
						</button>
					</div>
				</div>
			</div>

			<!-- Time Summary -->
			<div class="time-summary mt-3 p-4 rounded-lg">
				<div class="flex items-center justify-between">
					<span class="text-sm opacity-70">Total time tracked</span>
					<span class="text-lg font-semibold">
						{timeSpentMinutes > 0 ? formatDuration(timeSpentMinutes) : 'None'}
					</span>
				</div>
			</div>
		</div>

		<!-- Planned For Section -->
		<div class="planned-section mb-6">
			<h4 class="text-sm font-medium mb-3 opacity-70">Planned for</h4>
			<div class="flex items-center gap-2 flex-wrap">
				<button
					type="button"
					class="schedule-btn"
					class:active={task.frontmatter.scheduled === getTodayDate()}
					onclick={() => quickReschedule(0)}
					title="Today"
				>
					<IconSun width="18" height="18" />
				</button>
				<button
					type="button"
					class="schedule-btn"
					class:active={task.frontmatter.scheduled === getOffsetDate(1)}
					onclick={() => quickReschedule(1)}
					title="Tomorrow"
				>
					<IconArrowRight width="18" height="18" />
				</button>
				<button
					type="button"
					class="schedule-btn"
					class:active={task.frontmatter.scheduled === getOffsetDate(7)}
					onclick={() => quickReschedule(7)}
					title="In 1 week"
				>
					<IconCalendar width="18" height="18" />
				</button>
				<DatePill
					date={task.frontmatter.scheduled ? new Date(task.frontmatter.scheduled + 'T00:00:00') : new Date()}
					onselect={(date) => {
						const newDate = formatLocalDate(date);
						if (task.instanceDate && task.frontmatter.recurrence) {
							rescheduleInstance(task.filename, task.instanceDate, newDate);
						} else {
							rescheduleTask(task.filename, newDate);
						}
					}}
				/>
			</div>
			{#if task.frontmatter.scheduled}
				<p class="text-sm opacity-70 mt-2">
					Scheduled: {formatScheduledDate(task.frontmatter.scheduled)}
				</p>
			{/if}
		</div>

		<!-- Recurrence Section -->
		<div class="recurrence-section mb-6 p-3 rounded-lg">
			<h4 class="text-sm font-medium mb-2 opacity-70">Repeats</h4>
			{#if recurrence}
				<p class="text-sm">{formatRecurrenceShort(recurrence)}</p>
			{:else}
				<p class="text-sm opacity-60">Not repeating</p>
			{/if}
		</div>
	</div>
</Sheet>

<style>
	.task-row {
		background-color: rgb(var(--color-surface-100));
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .task-row {
		background-color: rgb(var(--color-surface-800));
	}

	:global([data-gtk='true'][data-mode='dark']) .task-row {
		background-color: rgb(var(--color-surface-700));
	}

	.task-row:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .task-row:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	:global([data-gtk='true'][data-mode='dark']) .task-row:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.task-row.completed {
		opacity: 0.7;
	}

	.task-checkbox {
		border-color: rgb(var(--color-surface-400));
		background: transparent;
		transition: all 0.15s;
	}

	.task-checkbox:hover {
		border-color: rgb(var(--color-primary-500));
	}

	.task-checkbox.checked {
		background-color: rgb(var(--color-primary-500));
		border-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.task-title {
		font-size: 1rem;
	}

	.chip {
		display: inline-flex;
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
		font-size: 0.75rem;
	}

	.chip-tag {
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-700));
	}

	:global([data-mode='dark']) .chip-tag {
		background-color: rgb(var(--color-primary-900));
		color: rgb(var(--color-primary-300));
	}

	.chip-context {
		background-color: rgb(var(--color-secondary-100));
		color: rgb(var(--color-secondary-700));
	}

	:global([data-mode='dark']) .chip-context {
		background-color: rgb(var(--color-secondary-900));
		color: rgb(var(--color-secondary-300));
	}

	.chip-project {
		background-color: rgb(var(--color-tertiary-100));
		color: rgb(var(--color-tertiary-700));
	}

	:global([data-mode='dark']) .chip-project {
		background-color: rgb(var(--color-tertiary-900));
		color: rgb(var(--color-tertiary-300));
	}

	.recurrence-label {
		color: rgb(var(--color-primary-600));
		background-color: rgb(var(--color-primary-50));
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	:global([data-mode='dark']) .recurrence-label {
		color: rgb(var(--color-primary-300));
		background-color: rgb(var(--color-primary-900) / 0.5);
	}

	.time-spent {
		color: rgb(var(--color-tertiary-600));
		background-color: rgb(var(--color-tertiary-50));
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		font-weight: 500;
	}

	:global([data-mode='dark']) .time-spent {
		color: rgb(var(--color-tertiary-300));
		background-color: rgb(var(--color-tertiary-900) / 0.5);
	}

	.action-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.action-btn:hover {
		opacity: 1;
	}

	.reschedule-dropdown {
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .reschedule-dropdown {
		background-color: rgb(var(--color-hover-bg-strong));
		border-color: rgb(var(--color-surface-600));
	}

	.dropdown-item {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-radius: 0.25rem;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background-color 0.15s;
	}

	.dropdown-item:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .dropdown-item:hover {
		background-color: rgb(var(--color-surface-600));
	}

	/* Task Detail Sheet Styles */
	.task-detail-sheet .chip {
		display: inline-flex;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
		font-size: 0.875rem;
	}

	.time-spent-badge {
		color: rgb(var(--color-tertiary-600));
		background-color: rgb(var(--color-tertiary-100));
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
	}

	:global([data-mode='dark']) .time-spent-badge {
		color: rgb(var(--color-tertiary-300));
		background-color: rgb(var(--color-tertiary-900) / 0.5);
	}

	.task-body {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .task-body {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.schedule-btn {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		border: none;
		background-color: rgb(var(--color-surface-100));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
		transition: background-color 0.15s, transform 0.1s;
	}

	:global([data-mode='dark']) .schedule-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.schedule-btn:hover {
		background-color: rgb(var(--color-primary-100));
		transform: scale(1.05);
	}

	:global([data-mode='dark']) .schedule-btn:hover {
		background-color: rgb(var(--color-primary-900));
	}

	.schedule-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.recurrence-section {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .recurrence-section {
		background-color: rgb(var(--color-surface-800));
	}

	/* Time Tracking Styles */
	.log-time-btn {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s, opacity 0.15s;
	}

	.log-time-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.log-time-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.date-input {
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		color: inherit;
	}

	:global([data-mode='dark']) .date-input {
		background-color: rgb(var(--color-hover-bg-strong));
		border-color: rgb(var(--color-surface-600));
	}

	.date-input:focus {
		outline: none;
		border-color: rgb(var(--color-primary-500));
	}

	.quick-date-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		background-color: rgb(var(--color-hover-bg));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
		white-space: nowrap;
	}

	:global([data-mode='dark']) .quick-date-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.quick-date-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .quick-date-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.quick-date-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.time-summary {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .time-summary {
		background-color: rgb(var(--color-hover-bg-strong));
	}
</style>
