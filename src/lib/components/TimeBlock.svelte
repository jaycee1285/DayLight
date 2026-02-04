<script lang="ts">
	import type { TimeBlock } from '$lib/services/ViewService';
	import { formatDuration } from '$lib/domain/timeLog';

	interface Props {
		block: TimeBlock;
		pixelsPerMinute: number;
		dayStartMinutes: number;
		isColliding: boolean;
		ondragstart?: (e: DragEvent) => void;
		onresizestart?: (e: PointerEvent) => void;
		onclick?: () => void;
	}

	let {
		block,
		pixelsPerMinute,
		dayStartMinutes,
		isColliding,
		ondragstart,
		onresizestart,
		onclick
	}: Props = $props();

	const top = $derived((block.startMinutes - dayStartMinutes) * pixelsPerMinute);
	const height = $derived(Math.max(block.durationMinutes * pixelsPerMinute, 20));
	const title = $derived(block.task.title);
	const duration = $derived(formatDuration(block.durationMinutes));
	const priority = $derived(block.task.frontmatter.priority);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="time-block"
	class:colliding={isColliding}
	class:priority-high={priority === 'high'}
	style="top: {top}px; height: {height}px;"
	draggable="true"
	ondragstart={ondragstart}
	onclick={onclick}
	role="button"
	tabindex="0"
	aria-label="{title} - {duration}"
>
	<div class="block-content">
		<span class="block-title">{title}</span>
		{#if height > 36}
			<span class="block-duration">{duration}</span>
		{/if}
	</div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="resize-handle"
		onpointerdown={(e) => { e.stopPropagation(); onresizestart?.(e); }}
	></div>
</div>

<style>
	.time-block {
		position: absolute;
		left: 2px;
		right: 2px;
		border-radius: 4px;
		cursor: grab;
		overflow: hidden;
		z-index: 1;
		border-left: 3px solid rgb(var(--color-primary-500));
		background-color: rgb(var(--color-primary-100));
		color: rgb(var(--color-primary-800));
		transition: box-shadow 0.15s;
	}

	:global([data-mode='dark']) .time-block {
		background-color: rgb(var(--color-primary-900) / 0.6);
		color: rgb(var(--color-primary-200));
	}

	.time-block:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 2;
	}

	.time-block:active {
		cursor: grabbing;
	}

	.time-block.colliding {
		border-left-color: rgb(var(--color-error-500));
	}

	.time-block.priority-high {
		border-left-color: rgb(var(--color-warning-500));
	}

	.time-block.priority-high.colliding {
		border-left-color: rgb(var(--color-error-500));
	}

	.block-content {
		padding: 2px 6px;
		display: flex;
		flex-direction: column;
		gap: 0;
		height: calc(100% - 6px);
		overflow: hidden;
	}

	.block-title {
		font-size: 0.75rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		line-height: 1.3;
	}

	.block-duration {
		font-size: 0.625rem;
		opacity: 0.7;
	}

	.resize-handle {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 6px;
		cursor: ns-resize;
		background: transparent;
	}

	.resize-handle:hover {
		background-color: rgb(var(--color-primary-300) / 0.5);
	}

	:global([data-mode='dark']) .resize-handle:hover {
		background-color: rgb(var(--color-primary-700) / 0.5);
	}
</style>
