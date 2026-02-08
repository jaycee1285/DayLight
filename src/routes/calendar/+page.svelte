<script lang="ts">
	import ViewTaskRow from '$lib/components/ViewTaskRow.svelte';
	import WeeklyTimeGrid from '$lib/components/WeeklyTimeGrid.svelte';
	import PlannerSidebar from '$lib/components/PlannerSidebar.svelte';
	import DailyScheduleView from '$lib/components/DailyScheduleView.svelte';
	import { onMount } from 'svelte';
	import {
		markdownStore,
		initializeMarkdownStore,
		setSelectedDate
	} from '$lib/stores/markdown-store.svelte';
	import { getTodayDate, formatLocalDate } from '$lib/domain/task';
	import {
		getTasksForDate,
		getTasksInDateRange,
		type ViewTask
	} from '$lib/services/ViewService';

	// View mode
	type ViewMode = 'week' | 'month' | 'planner';
	let viewMode = $state<ViewMode>('week');

	// Get tasks for the selected date
	const tasksForDay = $derived(getTasksForDate(markdownStore.viewTasks, markdownStore.selectedDate));

	// Collapsible state for each day in week view
	let expandedDays = $state<Set<string>>(new Set([getTodayDate()]));

	function toggleDayExpanded(day: string) {
		if (expandedDays.has(day)) {
			expandedDays = new Set([...expandedDays].filter(d => d !== day));
		} else {
			expandedDays = new Set([...expandedDays, day]);
		}
	}

	function getTasksForDateHelper(date: string): ViewTask[] {
		return getTasksForDate(markdownStore.viewTasks, date);
	}

	// Truncate text to roughly 10 characters for month view
	function truncateTitle(title: string, maxChars: number = 10): string {
		if (title.length <= maxChars) return title;
		return title.substring(0, maxChars - 1) + '…';
	}

	// Get the week days centered around selected date
	const weekDays = $derived.by(() => {
		const selected = new Date(markdownStore.selectedDate + 'T00:00:00');
		const dayOfWeek = selected.getDay(); // 0 = Sunday
		const days: string[] = [];

		// Start from Sunday of the current week
		const startOfWeek = new Date(selected);
		startOfWeek.setDate(selected.getDate() - dayOfWeek);

		for (let i = 0; i < 7; i++) {
			const day = new Date(startOfWeek);
			day.setDate(startOfWeek.getDate() + i);
			days.push(formatLocalDate(day));
		}
		return days;
	});

	// Get the month calendar grid
	const monthDays = $derived.by(() => {
		const selected = new Date(markdownStore.selectedDate + 'T00:00:00');
		const year = selected.getFullYear();
		const month = selected.getMonth();

		// First day of month
		const firstDay = new Date(year, month, 1);
		const startDayOfWeek = firstDay.getDay();

		// Last day of month
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();

		const days: (string | null)[] = [];

		// Add empty cells for days before the 1st
		for (let i = 0; i < startDayOfWeek; i++) {
			days.push(null);
		}

		// Add all days of the month
		for (let i = 1; i <= daysInMonth; i++) {
			const day = new Date(year, month, i);
			days.push(formatLocalDate(day));
		}

		return days;
	});

	// Get month/year label for header
	const monthYearLabel = $derived.by(() => {
		const selected = new Date(markdownStore.selectedDate + 'T00:00:00');
		return selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	});

	// Count tasks for a given date
	function getTaskCount(dateStr: string): number {
		return getTasksForDate(markdownStore.viewTasks, dateStr).length;
	}

	// Navigate week or month
	function navigatePeriod(offset: number) {
		const current = new Date(markdownStore.selectedDate + 'T00:00:00');
		if (viewMode === 'week' || viewMode === 'planner') {
			current.setDate(current.getDate() + offset * 7);
		} else {
			current.setMonth(current.getMonth() + offset);
		}
		setSelectedDate(formatLocalDate(current));
	}

	function formatDayOfWeek(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'short' });
	}

	function formatDayNumber(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.getDate().toString();
	}

	// Initialization
	let initialized = $state(false);

	$effect(() => {
		if (initialized) return;
		initialized = true;
		setSelectedDate(getTodayDate());
		initializeMarkdownStore();
	});

	let isDesktop = $state(true);

	onMount(() => {
		const mq = window.matchMedia('(min-width: 768px)');
		isDesktop = mq.matches;
		function onResize() { isDesktop = mq.matches; }
		mq.addEventListener('change', onResize);
		return () => mq.removeEventListener('change', onResize);
	});
</script>

<main class="p-4" class:planner-mode={viewMode === 'planner'}>
	<!-- Loading state -->
	{#if markdownStore.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-lg opacity-60">Loading tasks...</div>
		</div>
	{:else}
		<!-- Calendar header -->
		<header class="mb-4">
			<!-- Navigation and view toggle -->
			<div class="flex items-center justify-between mb-3">
				<button
					type="button"
					class="nav-button p-2 rounded-lg"
					onclick={() => navigatePeriod(-1)}
					aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
				>
					←
				</button>

				<div class="text-center">
					<div class="text-lg font-semibold">{monthYearLabel}</div>
				</div>

				<button
					type="button"
					class="nav-button p-2 rounded-lg"
					onclick={() => navigatePeriod(1)}
					aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
				>
					→
				</button>
			</div>

			<!-- View mode toggle -->
			<div class="flex justify-center mb-4">
				<div class="view-toggle flex rounded-lg overflow-hidden">
					<button
						type="button"
						class="toggle-btn px-4 py-2 text-sm"
						class:active={viewMode === 'week'}
						onclick={() => (viewMode = 'week')}
					>
						Week
					</button>
					<button
						type="button"
						class="toggle-btn px-4 py-2 text-sm"
						class:active={viewMode === 'month'}
						onclick={() => (viewMode = 'month')}
					>
						Month
					</button>
					<button
						type="button"
						class="toggle-btn px-4 py-2 text-sm"
						class:active={viewMode === 'planner'}
						onclick={() => (viewMode = 'planner')}
					>
						Planner
					</button>
				</div>
			</div>

			{#if viewMode !== 'planner'}
			<!-- Week day headers -->
			<div class="weekday-headers grid grid-cols-7 gap-1 mb-2">
				{#each ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as dayLabel}
					<div class="text-center text-xs font-medium opacity-60">{dayLabel}</div>
				{/each}
			</div>

			<!-- Week view - vertical with collapsible panes -->
			{#if viewMode === 'week'}
				<div class="week-vertical space-y-2">
					{#each weekDays as day}
						{@const dayTasks = getTasksForDateHelper(day)}
						<div class="day-pane rounded-lg overflow-hidden" class:today={day === getTodayDate()}>
							<button
								type="button"
								class="day-pane-header w-full flex items-center justify-between p-3"
								class:selected={day === markdownStore.selectedDate}
								onclick={() => {
									setSelectedDate(day);
									toggleDayExpanded(day);
								}}
							>
								<div class="flex items-center gap-3">
									<span class="collapse-icon" class:expanded={expandedDays.has(day)}>&#x25B6;</span>
									<span class="day-name font-medium">{formatDayOfWeek(day)}</span>
									<span class="day-number text-lg">{formatDayNumber(day)}</span>
								</div>
								<div class="flex items-center gap-2">
									{#if dayTasks.length > 0}
										<span class="task-count text-sm opacity-70">{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</span>
									{/if}
									{#if day === getTodayDate()}
										<span class="today-badge text-xs px-2 py-0.5 rounded-full">Today</span>
									{/if}
								</div>
							</button>

							{#if expandedDays.has(day)}
								<div class="day-pane-content p-3 pt-0">
									{#if dayTasks.length > 0}
										<div class="task-list space-y-2">
											{#each dayTasks as task (task.filename + (task.instanceDate || ''))}
												<ViewTaskRow {task} />
											{/each}
										</div>
									{:else}
										<p class="text-sm opacity-60 py-2">No tasks</p>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<!-- Month view - with task previews -->
				<div class="month-grid grid grid-cols-7 gap-1">
					{#each monthDays as day}
						{#if day}
							{@const dayTasks = getTasksForDateHelper(day).slice(0, 3)}
							{@const totalItems = getTaskCount(day)}
							<button
								type="button"
								class="month-day-cell p-1 rounded-lg text-left"
								class:selected={day === markdownStore.selectedDate}
								class:today={day === getTodayDate()}
								onclick={() => setSelectedDate(day)}
							>
								<div class="day-header flex justify-between items-center mb-1">
									<span class="text-sm font-medium">{formatDayNumber(day)}</span>
									{#if totalItems > 0}
										<span class="item-count text-xs opacity-60">{totalItems}</span>
									{/if}
								</div>
								<div class="day-previews space-y-0.5">
									{#each dayTasks as task}
										<div
											class="preview-item preview-task truncate text-xs"
											class:completed={task.instanceDate
												? task.frontmatter.complete_instances.includes(task.instanceDate)
												: task.frontmatter.complete_instances.includes(day)}
										>
											{truncateTitle(task.title || 'Task', 10)}
										</div>
									{/each}
									{#if totalItems > 3}
										<div class="more-items text-xs opacity-50">
											+{totalItems - 3} more
										</div>
									{/if}
								</div>
							</button>
						{:else}
							<div class="day-cell-empty"></div>
						{/if}
					{/each}
				</div>
			{/if}
			{/if}
		</header>

		{#if viewMode === 'planner'}
			{#if isDesktop}
				<div class="planner-layout">
					<WeeklyTimeGrid {weekDays} viewTasks={markdownStore.viewTasks} />
					<PlannerSidebar {weekDays} viewTasks={markdownStore.viewTasks} />
				</div>
			{:else}
				<DailyScheduleView
					selectedDate={markdownStore.selectedDate}
					viewTasks={markdownStore.viewTasks}
					{weekDays}
				/>
			{/if}
		{:else}
		<!-- Tasks section for selected date -->
		<section>
			<h2 class="section-header text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full" style="background-color: rgb(var(--color-primary-500))"></span>
				Tasks for {formatDayOfWeek(markdownStore.selectedDate)}, {formatDayNumber(markdownStore.selectedDate)}
				{#if tasksForDay.length > 0}
					<span class="text-sm font-normal opacity-70">({tasksForDay.length})</span>
				{/if}
			</h2>
			{#if tasksForDay.length > 0}
				<div class="task-list flex flex-col gap-2">
					{#each tasksForDay as task (task.filename + (task.instanceDate || ''))}
						<ViewTaskRow {task} />
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No tasks scheduled for this day
				</p>
			{/if}
		</section>
		{/if}
	{/if}
</main>

<style>
	.nav-button {
		background-color: rgb(var(--color-surface-200));
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .nav-button {
		background-color: rgb(var(--color-surface-700));
	}

	.nav-button:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .nav-button:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.view-toggle {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .view-toggle {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.toggle-btn {
		background: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	.toggle-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .toggle-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.toggle-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.day-cell-empty {
		min-height: 2.5rem;
	}

	/* Week vertical view styles */
	.day-pane {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .day-pane {
		background-color: rgb(var(--color-surface-800));
	}

	.day-pane.today {
		border: 2px solid rgb(var(--color-primary-500));
	}

	.day-pane-header {
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s;
	}

	.day-pane-header:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .day-pane-header:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.day-pane-header.selected {
		background-color: rgb(var(--color-primary-100));
	}

	:global([data-mode='dark']) .day-pane-header.selected {
		background-color: rgb(var(--color-primary-900) / 0.5);
	}

	.collapse-icon {
		display: inline-block;
		font-size: 0.625rem;
		transition: transform 0.2s ease;
		opacity: 0.6;
	}

	.collapse-icon.expanded {
		transform: rotate(90deg);
	}

	.today-badge {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.day-pane-content {
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .day-pane-content {
		border-top-color: rgb(var(--color-surface-600));
	}

	/* Month view styles */
	.month-day-cell {
		background-color: rgb(var(--color-surface-100));
		border: none;
		cursor: pointer;
		transition: all 0.15s;
		min-height: 4.5rem;
		min-width: 0;
		overflow: hidden;
	}

	:global([data-mode='dark']) .month-day-cell {
		background-color: rgb(var(--color-surface-800));
	}

	.month-day-cell:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .month-day-cell:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.month-day-cell.today {
		border: 2px solid rgb(var(--color-primary-500));
	}

	.month-day-cell.selected {
		background-color: rgb(var(--color-primary-100));
	}

	:global([data-mode='dark']) .month-day-cell.selected {
		background-color: rgb(var(--color-primary-900) / 0.5);
	}

	.preview-item {
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		line-height: 1.2;
	}

	.preview-task {
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-700));
	}

	:global([data-mode='dark']) .preview-task {
		background-color: rgb(var(--color-primary-900));
		color: rgb(var(--color-primary-300));
	}

	.preview-task.completed {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.item-count {
		background-color: rgb(var(--color-hover-bg));
		padding: 0 0.25rem;
		border-radius: 9999px;
		font-size: 0.625rem;
	}

	:global([data-mode='dark']) .item-count {
		background-color: rgb(var(--color-surface-600));
	}

	/* Planner mode */
	.planner-mode {
		display: flex;
		flex-direction: column;
		max-height: 100dvh;
		overflow: hidden;
	}

	.planner-mode :global(header) {
		flex-shrink: 0;
	}

	.planner-layout {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}
</style>
