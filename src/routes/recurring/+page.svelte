<script lang="ts">
	import { store } from '$lib/stores/app.svelte';
	import { seriesTemplates } from '$lib/domain/selectors';
	import ProjectTabs from '$lib/components/ProjectTabs.svelte';
	import TaskRow from '$lib/components/TaskRow.svelte';

	let selectedProject = $state<string | null>(null);
	let selectedTag = $state<string | null>(null);

	// Get all recurring task templates
	const templates = $derived(seriesTemplates(store.tasks));

	// Filter by project if selected
	const filteredByProject = $derived(() => {
		const proj = selectedProject;
		if (!proj) return templates;
		return templates.filter((t) => t.project?.toLowerCase() === proj.toLowerCase());
	});

	// Filter by tag if selected
	const filteredTemplates = $derived(() => {
		const tag = selectedTag;
		const byProject = filteredByProject();
		if (!tag) return byProject;
		return byProject.filter((t) =>
			t.tags.some((tg) => tg.toLowerCase() === tag.toLowerCase())
		);
	});
</script>

<div class="recurring-page p-4">
	<h1 class="text-xl font-semibold mb-4">Recurring Tasks</h1>

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

	<!-- Tag filter (optional) -->
	{#if store.allTags.length > 0}
		<div class="tag-filter mb-4">
			<span class="text-sm opacity-70 mr-2">Filter by tag:</span>
			<select
				class="tag-select"
				bind:value={selectedTag}
			>
				<option value={null}>All tags</option>
				{#each store.allTags as tag}
					<option value={tag}>{tag}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Recurring tasks list -->
	{#if filteredTemplates().length === 0}
		<div class="empty-state text-center py-12 opacity-60">
			<p class="text-lg">No recurring tasks</p>
			<p class="text-sm mt-2">Create a recurring task to see it here.</p>
		</div>
	{:else}
		<div class="recurring-list space-y-2">
			{#each filteredTemplates() as template (template.id)}
				<TaskRow task={template} recurrence={template.recurrence} />
			{/each}
		</div>

		<div class="summary mt-6 text-sm opacity-70">
			{filteredTemplates().length} recurring task{filteredTemplates().length !== 1 ? 's' : ''}
		</div>
	{/if}
</div>

<style>
	.tag-select {
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--body-text-color));
		font-size: 0.875rem;
	}

	:global([data-theme='flexoki-dark']) .tag-select {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}
</style>
