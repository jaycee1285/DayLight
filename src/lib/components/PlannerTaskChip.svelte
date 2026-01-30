<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';

	interface Props {
		task: ViewTask;
	}

	let { task }: Props = $props();

	const priority = $derived(task.frontmatter.priority);
	const project = $derived(task.frontmatter.projects[0] ?? null);

	function handleDragStart(e: DragEvent) {
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', task.filename);
			e.dataTransfer.effectAllowed = 'move';
		}
	}
</script>

<div
	class="planner-chip"
	class:priority-high={priority === 'high'}
	class:priority-normal={priority === 'normal'}
	draggable="true"
	ondragstart={handleDragStart}
	role="listitem"
>
	<span class="chip-title">{task.title}</span>
	{#if project}
		<span class="chip-project">{project}</span>
	{/if}
</div>

<style>
	.planner-chip {
		padding: 6px 10px;
		border-radius: 6px;
		font-size: 0.8125rem;
		cursor: grab;
		background-color: rgb(var(--color-surface-200));
		border-left: 3px solid rgb(var(--color-surface-400));
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition: background-color 0.15s, box-shadow 0.15s;
	}

	:global([data-theme='flexoki-dark']) .planner-chip,
	:global([data-theme='ayu-dark']) .planner-chip {
		background-color: rgb(var(--color-surface-700));
		border-left-color: rgb(var(--color-surface-500));
	}

	.planner-chip:hover {
		background-color: rgb(var(--color-surface-300));
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}

	:global([data-theme='flexoki-dark']) .planner-chip:hover,
	:global([data-theme='ayu-dark']) .planner-chip:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.planner-chip:active {
		cursor: grabbing;
	}

	.planner-chip.priority-high {
		border-left-color: rgb(var(--color-warning-500));
	}

	.planner-chip.priority-normal {
		border-left-color: rgb(var(--color-primary-500));
	}

	.chip-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
	}

	.chip-project {
		font-size: 0.6875rem;
		opacity: 0.6;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
