<script lang="ts">
	import { page } from '$app/stores';
	import ViewTaskRow from '$lib/components/ViewTaskRow.svelte';
	import {
		markdownStore,
		initializeMarkdownStore
	} from '$lib/stores/markdown-store.svelte';
	import {
		filterByProject,
		filterIncomplete,
		filterCompleted,
		deduplicateByFilename,
		getTotalTimeInRange,
		type ViewTask
	} from '$lib/services/ViewService';
	import { formatDuration } from '$lib/domain/timeLog';
	import { getTodayDate, formatLocalDate } from '$lib/domain/task';

	// Get project name from URL parameter
	const projectName = $derived(decodeURIComponent($page.params.project ?? ''));

	// Filter tasks by project
	const projectTasks = $derived(filterByProject(markdownStore.viewTasks, projectName));

	// Separate into completed and incomplete
	const incompleteTasks = $derived(
		filterIncomplete(projectTasks).sort((a, b) => {
			const aDate = a.effectiveDate || a.frontmatter.scheduled;
			const bDate = b.effectiveDate || b.frontmatter.scheduled;
			if (!aDate && !bDate) return 0;
			if (!aDate) return 1;
			if (!bDate) return -1;
			return aDate.localeCompare(bDate);
		})
	);

	const completedTasks = $derived(
		filterCompleted(projectTasks).sort((a, b) => {
			const aDate = a.frontmatter.completedAt;
			const bDate = b.frontmatter.completedAt;
			if (!aDate && !bDate) return 0;
			if (!aDate) return 1;
			if (!bDate) return -1;
			return bDate.localeCompare(aDate);
		})
	);

	// Deduplicated tasks for time calculations (recurring tasks share timeEntries)
	const dedupedTasks = $derived(deduplicateByFilename(projectTasks));

	// Calculate total time spent on project
	const totalTimeSpent = $derived.by(() => {
		let total = 0;
		for (const task of dedupedTasks) {
			total += task.totalTimeTracked;
		}
		return total;
	});

	// Weekly and monthly time totals
	const today = $derived(getTodayDate());
	const weekStart = $derived.by(() => {
		const d = new Date(today + 'T00:00:00');
		d.setDate(d.getDate() - d.getDay());
		return formatLocalDate(d);
	});
	const monthStart = $derived.by(() => {
		const d = new Date(today + 'T00:00:00');
		return formatLocalDate(new Date(d.getFullYear(), d.getMonth(), 1));
	});
	const weeklyTime = $derived(getTotalTimeInRange(dedupedTasks, weekStart, today));
	const monthlyTime = $derived(getTotalTimeInRange(dedupedTasks, monthStart, today));

	// Collapsible state
	let completedExpanded = $state(false);

	// Initialize markdown store
	let initialized = $state(false);
	$effect(() => {
		if (initialized) return;
		initialized = true;
		initializeMarkdownStore();
	});
</script>

<main class="p-4">
	<!-- Header -->
	<header class="mb-6">
		<div class="flex items-center gap-3 mb-2">
			<span class="project-indicator"></span>
			<h1 class="text-2xl font-bold">{projectName}</h1>
		</div>
		<div class="flex items-center gap-4 text-sm opacity-70">
			<span>{incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''}</span>
			{#if totalTimeSpent > 0}
				<span>{formatDuration(totalTimeSpent)} total</span>
			{/if}
		</div>
		{#if weeklyTime > 0 || monthlyTime > 0}
			<div class="flex items-center gap-4 text-sm opacity-60 mt-1">
				{#if weeklyTime > 0}
					<span>This week: {formatDuration(weeklyTime)}</span>
				{/if}
				{#if monthlyTime > 0}
					<span>This month: {formatDuration(monthlyTime)}</span>
				{/if}
			</div>
		{/if}
	</header>

	{#if markdownStore.isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-lg opacity-60">Loading tasks...</div>
		</div>
	{:else}
		<!-- Incomplete tasks -->
		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full bg-primary"></span>
				Tasks
				{#if incompleteTasks.length > 0}
					<span class="text-sm font-normal opacity-70">({incompleteTasks.length})</span>
				{/if}
			</h2>
			{#if incompleteTasks.length > 0}
				<div class="task-list flex flex-col gap-2">
					{#each incompleteTasks as task (task.filename + (task.instanceDate || ''))}
						<ViewTaskRow {task} />
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No tasks in this project
				</p>
			{/if}
		</section>

		<!-- Completed tasks -->
		{#if completedTasks.length > 0}
			<section>
				<button
					type="button"
					class="collapsible-header w-full text-left text-lg font-semibold mb-3 flex items-center gap-2"
					onclick={() => completedExpanded = !completedExpanded}
				>
					<span class="collapse-icon" class:expanded={completedExpanded}>&#x25B6;</span>
					<span class="w-2 h-2 rounded-full bg-success"></span>
					Completed
					<span class="text-sm font-normal opacity-70">({completedTasks.length})</span>
				</button>
				{#if completedExpanded}
					<div class="task-list flex flex-col gap-2">
						{#each completedTasks as task (task.filename + (task.instanceDate || ''))}
							<ViewTaskRow {task} />
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	{/if}
</main>

<style>
	.project-indicator {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background-color: rgb(var(--color-tertiary-500));
	}

	.bg-primary {
		background-color: rgb(var(--color-primary-500));
	}

	.bg-success {
		background-color: rgb(var(--color-success-500));
	}

	.collapsible-header {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		color: rgb(var(--color-success-500));
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
