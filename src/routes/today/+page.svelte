<script lang="ts">
	import { onMount } from 'svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import DatePill from '$lib/components/DatePill.svelte';
	import ProjectTabs from '$lib/components/ProjectTabs.svelte';
	import { store, setSelectedDate } from '$lib/stores/app.svelte';
	import { getTodayDate, getOffsetDate, formatLocalDate } from '$lib/domain/task';
	import { getTotalMinutesForTask } from '$lib/domain/timeLog';
	import { tasksWithStartTimeForDay, seriesTemplates, completedForDay } from '$lib/domain/selectors';
	import type { Task } from '$lib/domain/task';
	import type { CalendarEvent } from '$lib/domain/calendar';
	import type { Recurrence } from '$lib/domain/recurrence';

	// Project filter state
	let selectedProject = $state<string | null>(null);

	// Collapsible section states (all minimized by default)
	let overdueExpanded = $state(false);
	let appointmentsExpanded = $state(false);
	let scheduledWithTimeExpanded = $state(false);
	let completedExpanded = $state(false);

	// Build a map of series templates for recurrence lookup
	const templateMap = $derived(() => {
		const map = new Map<string, Task>();
		for (const template of seriesTemplates(store.tasks)) {
			map.set(template.id, template);
		}
		return map;
	});

	// Get recurrence for a task (from its series template if it's an instance)
	function getRecurrenceForTask(task: Task): Recurrence | null {
		if (task.recurrence) return task.recurrence;
		if (task.seriesId) {
			const template = templateMap().get(task.seriesId);
			return template?.recurrence || null;
		}
		return null;
	}

	// Filter tasks by selected project
	function filterByProject(tasks: Task[]): Task[] {
		const proj = selectedProject;
		if (!proj) return tasks;
		return tasks.filter(
			(t) => t.project?.toLowerCase() === proj.toLowerCase()
		);
	}

	// Filtered task lists
	const filteredScheduledTasks = $derived(filterByProject(store.scheduledTasks));
	const filteredOverdueTasks = $derived(filterByProject(store.overdueTasks));
	const scheduledWithTime = $derived(
		filterByProject(tasksWithStartTimeForDay(store.tasks, store.selectedDate))
	);
	const filteredCompletedTasks = $derived(
		filterByProject(completedForDay(store.tasks, store.selectedDate))
	);

	function handleDateSelect(date: Date) {
		setSelectedDate(formatLocalDate(date));
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

	function formatEventTime(event: CalendarEvent): string {
		if (event.allDay) return 'All day';
		const start = new Date(event.start);
		const end = new Date(event.end);
		const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
		return `${startTime}–${endTime}`;
	}

	onMount(() => {
		setSelectedDate(getTodayDate());
	});
</script>

<main class="p-4">
	<!-- Header with date selector -->
	<header class="flex items-center justify-between mb-4">
		<h1 class="text-2xl font-bold">{formatDate(store.selectedDate)}</h1>
		<DatePill
			date={new Date(store.selectedDate + 'T00:00:00')}
			onselect={handleDateSelect}
		/>
	</header>

	<!-- Project filter tabs -->
	{#if store.allProjects.length > 0}
		<div class="mb-4">
			<ProjectTabs
				projects={store.allProjects}
				{selectedProject}
				onselect={(p) => (selectedProject = p)}
			/>
		</div>
	{/if}

	<!-- Scheduled tasks for selected day (always visible, at top) -->
	<section class="mb-6">
		<h2 class="section-header section-header-scheduled text-lg font-semibold mb-3 flex items-center gap-2">
			<span class="w-2 h-2 rounded-full bg-current"></span>
			Scheduled
			{#if filteredScheduledTasks.length > 0}
				<span class="text-sm font-normal opacity-70">({filteredScheduledTasks.length})</span>
			{/if}
		</h2>
		{#if filteredScheduledTasks.length > 0}
			<div class="task-list flex flex-col gap-2">
				{#each filteredScheduledTasks as task (task.id)}
					<TaskRow
						{task}
						recurrence={getRecurrenceForTask(task)}
						timeSpentMinutes={getTotalMinutesForTask(store.timeLogs, task.id)}
					/>
				{/each}
			</div>
		{:else}
			<p class="empty-state text-center py-8 opacity-60">
				No tasks scheduled for this day
			</p>
		{/if}
	</section>

	<!-- Overdue tasks (Tasks to Complete) - collapsible, only show if entries exist -->
	{#if filteredOverdueTasks.length > 0}
		<section class="mb-6">
			<button
				type="button"
				class="section-header section-header-overdue collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
				onclick={() => overdueExpanded = !overdueExpanded}
			>
				<span class="collapse-icon" class:expanded={overdueExpanded}>▶</span>
				<span class="w-2 h-2 rounded-full bg-current"></span>
				Tasks to Complete
				<span class="text-sm font-normal opacity-70">({filteredOverdueTasks.length})</span>
			</button>
			{#if overdueExpanded}
				<div class="task-list flex flex-col gap-2">
					{#each filteredOverdueTasks as task (task.id)}
						<TaskRow
							{task}
							recurrence={getRecurrenceForTask(task)}
							timeSpentMinutes={getTotalMinutesForTask(store.timeLogs, task.id)}
						/>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Scheduled Tasks with Start Time - collapsible, only show if entries exist -->
	{#if scheduledWithTime.length > 0}
		<section class="mb-6">
			<button
				type="button"
				class="section-header section-header-timed collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
				onclick={() => scheduledWithTimeExpanded = !scheduledWithTimeExpanded}
			>
				<span class="collapse-icon" class:expanded={scheduledWithTimeExpanded}>▶</span>
				<span class="w-2 h-2 rounded-full bg-current"></span>
				Scheduled Tasks with Start Time
				<span class="text-sm font-normal opacity-70">({scheduledWithTime.length})</span>
			</button>
			{#if scheduledWithTimeExpanded}
				<div class="task-list flex flex-col gap-2">
					{#each scheduledWithTime as task (task.id)}
						<div class="timed-task-row">
							<span class="task-time">{task.startTime}</span>
							<TaskRow
								{task}
								recurrence={getRecurrenceForTask(task)}
								timeSpentMinutes={getTotalMinutesForTask(store.timeLogs, task.id)}
							/>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Appointments - collapsible, only show if entries exist -->
	{#if store.calendarEventsForSelectedDate.length > 0}
		<section>
			<button
				type="button"
				class="section-header section-header-appointments collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
				onclick={() => appointmentsExpanded = !appointmentsExpanded}
			>
				<span class="collapse-icon" class:expanded={appointmentsExpanded}>▶</span>
				<span class="w-2 h-2 rounded-full bg-current"></span>
				Appointments
				<span class="text-sm font-normal opacity-70">
					({store.calendarEventsForSelectedDate.length})
				</span>
			</button>
			{#if appointmentsExpanded}
				<div class="appointment-list flex flex-col gap-2">
					{#each store.calendarEventsForSelectedDate as event (event.id)}
						<div class="appointment-card p-3 rounded-lg">
							<div class="flex items-center justify-between gap-2">
								<div class="font-medium">{event.title || 'Untitled event'}</div>
								<div class="text-xs opacity-70">{formatEventTime(event)}</div>
							</div>
							{#if event.location}
								<div class="text-xs opacity-70 mt-1">{event.location}</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Completed tasks - collapsible, only show if entries exist -->
	{#if filteredCompletedTasks.length > 0}
		<section class="mb-6">
			<button
				type="button"
				class="section-header section-header-completed collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
				onclick={() => completedExpanded = !completedExpanded}
			>
				<span class="collapse-icon" class:expanded={completedExpanded}>▶</span>
				<span class="w-2 h-2 rounded-full bg-current"></span>
				Completed
				<span class="text-sm font-normal opacity-70">({filteredCompletedTasks.length})</span>
			</button>
			{#if completedExpanded}
				<div class="task-list flex flex-col gap-2">
					{#each filteredCompletedTasks as task (task.id)}
						<TaskRow
							{task}
							recurrence={getRecurrenceForTask(task)}
							timeSpentMinutes={getTotalMinutesForTask(store.timeLogs, task.id)}
						/>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	.section-header-overdue {
		color: rgb(var(--color-error-500));
	}

	.section-header-scheduled {
		color: rgb(var(--color-primary-500));
	}

	.section-header-appointments {
		color: rgb(var(--color-secondary-500));
	}

	.section-header-timed {
		color: rgb(var(--color-tertiary-500));
	}

	.section-header-completed {
		color: rgb(var(--color-success-500));
	}

	.timed-task-row {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.task-time {
		flex-shrink: 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: rgb(var(--color-tertiary-600));
		min-width: 3.5rem;
		padding-top: 0.875rem;
	}

	:global([data-theme='flexoki-dark']) .task-time {
		color: rgb(var(--color-tertiary-400));
	}

	.timed-task-row :global(.task-row) {
		flex: 1;
	}

	.collapsible-header {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.collapse-icon {
		display: inline-block;
		font-size: 0.75rem;
		transition: transform 0.2s ease;
		opacity: 0.6;
	}

	.collapse-icon.expanded {
		transform: rotate(90deg);
	}

	.appointment-card {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .appointment-card {
		background-color: rgb(var(--color-surface-800));
	}
</style>
