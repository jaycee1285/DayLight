<script lang="ts">
	import ViewTaskRow from '$lib/components/ViewTaskRow.svelte';
	import ProjectTabs from '$lib/components/ProjectTabs.svelte';
	import {
		markdownStore,
		initializeMarkdownStore
	} from '$lib/stores/markdown-store.svelte';
	import {
		filterRecurring,
		filterByProject,
		filterByTag,
		sortByUrgency,
		deduplicateByFilename,
		type ViewTask
	} from '$lib/services/ViewService';
	import { formatRecurrenceShort } from '$lib/domain/recurrence';
	import { rruleToRecurrence } from '$lib/storage/frontmatter';
	import { getTodayDate, getOffsetDate } from '$lib/domain/task';

	// Filter state
	let selectedProject = $state<string | null>(null);
	let selectedTag = $state<string | null>(null);

	// Get all recurring tasks (deduplicated - one per file, not per instance)
	const recurringTasks = $derived(deduplicateByFilename(filterRecurring(markdownStore.viewTasks)));

	// Apply filters
	const filteredByProject = $derived.by(() => {
		if (!selectedProject) return recurringTasks;
		return filterByProject(recurringTasks, selectedProject);
	});

	const filteredTasks = $derived.by(() => {
		if (!selectedTag) return sortByUrgency(filteredByProject);
		return sortByUrgency(filterByTag(filteredByProject, selectedTag));
	});

	// Get recurrence label for display
	function getRecurrenceLabel(task: ViewTask): string {
		if (!task.frontmatter.recurrence) return '';
		const recurrence = rruleToRecurrence(task.frontmatter.recurrence);
		return recurrence ? formatRecurrenceShort(recurrence) : '';
	}

	// Get the next uncompleted instance date
	function getNextUncompletedInstance(task: ViewTask): string | null {
		const fm = task.frontmatter;
		const today = getTodayDate();

		// Sort active instances and find first uncompleted one >= today
		const sorted = [...fm.active_instances].sort();
		for (const date of sorted) {
			if (date >= today &&
				!fm.complete_instances.includes(date) &&
				!fm.skipped_instances.includes(date)) {
				return date;
			}
		}

		// Fallback to scheduled date if it's in the future
		if (fm.scheduled && fm.scheduled >= today) {
			return fm.scheduled;
		}

		return null;
	}

	// Format date for "Next:" display
	function formatNextDate(dateStr: string): string {
		const today = getTodayDate();
		const tomorrow = getOffsetDate(1);
		const yesterday = getOffsetDate(-1);

		if (dateStr === today) return 'Today';
		if (dateStr === tomorrow) return 'Tomorrow';
		if (dateStr === yesterday) return 'Yesterday';

		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
	}

	// Initialization
	let initialized = $state(false);

	$effect(() => {
		if (initialized) return;
		initialized = true;
		initializeMarkdownStore();
	});
</script>

<main class="p-4">
	<h1 class="text-2xl font-bold mb-4">Recurring Tasks</h1>

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

		<!-- Tag filter -->
		{#if markdownStore.allTags.length > 0}
			<div class="tag-filter mb-4">
				<span class="text-sm opacity-70 mr-2">Filter by tag:</span>
				<select
					class="tag-select"
					bind:value={selectedTag}
				>
					<option value={null}>All tags</option>
					{#each markdownStore.allTags as tag}
						<option value={tag}>{tag}</option>
					{/each}
				</select>
			</div>
		{/if}

		<!-- Recurring tasks list -->
		{#if filteredTasks.length === 0}
			<div class="empty-state text-center py-12 opacity-60">
				<p class="text-lg">No recurring tasks</p>
				<p class="text-sm mt-2">Create a recurring task to see it here.</p>
			</div>
		{:else}
			<div class="recurring-list space-y-2">
				{#each filteredTasks as task (task.filename)}
					{@const nextDate = getNextUncompletedInstance(task)}
					<div class="recurring-task-item">
						<ViewTaskRow {task} />
						<div class="recurrence-info text-xs opacity-60 ml-9 -mt-1 mb-2">
							{getRecurrenceLabel(task)}
							{#if nextDate}
								<span class="ml-2">
									Next: {formatNextDate(nextDate)}
								</span>
							{:else}
								<span class="ml-2 text-success-500">All caught up!</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="summary mt-6 text-sm opacity-70">
				{filteredTasks.length} recurring task{filteredTasks.length !== 1 ? 's' : ''}
			</div>
		{/if}
	{/if}
</main>

<style>
	.tag-select {
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--body-text-color));
		font-size: 0.875rem;
	}

	:global([data-mode='dark']) .tag-select {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.recurrence-info {
		padding-left: 2.25rem;
	}
</style>
