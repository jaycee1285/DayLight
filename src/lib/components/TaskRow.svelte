<script lang="ts">
	import type { Task } from '$lib/domain/task';
	import { getOffsetDate, getTodayDate, formatLocalDate } from '$lib/domain/task';
	import {
		formatRecurrenceShort,
		createWeeklyRecurrence,
		createMonthlyRecurrence,
		type Recurrence,
		type WeekDay
	} from '$lib/domain/recurrence';
	import { formatDuration, getTotalMinutesForTaskOnDate } from '$lib/domain/timeLog';
	import { subTasksForParent } from '$lib/domain/selectors';
	import {
		store,
		markTaskComplete,
		markTaskIncomplete,
		rescheduleTaskTo,
		deleteTask,
		addTimeLog,
		addSubTask,
		updateTaskRecurrence,
		removeTaskRecurrence
	} from '$lib/stores/app.svelte';
	import Sheet from './Sheet.svelte';
	import ClockDrag from './ClockDrag.svelte';
	import DatePill from './DatePill.svelte';

	interface Props {
		task: Task;
		recurrence?: Recurrence | null;
		timeSpentMinutes?: number;
		showContextMenu?: boolean;
		showDetailSheet?: boolean;
	}

	let {
		task,
		recurrence = null,
		timeSpentMinutes = 0,
		showContextMenu = true,
		showDetailSheet = true
	}: Props = $props();

	const recurrenceLabel = $derived(recurrence ? formatRecurrenceShort(recurrence) : '');

	// Internal state
	let showReschedule = $state(false);
	let menuOpen = $state(false);
	let menuPosition = $state({ x: 0, y: 0 });
	let sheetOpen = $state(false);
	let timeToLog = $state(0);
	let logDate = $state(getTodayDate());
	let newSubTaskTitle = $state('');

	// Recurrence editing state
	let recurrenceSheetOpen = $state(false);
	type RecurrenceType = 'none' | 'weekly' | 'monthly';
	let editRecurrenceType = $state<RecurrenceType>('none');
	let editWeeklyDays = $state<WeekDay[]>([]);
	let editMonthlyDay = $state(1);

	const weekDayOptions: { value: WeekDay; label: string }[] = [
		{ value: 'sun', label: 'S' },
		{ value: 'mon', label: 'M' },
		{ value: 'tue', label: 'T' },
		{ value: 'wed', label: 'W' },
		{ value: 'thu', label: 'T' },
		{ value: 'fri', label: 'F' },
		{ value: 'sat', label: 'S' }
	];

	// Get sub-tasks for this task
	const subTasks = $derived(subTasksForParent(store.tasks, task.id));

	// Time logged for log date
	const timeLoggedForDate = $derived(
		getTotalMinutesForTaskOnDate(store.timeLogs, task.id, logDate)
	);

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
			timeToLog = 0;
			logDate = getTodayDate();
			newSubTaskTitle = '';
			sheetOpen = true;
		}
	}

	function handleCloseSheet() {
		sheetOpen = false;
		timeToLog = 0;
		newSubTaskTitle = '';
	}

	function handleCheckbox(e: MouseEvent) {
		e.stopPropagation();
		if (task.completed) {
			markTaskIncomplete(task.id);
		} else {
			markTaskComplete(task.id);
		}
	}

	function quickReschedule(offset: number) {
		const newDate = offset === 0 ? getTodayDate() : getOffsetDate(offset);
		rescheduleTaskTo(task.id, newDate);
		showReschedule = false;
	}

	function handleQuickRescheduleFromSheet(offset: number) {
		const newDate = offset === 0 ? getTodayDate() : getOffsetDate(offset);
		rescheduleTaskTo(task.id, newDate);
	}

	function handleDelete() {
		deleteTask(task.id);
		closeContextMenu();
	}

	function handleLogTime() {
		if (timeToLog > 0) {
			addTimeLog(task.id, logDate, timeToLog);
			timeToLog = 0;
		}
	}

	function handleAddSubTask() {
		if (newSubTaskTitle.trim()) {
			addSubTask(task.id, newSubTaskTitle.trim());
			newSubTaskTitle = '';
		}
	}

	function openRecurrenceSheet() {
		// Initialize with current recurrence values
		if (recurrence) {
			if (recurrence.type === 'weekly') {
				editRecurrenceType = 'weekly';
				editWeeklyDays = [...recurrence.weekDays];
				editMonthlyDay = 1;
			} else if (recurrence.type === 'monthly') {
				editRecurrenceType = 'monthly';
				editWeeklyDays = [];
				editMonthlyDay = recurrence.dayOfMonth;
			}
		} else {
			editRecurrenceType = 'none';
			editWeeklyDays = [];
			editMonthlyDay = new Date().getDate();
		}
		recurrenceSheetOpen = true;
	}

	function closeRecurrenceSheet() {
		recurrenceSheetOpen = false;
	}

	function toggleEditWeekDay(day: WeekDay) {
		if (editWeeklyDays.includes(day)) {
			editWeeklyDays = editWeeklyDays.filter(d => d !== day);
		} else {
			editWeeklyDays = [...editWeeklyDays, day];
		}
	}

	function saveRecurrence() {
		const startDate = task.scheduledDate || getTodayDate();

		if (editRecurrenceType === 'none') {
			removeTaskRecurrence(task.id);
		} else if (editRecurrenceType === 'weekly' && editWeeklyDays.length > 0) {
			const newRecurrence = createWeeklyRecurrence(startDate, editWeeklyDays);
			updateTaskRecurrence(task.id, newRecurrence);
		} else if (editRecurrenceType === 'monthly') {
			const newRecurrence = createMonthlyRecurrence(startDate, editMonthlyDay);
			updateTaskRecurrence(task.id, newRecurrence);
		}

		closeRecurrenceSheet();
	}

	function handleLogDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		logDate = input.value;
	}

	function formatScheduledDate(date: string | null): string {
		if (!date) return '';
		const today = getTodayDate();
		const tomorrow = getOffsetDate(1);
		const yesterday = getOffsetDate(-1);

		if (date === today) return 'Today';
		if (date === tomorrow) return 'Tomorrow';
		if (date === yesterday) return 'Yesterday';

		const d = new Date(date);
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	function formatDate(dateStr: string): string {
		const today = getTodayDate();
		const tomorrow = getOffsetDate(1);
		const yesterday = getOffsetDate(-1);

		if (dateStr === today) return 'Today';
		if (dateStr === tomorrow) return 'Tomorrow';
		if (dateStr === yesterday) return 'Yesterday';

		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatShortDate(dateStr: string): string {
		const today = getTodayDate();
		const yesterday = getOffsetDate(-1);

		if (dateStr === today) return 'Today';
		if (dateStr === yesterday) return 'Yesterday';

		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeContextMenu();
		}
	}

	// Adjust menu position to stay within viewport
	let menuElement: HTMLDivElement | null = $state(null);
	let adjustedMenuX = $derived.by(() => {
		if (!menuElement) return menuPosition.x;
		const rect = menuElement.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		if (menuPosition.x + rect.width > viewportWidth - 16) {
			return Math.max(16, viewportWidth - rect.width - 16);
		}
		return menuPosition.x;
	});
	let adjustedMenuY = $derived.by(() => {
		if (!menuElement) return menuPosition.y;
		const rect = menuElement.getBoundingClientRect();
		const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
		const bottomMargin = 60;
		if (menuPosition.y + rect.height > viewportHeight - bottomMargin) {
			return Math.max(16, viewportHeight - rect.height - bottomMargin);
		}
		return menuPosition.y;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="task-row flex items-start gap-3 p-3 rounded-lg cursor-pointer"
	class:completed={task.completed}
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
		class:checked={task.completed}
		onclick={handleCheckbox}
		aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
	>
		{#if task.completed}
			<span class="text-sm">✓</span>
		{/if}
	</button>

	<!-- Task content -->
	<div class="flex-1 min-w-0">
		<div class="flex items-start justify-between gap-2">
			<div
				class="task-title text-left flex-1"
				class:line-through={task.completed}
				class:opacity-60={task.completed}
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
		{#if task.tags.length > 0 || task.contexts.length > 0 || task.project}
			<div class="task-chips flex flex-wrap gap-1 mt-1">
				{#if task.project}
					<span class="chip chip-project">+{task.project}</span>
				{/if}
				{#each task.contexts as context}
					<span class="chip chip-context">@{context}</span>
				{/each}
				{#each task.tags as tag}
					<span class="chip chip-tag">#{tag}</span>
				{/each}
			</div>
		{/if}

		<!-- Scheduled date (if not today) -->
		{#if task.scheduledDate && task.scheduledDate !== getTodayDate()}
			<div class="task-date text-xs mt-1 opacity-60">
				{formatScheduledDate(task.scheduledDate)}
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
				📅
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
				⋮
			</button>
		{/if}
	</div>
</div>

<!-- Context Menu -->
{#if menuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="context-menu-backdrop" onclick={closeContextMenu}>
		<div
			bind:this={menuElement}
			class="context-menu"
			style="left: {adjustedMenuX}px; top: {adjustedMenuY}px;"
		>
			<!-- Quick reschedule icons row -->
			<div class="quick-actions">
				<button
					type="button"
					class="quick-action-btn"
					onclick={() => { quickReschedule(0); closeContextMenu(); }}
					aria-label="Reschedule for today"
					title="Today"
				>
					<span class="quick-action-icon">☀</span>
				</button>
				<button
					type="button"
					class="quick-action-btn"
					onclick={() => { quickReschedule(1); closeContextMenu(); }}
					aria-label="Reschedule for tomorrow"
					title="Tomorrow"
				>
					<span class="quick-action-icon">→</span>
				</button>
				<button
					type="button"
					class="quick-action-btn"
					onclick={() => { quickReschedule(7); closeContextMenu(); }}
					aria-label="Reschedule for next week"
					title="In 1 week"
				>
					<span class="quick-action-icon">📅</span>
				</button>
				<button
					type="button"
					class="quick-action-btn"
					onclick={() => { sheetOpen = true; closeContextMenu(); }}
					aria-label="Pick a date"
					title="Pick date"
				>
					<span class="quick-action-icon">🗓</span>
				</button>
				<button
					type="button"
					class="quick-action-btn quick-action-delete"
					onclick={handleDelete}
					aria-label="Delete task"
					title="Delete"
				>
					<span class="quick-action-icon">🗑</span>
				</button>
			</div>

			<hr class="menu-divider" />

			<!-- Menu options -->
			<div class="menu-options">
				<button type="button" class="menu-option" onclick={() => {
					if (task.completed) markTaskIncomplete(task.id);
					else markTaskComplete(task.id);
					closeContextMenu();
				}}>
					<span class="menu-icon">{task.completed ? '↩' : '✓'}</span>
					<span>{task.completed ? 'Mark Incomplete' : 'Mark as Done'}</span>
				</button>

				<button type="button" class="menu-option" onclick={() => { sheetOpen = true; closeContextMenu(); }}>
					<span class="menu-icon">⏱</span>
					<span>Track Time</span>
				</button>

				<button type="button" class="menu-option" onclick={() => { sheetOpen = true; closeContextMenu(); }}>
					<span class="menu-icon">+</span>
					<span>Add Sub-Task</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Task Detail Sheet -->
<Sheet open={sheetOpen} onclose={handleCloseSheet} title={task.title || 'Untitled task'}>
	<div class="task-detail-sheet">
		<!-- Tags, Contexts, Project with Time Spent -->
		<div class="flex items-start justify-between gap-2 mb-4">
			<div class="flex flex-wrap gap-2">
				{#if task.project}
					<span class="chip chip-project">+{task.project}</span>
				{/if}
				{#each task.contexts as context}
					<span class="chip chip-context">@{context}</span>
				{/each}
				{#each task.tags as tag}
					<span class="chip chip-tag">#{tag}</span>
				{/each}
			</div>
			{#if timeSpentMinutes > 0}
				<span class="time-spent-badge text-sm font-medium whitespace-nowrap">
					{formatDuration(timeSpentMinutes)}
				</span>
			{/if}
		</div>

		<!-- Sub-tasks Section -->
		<div class="subtasks-section mb-6">
			<h4 class="text-sm font-medium mb-3 opacity-70">Sub-tasks</h4>
			{#if subTasks.length > 0}
				<div class="subtask-list space-y-2 mb-3">
					{#each subTasks as subtask (subtask.id)}
						<div class="subtask-item flex items-center gap-2">
							<button
								type="button"
								class="subtask-checkbox w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
								class:checked={subtask.completed}
								onclick={() => subtask.completed ? markTaskIncomplete(subtask.id) : markTaskComplete(subtask.id)}
							>
								{#if subtask.completed}
									<span class="text-xs">✓</span>
								{/if}
							</button>
							<span
								class="subtask-title flex-1"
								class:line-through={subtask.completed}
								class:opacity-60={subtask.completed}
							>
								{subtask.title}
							</span>
						</div>
					{/each}
				</div>
			{/if}
			<div class="add-subtask flex gap-2">
				<input
					type="text"
					class="subtask-input flex-1 p-2 rounded-lg"
					placeholder="Add sub-task..."
					bind:value={newSubTaskTitle}
					onkeydown={(e) => e.key === 'Enter' && handleAddSubTask()}
				/>
				<button
					type="button"
					class="add-subtask-btn px-3 py-2 rounded-lg"
					onclick={handleAddSubTask}
					disabled={!newSubTaskTitle.trim()}
				>
					+
				</button>
			</div>
		</div>

		<!-- Time Tracking Section -->
		<div class="time-section mb-6">
			<h4 class="text-sm font-medium mb-3 opacity-70">Time Tracking</h4>

			<!-- Time Tracker (ClockDrag at top) -->
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
						onchange={handleLogDateChange}
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

			<!-- Time Logged for Selected Date -->
			<div class="time-summary mt-3 p-4 rounded-lg">
				<div class="flex items-center justify-between">
					<span class="text-sm opacity-70">Time logged ({formatShortDate(logDate)})</span>
					<span class="text-lg font-semibold">
						{timeLoggedForDate > 0 ? formatDuration(timeLoggedForDate) : 'None'}
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
					class:active={task.scheduledDate === getTodayDate()}
					onclick={() => handleQuickRescheduleFromSheet(0)}
					title="Today"
				>
					☀
				</button>
				<button
					type="button"
					class="schedule-btn"
					class:active={task.scheduledDate === getOffsetDate(1)}
					onclick={() => handleQuickRescheduleFromSheet(1)}
					title="Tomorrow"
				>
					→
				</button>
				<button
					type="button"
					class="schedule-btn"
					class:active={task.scheduledDate === getOffsetDate(7)}
					onclick={() => handleQuickRescheduleFromSheet(7)}
					title="In 1 week"
				>
					📅
				</button>
				<DatePill
					date={task.scheduledDate ? new Date(task.scheduledDate + 'T00:00:00') : new Date()}
					onselect={(date) => rescheduleTaskTo(task.id, formatLocalDate(date))}
				/>
			</div>
			{#if task.scheduledDate}
				<p class="text-sm opacity-70 mt-2">
					Scheduled: {formatDate(task.scheduledDate)}
				</p>
			{/if}
		</div>

		<!-- Recurrence Section -->
		<div class="recurrence-section mb-6 p-3 rounded-lg">
			<div class="flex items-center justify-between mb-2">
				<h4 class="text-sm font-medium opacity-70">Repeats</h4>
				<button
					type="button"
					class="recurrence-edit-btn px-2 py-1 rounded text-sm flex items-center gap-1"
					onclick={openRecurrenceSheet}
					title="Edit recurrence"
				>
					<span class="text-base">🔁</span>
					<span>{recurrence ? 'Edit' : 'Add'}</span>
				</button>
			</div>
			{#if recurrence}
				<p class="text-sm">{formatRecurrenceShort(recurrence)}</p>
				{#if task.seriesId}
					<p class="text-xs opacity-60 mt-1">Part of a recurring series</p>
				{/if}
			{:else}
				<p class="text-sm opacity-60">Not repeating</p>
			{/if}
		</div>
	</div>
</Sheet>

<!-- Recurrence Editing Sheet -->
<Sheet open={recurrenceSheetOpen} onclose={closeRecurrenceSheet} title="Edit Repeat">
	<div class="recurrence-edit-sheet">
		<div class="recurrence-type-selector flex gap-2 mb-4">
			<button
				type="button"
				class="recurrence-type-btn"
				class:active={editRecurrenceType === 'none'}
				onclick={() => editRecurrenceType = 'none'}
			>
				None
			</button>
			<button
				type="button"
				class="recurrence-type-btn"
				class:active={editRecurrenceType === 'weekly'}
				onclick={() => editRecurrenceType = 'weekly'}
			>
				Weekly
			</button>
			<button
				type="button"
				class="recurrence-type-btn"
				class:active={editRecurrenceType === 'monthly'}
				onclick={() => editRecurrenceType = 'monthly'}
			>
				Monthly
			</button>
		</div>

		{#if editRecurrenceType === 'weekly'}
			<div class="weekday-selector mb-4">
				<p class="text-sm opacity-70 mb-2">Repeat on:</p>
				<div class="flex gap-1 justify-center">
					{#each weekDayOptions as { value, label }}
						<button
							type="button"
							class="weekday-btn"
							class:selected={editWeeklyDays.includes(value)}
							onclick={() => toggleEditWeekDay(value)}
						>
							{label}
						</button>
					{/each}
				</div>
				{#if editWeeklyDays.length === 0}
					<p class="text-xs opacity-60 mt-2 text-center">Select at least one day</p>
				{/if}
			</div>
		{/if}

		{#if editRecurrenceType === 'monthly'}
			<div class="monthly-selector mb-4">
				<div class="flex items-center gap-2 justify-center">
					<span class="text-sm opacity-70">Day of month:</span>
					<select
						class="monthly-day-select p-2 rounded-lg"
						bind:value={editMonthlyDay}
					>
						{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
							<option value={day}>{day}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		<div class="flex justify-end gap-2 pt-4">
			<button
				type="button"
				class="cancel-btn px-4 py-2 rounded-lg"
				onclick={closeRecurrenceSheet}
			>
				Cancel
			</button>
			<button
				type="button"
				class="save-btn px-4 py-2 rounded-lg"
				onclick={saveRecurrence}
				disabled={editRecurrenceType === 'weekly' && editWeeklyDays.length === 0}
			>
				Save
			</button>
		</div>
	</div>
</Sheet>

<style>
	.task-row {
		background-color: rgb(var(--color-surface-100));
		transition: background-color 0.15s;
	}

	:global([data-theme='flexoki-dark']) .task-row {
		background-color: rgb(var(--color-surface-800));
	}

	:global([data-theme='ayu-dark']) .task-row {
		background-color: rgb(var(--color-surface-800));
	}

	.task-row:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .task-row:hover,
	:global([data-theme='ayu-dark']) .task-row:hover {
		background-color: rgb(var(--color-surface-700));
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
		color: white;
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

	:global([data-theme='flexoki-dark']) .chip-tag,
	:global([data-theme='ayu-dark']) .chip-tag {
		background-color: rgb(var(--color-primary-900));
		color: rgb(var(--color-primary-300));
	}

	.chip-context {
		background-color: rgb(var(--color-secondary-100));
		color: rgb(var(--color-secondary-700));
	}

	:global([data-theme='flexoki-dark']) .chip-context,
	:global([data-theme='ayu-dark']) .chip-context {
		background-color: rgb(var(--color-secondary-900));
		color: rgb(var(--color-secondary-300));
	}

	.chip-project {
		background-color: rgb(var(--color-tertiary-100));
		color: rgb(var(--color-tertiary-700));
	}

	:global([data-theme='flexoki-dark']) .chip-project,
	:global([data-theme='ayu-dark']) .chip-project {
		background-color: rgb(var(--color-tertiary-900));
		color: rgb(var(--color-tertiary-300));
	}

	.recurrence-label {
		color: rgb(var(--color-primary-600));
		background-color: rgb(var(--color-primary-50));
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	:global([data-theme='flexoki-dark']) .recurrence-label,
	:global([data-theme='ayu-dark']) .recurrence-label {
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

	:global([data-theme='flexoki-dark']) .time-spent,
	:global([data-theme='ayu-dark']) .time-spent {
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

	:global([data-theme='flexoki-dark']) .reschedule-dropdown,
	:global([data-theme='ayu-dark']) .reschedule-dropdown {
		background-color: rgb(var(--color-surface-700));
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
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .dropdown-item:hover,
	:global([data-theme='ayu-dark']) .dropdown-item:hover {
		background-color: rgb(var(--color-surface-600));
	}

	/* Context Menu Styles */
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
	}

	.context-menu {
		position: fixed;
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-200));
		border-radius: 0.75rem;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
		min-width: 200px;
		overflow: hidden;
		z-index: 201;
	}

	:global([data-theme='flexoki-dark']) .context-menu,
	:global([data-theme='ayu-dark']) .context-menu {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.quick-actions {
		display: flex;
		justify-content: space-around;
		padding: 0.75rem 0.5rem;
		gap: 0.25rem;
	}

	.quick-action-btn {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		border: none;
		background-color: rgb(var(--color-surface-100));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s, transform 0.1s;
	}

	:global([data-theme='flexoki-dark']) .quick-action-btn,
	:global([data-theme='ayu-dark']) .quick-action-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.quick-action-btn:hover {
		background-color: rgb(var(--color-primary-100));
		transform: scale(1.05);
	}

	:global([data-theme='flexoki-dark']) .quick-action-btn:hover,
	:global([data-theme='ayu-dark']) .quick-action-btn:hover {
		background-color: rgb(var(--color-primary-900));
	}

	.quick-action-btn:active {
		transform: scale(0.95);
	}

	.quick-action-delete:hover {
		background-color: rgb(var(--color-error-100));
	}

	:global([data-theme='flexoki-dark']) .quick-action-delete:hover,
	:global([data-theme='ayu-dark']) .quick-action-delete:hover {
		background-color: rgb(var(--color-error-900));
	}

	.quick-action-icon {
		font-size: 1.125rem;
	}

	.menu-divider {
		margin: 0;
		border: none;
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .menu-divider,
	:global([data-theme='ayu-dark']) .menu-divider {
		border-top-color: rgb(var(--color-surface-600));
	}

	.menu-options {
		padding: 0.5rem 0;
	}

	.menu-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9375rem;
		color: rgb(var(--body-text-color));
		text-align: left;
		transition: background-color 0.15s;
	}

	.menu-option:hover {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .menu-option:hover,
	:global([data-theme='ayu-dark']) .menu-option:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.menu-icon {
		width: 1.25rem;
		text-align: center;
		opacity: 0.7;
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

	:global([data-theme='flexoki-dark']) .time-spent-badge,
	:global([data-theme='ayu-dark']) .time-spent-badge {
		color: rgb(var(--color-tertiary-300));
		background-color: rgb(var(--color-tertiary-900) / 0.5);
	}

	.subtask-item {
		padding: 0.5rem;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-surface-50));
	}

	:global([data-theme='flexoki-dark']) .subtask-item,
	:global([data-theme='ayu-dark']) .subtask-item {
		background-color: rgb(var(--color-surface-700));
	}

	.subtask-checkbox {
		border-color: rgb(var(--color-surface-400));
		background: transparent;
		transition: all 0.15s;
	}

	.subtask-checkbox:hover {
		border-color: rgb(var(--color-primary-500));
	}

	.subtask-checkbox.checked {
		background-color: rgb(var(--color-primary-500));
		border-color: rgb(var(--color-primary-500));
		color: white;
	}

	.subtask-input {
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		color: inherit;
	}

	:global([data-theme='flexoki-dark']) .subtask-input,
	:global([data-theme='ayu-dark']) .subtask-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.add-subtask-btn {
		background-color: rgb(var(--color-primary-500));
		color: white;
		border: none;
		font-weight: bold;
	}

	.add-subtask-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.add-subtask-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	:global([data-theme='flexoki-dark']) .schedule-btn,
	:global([data-theme='ayu-dark']) .schedule-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.schedule-btn:hover {
		background-color: rgb(var(--color-primary-100));
		transform: scale(1.05);
	}

	:global([data-theme='flexoki-dark']) .schedule-btn:hover,
	:global([data-theme='ayu-dark']) .schedule-btn:hover {
		background-color: rgb(var(--color-primary-900));
	}

	.schedule-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.recurrence-section {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .recurrence-section,
	:global([data-theme='ayu-dark']) .recurrence-section {
		background-color: rgb(var(--color-surface-800));
	}

	.time-summary {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .time-summary,
	:global([data-theme='ayu-dark']) .time-summary {
		background-color: rgb(var(--color-surface-700));
	}

	.log-time-btn {
		background-color: rgb(var(--color-primary-500));
		color: white;
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

	:global([data-theme='flexoki-dark']) .date-input,
	:global([data-theme='ayu-dark']) .date-input {
		background-color: rgb(var(--color-surface-700));
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
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
		white-space: nowrap;
	}

	:global([data-theme='flexoki-dark']) .quick-date-btn,
	:global([data-theme='ayu-dark']) .quick-date-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.quick-date-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-theme='flexoki-dark']) .quick-date-btn:hover,
	:global([data-theme='ayu-dark']) .quick-date-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.quick-date-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	/* Recurrence editing styles */
	.recurrence-edit-btn {
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-theme='flexoki-dark']) .recurrence-edit-btn,
	:global([data-theme='ayu-dark']) .recurrence-edit-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.recurrence-edit-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-theme='flexoki-dark']) .recurrence-edit-btn:hover,
	:global([data-theme='ayu-dark']) .recurrence-edit-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.recurrence-type-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-theme='flexoki-dark']) .recurrence-type-btn,
	:global([data-theme='ayu-dark']) .recurrence-type-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.recurrence-type-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-theme='flexoki-dark']) .recurrence-type-btn:hover,
	:global([data-theme='ayu-dark']) .recurrence-type-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.recurrence-type-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.weekday-btn {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	:global([data-theme='flexoki-dark']) .weekday-btn,
	:global([data-theme='ayu-dark']) .weekday-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.weekday-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-theme='flexoki-dark']) .weekday-btn:hover,
	:global([data-theme='ayu-dark']) .weekday-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.weekday-btn.selected {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.monthly-day-select {
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-theme='flexoki-dark']) .monthly-day-select,
	:global([data-theme='ayu-dark']) .monthly-day-select {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.cancel-btn {
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
	}

	:global([data-theme='flexoki-dark']) .cancel-btn,
	:global([data-theme='ayu-dark']) .cancel-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.save-btn {
		background-color: rgb(var(--color-primary-500));
		color: white;
		border: none;
		cursor: pointer;
	}

	.save-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.save-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
