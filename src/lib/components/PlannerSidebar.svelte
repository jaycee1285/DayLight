<script lang="ts">
	import PlannerTaskChip from './PlannerTaskChip.svelte';
	import {
		getUnplannedTasksForDates,
		getBacklogTasks,
		type ViewTask
	} from '$lib/services/ViewService';

	interface Props {
		weekDays: string[];
		viewTasks: ViewTask[];
	}

	let { weekDays, viewTasks }: Props = $props();

	const unplanned = $derived(getUnplannedTasksForDates(viewTasks, weekDays));
	const backlog = $derived(getBacklogTasks(viewTasks));

	let showBacklog = $state(false);
</script>

<aside class="planner-sidebar">
	<!-- Unplanned tasks for this week -->
	<section class="sidebar-section">
		<h3 class="sidebar-heading">
			Unplanned this week
			{#if unplanned.length > 0}
				<span class="count">{unplanned.length}</span>
			{/if}
		</h3>
		{#if unplanned.length > 0}
			<div class="chip-list" role="list">
				{#each unplanned as task (task.filename + (task.instanceDate || ''))}
					<PlannerTaskChip {task} />
				{/each}
			</div>
		{:else}
			<p class="empty-hint">All tasks have time blocks</p>
		{/if}
	</section>

	<!-- Backlog (unscheduled tasks) -->
	<section class="sidebar-section">
		<button
			type="button"
			class="sidebar-heading toggle-heading"
			onclick={() => showBacklog = !showBacklog}
		>
			Backlog
			{#if backlog.length > 0}
				<span class="count">{backlog.length}</span>
			{/if}
			<span class="toggle-arrow" class:open={showBacklog}>&#x25B6;</span>
		</button>
		{#if showBacklog}
			{#if backlog.length > 0}
				<div class="chip-list" role="list">
					{#each backlog as task (task.filename)}
						<PlannerTaskChip {task} />
					{/each}
				</div>
			{:else}
				<p class="empty-hint">No unscheduled tasks</p>
			{/if}
		{/if}
	</section>
</aside>

<style>
	.planner-sidebar {
		width: 220px;
		min-width: 220px;
		border-left: 1px solid rgb(var(--color-surface-200));
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		overflow-y: auto;
		max-height: 100%;
		background-color: rgb(var(--color-surface-50));
	}

	:global([data-theme='flexoki-dark']) .planner-sidebar,
	:global([data-theme='ayu-dark']) .planner-sidebar {
		border-left-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-900));
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.sidebar-heading {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.toggle-heading {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		text-align: left;
		color: inherit;
		width: 100%;
	}

	.toggle-arrow {
		font-size: 0.5rem;
		margin-left: auto;
		transition: transform 0.2s;
	}

	.toggle-arrow.open {
		transform: rotate(90deg);
	}

	.count {
		font-size: 0.6875rem;
		background-color: rgb(var(--color-surface-200));
		padding: 0 6px;
		border-radius: 9999px;
		font-weight: 500;
	}

	:global([data-theme='flexoki-dark']) .count,
	:global([data-theme='ayu-dark']) .count {
		background-color: rgb(var(--color-surface-700));
	}

	.chip-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.empty-hint {
		font-size: 0.75rem;
		opacity: 0.5;
		text-align: center;
		padding: 12px 0;
	}
</style>
