<script lang="ts">
	import ViewTaskRow from '$lib/components/ViewTaskRow.svelte';
	import DatePill from '$lib/components/DatePill.svelte';
	import ProjectTabs from '$lib/components/ProjectTabs.svelte';
	import {
		markdownStore,
		initializeMarkdownStore,
		setSelectedDate
	} from '$lib/stores/markdown-store.svelte';
	import { getTodayDate, getOffsetDate, formatLocalDate } from '$lib/domain/task';
	import { filterByProject, filterNonHabits, type ViewTask } from '$lib/services/ViewService';
	import { formatDuration } from '$lib/domain/timeLog';
	import { eventMatchesKey, isEditableTarget } from '$lib/shortcuts/registry';

	// Project filter state
	let selectedProject = $state<string | null>(null);

	// Collapsible section states
	let pastExpanded = $state(false);
	let upcomingExpanded = $state(false);
	let wrappedExpanded = $state(false);

	// Filter tasks by selected project
	function filterTasksByProject(tasks: ViewTask[]): ViewTask[] {
		const proj = selectedProject;
		if (!proj) return tasks;
		return filterByProject(tasks, proj);
	}

	// Filtered grouped view (exclude habits)
	const pastTasks = $derived(filterTasksByProject(filterNonHabits(markdownStore.groupedView.past)));
	const nowTasks = $derived(filterTasksByProject(filterNonHabits(markdownStore.groupedView.now)));
	const upcomingTasks = $derived(filterTasksByProject(filterNonHabits(markdownStore.groupedView.upcoming)));
	const wrappedTasks = $derived(filterTasksByProject(filterNonHabits(markdownStore.groupedView.wrapped)));

	// Total time logged on the selected date (deduplicated by filename for recurring tasks)
	const totalTimeToday = $derived.by(() => {
		let total = 0;
		const seen = new Set<string>();
		for (const task of markdownStore.viewTasks) {
			if (seen.has(task.filename)) continue;
			seen.add(task.filename);
			total += task.timeTrackedToday;
		}
		return total;
	});

	function handleDateSelect(date: Date) {
		setSelectedDate(formatLocalDate(date));
	}

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function handleRouteShortcutKeydown(event: KeyboardEvent) {
		if (event.repeat || event.altKey || event.shiftKey) return;
		if (isEditableTarget(event.target)) return;
		if (!(event.ctrlKey || event.metaKey)) return;
		if (!eventMatchesKey(event, 'n')) return;
		event.preventDefault();
		window.dispatchEvent(new CustomEvent('daylight:shortcut:add-task'));
	}

	let initialized = $state(false);

	$effect(() => {
		if (initialized) return;
		initialized = true;
		setSelectedDate(getTodayDate());
		initializeMarkdownStore();
	});
</script>

<svelte:window onkeydown={handleRouteShortcutKeydown} />

<main class="p-4">
	<!-- Header with date selector -->
	<header class="flex items-center justify-between mb-4">
		<DatePill
			date={new Date(markdownStore.selectedDate + 'T00:00:00')}
			onselect={handleDateSelect}
		/>
		{#if totalTimeToday > 0}
			<span class="time-total">{formatDuration(totalTimeToday)}</span>
		{/if}
		<span class="date-label">{formatDate(markdownStore.selectedDate)}</span>
	</header>

	<!-- Loading state -->
	{#if markdownStore.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-lg opacity-60">Loading tasks...</div>
		</div>
	{:else}
		<!-- Error display -->
		{#if markdownStore.loadErrors.length > 0}
			<div class="mb-4 p-3 rounded-lg bg-error-100 text-error-700">
				<p class="font-medium">Some files could not be loaded:</p>
				<ul class="text-sm mt-1">
					{#each markdownStore.loadErrors as error}
						<li>{error.filename}: {error.message}</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Project filter tabs -->
		{#if markdownStore.allProjects.length > 0}
			<div class="mb-4">
				<ProjectTabs
					projects={markdownStore.allProjects}
					{selectedProject}
					onselect={(p) => (selectedProject = p)}
				/>
			</div>
		{/if}

		<!-- Now section (today's tasks) - always visible -->
		<section class="mb-6">
			<h2 class="section-header section-header-now text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-current"></span>
				Now
				{#if nowTasks.length > 0}
					<span class="text-sm font-normal opacity-70">({nowTasks.length})</span>
				{/if}
			</h2>
			{#if nowTasks.length > 0}
				<div class="task-list flex flex-col gap-2">
					{#each nowTasks as task (task.filename + (task.instanceDate || ''))}
						<ViewTaskRow {task} />
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No tasks for now
				</p>
			{/if}
		</section>

		<!-- Past section (overdue tasks) - collapsible -->
		{#if pastTasks.length > 0}
			<section class="mb-6">
				<button
					type="button"
					class="section-header section-header-past collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
					onclick={() => pastExpanded = !pastExpanded}
				>
					<span class="collapse-icon" class:expanded={pastExpanded}>&#x25B6;</span>
					<span class="w-2 h-2 rounded-full bg-current"></span>
					Past
					<span class="text-sm font-normal opacity-70">({pastTasks.length})</span>
				</button>
				{#if pastExpanded}
					<div class="task-list flex flex-col gap-2">
						{#each pastTasks as task (task.filename + (task.instanceDate || ''))}
							<ViewTaskRow {task} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Upcoming section - collapsible -->
		{#if upcomingTasks.length > 0}
			<section class="mb-6">
				<button
					type="button"
					class="section-header section-header-upcoming collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
					onclick={() => upcomingExpanded = !upcomingExpanded}
				>
					<span class="collapse-icon" class:expanded={upcomingExpanded}>&#x25B6;</span>
					<span class="w-2 h-2 rounded-full bg-current"></span>
					Upcoming
					<span class="text-sm font-normal opacity-70">({upcomingTasks.length})</span>
				</button>
				{#if upcomingExpanded}
					<div class="task-list flex flex-col gap-2">
						{#each upcomingTasks as task (task.filename + (task.instanceDate || ''))}
							<ViewTaskRow {task} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- Wrapped section (completed) - collapsible -->
		{#if wrappedTasks.length > 0}
			<section class="mb-6">
				<button
					type="button"
					class="section-header section-header-wrapped collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
					onclick={() => wrappedExpanded = !wrappedExpanded}
				>
					<span class="collapse-icon" class:expanded={wrappedExpanded}>&#x25B6;</span>
					<span class="w-2 h-2 rounded-full bg-current"></span>
					Wrapped
					<span class="text-sm font-normal opacity-70">({wrappedTasks.length})</span>
				</button>
				{#if wrappedExpanded}
					<div class="task-list flex flex-col gap-2">
						{#each wrappedTasks as task (task.filename + (task.instanceDate || ''))}
							<ViewTaskRow {task} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</main>

<style>
	.time-total {
		font-size: 0.875rem;
		font-weight: 500;
		opacity: 0.7;
	}

	.date-label {
		font-size: 0.875rem;
		font-weight: 600;
		opacity: 0.7;
	}

	.section-header-past {
		color: rgb(var(--color-error-500));
	}

	.section-header-now {
		color: rgb(var(--color-primary-500));
	}

	.section-header-upcoming {
		color: rgb(var(--color-secondary-500));
	}

	.section-header-wrapped {
		color: rgb(var(--color-success-500));
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
</style>
