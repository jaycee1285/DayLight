<script lang="ts">
	import { page } from '$app/stores';
	import TaskRow from '$lib/components/TaskRow.svelte';
	import { store } from '$lib/stores/app.svelte';
	import { formatDuration } from '$lib/domain/timeLog';
	import { seriesTemplates } from '$lib/domain/selectors';
	import type { Task } from '$lib/domain/task';
	import type { Recurrence } from '$lib/domain/recurrence';

	// Get tag name from URL parameter
	const tagName = $derived(decodeURIComponent($page.params.tag));

	// Build template map for recurrence lookup
	const templateMap = $derived(() => {
		const map = new Map<string, Task>();
		for (const template of seriesTemplates(store.tasks)) {
			map.set(template.id, template);
		}
		return map;
	});

	function getRecurrenceForTask(task: Task): Recurrence | null {
		if (task.recurrence) return task.recurrence;
		if (task.seriesId) {
			const template = templateMap().get(task.seriesId);
			return template?.recurrence || null;
		}
		return null;
	}

	// Filter tasks by tag
	const taggedTasks = $derived(
		store.tasks.filter(
			(t) =>
				!t.isSeriesTemplate &&
				t.tags.some((tag) => tag.toLowerCase() === tagName.toLowerCase())
		)
	);

	// Separate into completed and incomplete
	const incompleteTasks = $derived(
		taggedTasks.filter((t) => !t.completed).sort((a, b) => {
			// Sort by scheduled date, nulls last
			if (!a.scheduledDate && !b.scheduledDate) return 0;
			if (!a.scheduledDate) return 1;
			if (!b.scheduledDate) return -1;
			return a.scheduledDate.localeCompare(b.scheduledDate);
		})
	);

	const completedTasks = $derived(
		taggedTasks.filter((t) => t.completed).sort((a, b) => {
			// Sort by completion date, most recent first
			if (!a.completedAt && !b.completedAt) return 0;
			if (!a.completedAt) return 1;
			if (!b.completedAt) return -1;
			return b.completedAt.localeCompare(a.completedAt);
		})
	);

	// Calculate total time spent on tagged tasks
	const totalTimeSpent = $derived(() => {
		let total = 0;
		for (const task of taggedTasks) {
			for (const log of store.timeLogs) {
				if (log.taskId === task.id) {
					total += log.minutes;
				}
			}
		}
		return total;
	});

	// Collapsible state
	let completedExpanded = $state(false);
</script>

<main class="p-4">
	<!-- Header -->
	<header class="mb-6">
		<div class="flex items-center gap-3 mb-2">
			<span class="tag-indicator"></span>
			<h1 class="text-2xl font-bold">#{tagName}</h1>
		</div>
		<div class="flex items-center gap-4 text-sm opacity-70">
			<span>{incompleteTasks.length} task{incompleteTasks.length !== 1 ? 's' : ''}</span>
			{#if totalTimeSpent() > 0}
				<span>{formatDuration(totalTimeSpent())} logged</span>
			{/if}
		</div>
	</header>

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
				{#each incompleteTasks as task (task.id)}
					<TaskRow {task} recurrence={getRecurrenceForTask(task)} />
				{/each}
			</div>
		{:else}
			<p class="empty-state text-center py-8 opacity-60">
				No tasks with this tag
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
				<span class="collapse-icon" class:expanded={completedExpanded}>▶</span>
				<span class="w-2 h-2 rounded-full bg-success"></span>
				Completed
				<span class="text-sm font-normal opacity-70">({completedTasks.length})</span>
			</button>
			{#if completedExpanded}
				<div class="task-list flex flex-col gap-2">
					{#each completedTasks as task (task.id)}
						<TaskRow {task} recurrence={getRecurrenceForTask(task)} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>

<style>
	.tag-indicator {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background-color: rgb(var(--color-primary-500));
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
