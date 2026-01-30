<script lang="ts">
	import TimeBlockComponent from './TimeBlock.svelte';
	import {
		getTimeBlocksForDate,
		detectCollisions,
		parseTimeToMinutes,
		minutesToTime,
		snapToGrid,
		type ViewTask,
		type TimeBlock
	} from '$lib/services/ViewService';
	import { updateTaskTimeBlock } from '$lib/stores/markdown-store.svelte';
	import { markdownStore } from '$lib/stores/markdown-store.svelte';
	import { formatDuration } from '$lib/domain/timeLog';

	interface Props {
		weekDays: string[];
		viewTasks: ViewTask[];
		dayStartHour?: number;
		dayEndHour?: number;
		snapIncrement?: number;
	}

	let {
		weekDays,
		viewTasks,
		dayStartHour = 6,
		dayEndHour = 22,
		snapIncrement = 15
	}: Props = $props();

	const SLOT_HEIGHT = 60; // px per hour
	const dayStartMinutes = $derived(dayStartHour * 60);
	const dayEndMinutes = $derived(dayEndHour * 60);
	const totalMinutes = $derived(dayEndMinutes - dayStartMinutes);
	const gridHeight = $derived((totalMinutes / 60) * SLOT_HEIGHT);
	const pixelsPerMinute = $derived(SLOT_HEIGHT / 60);

	// Hours for row labels
	const hours = $derived(
		Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i)
	);

	// Day header labels
	function formatDayHeader(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
		const dayNum = d.getDate();
		return `${dayName} ${dayNum}`;
	}

	function isToday(dateStr: string): boolean {
		const today = new Date();
		const d = new Date(dateStr + 'T00:00:00');
		return d.getDate() === today.getDate() &&
			d.getMonth() === today.getMonth() &&
			d.getFullYear() === today.getFullYear();
	}

	// Compute time blocks per day
	const blocksByDay = $derived.by(() => {
		const result = new Map<string, { blocks: TimeBlock[]; collisions: Set<string> }>();
		for (const day of weekDays) {
			const blocks = getTimeBlocksForDate(viewTasks, day);
			const collisions = detectCollisions(blocks);
			result.set(day, { blocks, collisions });
		}
		return result;
	});

	// Drag-and-drop state
	let dragPreview = $state<{ day: string; startMinutes: number; durationMinutes: number } | null>(null);

	// Resize state
	let resizing = $state<{
		filename: string;
		day: string;
		startMinutes: number;
		originalDuration: number;
		startY: number;
	} | null>(null);
	let resizeDuration = $state(0);

	function handleDragOver(e: DragEvent, day: string) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}

		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const rawMinutes = dayStartMinutes + (y / pixelsPerMinute);
		const snapped = snapToGrid(rawMinutes, snapIncrement);

		dragPreview = { day, startMinutes: snapped, durationMinutes: 60 };
	}

	function handleDragLeave() {
		dragPreview = null;
	}

	async function handleDrop(e: DragEvent, day: string) {
		e.preventDefault();
		dragPreview = null;

		const filename = e.dataTransfer?.getData('text/plain');
		if (!filename) return;

		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const rawMinutes = dayStartMinutes + (y / pixelsPerMinute);
		const snapped = snapToGrid(rawMinutes, snapIncrement);
		const startTime = minutesToTime(snapped);

		// Check if task already has a duration, else default to 60min
		const file = markdownStore.getTaskFile(filename);
		const duration = file?.frontmatter.plannedDuration || 60;

		await updateTaskTimeBlock(filename, day, startTime, duration);
	}

	// Block drag (move existing block)
	function handleBlockDragStart(e: DragEvent, block: TimeBlock) {
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', block.task.filename);
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	// Resize
	function handleResizeStart(e: PointerEvent, block: TimeBlock, day: string) {
		e.preventDefault();
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		resizing = {
			filename: block.task.filename,
			day,
			startMinutes: block.startMinutes,
			originalDuration: block.durationMinutes,
			startY: e.clientY
		};
		resizeDuration = block.durationMinutes;
	}

	function handleResizeMove(e: PointerEvent) {
		if (!resizing) return;
		const deltaY = e.clientY - resizing.startY;
		const deltaMinutes = deltaY / pixelsPerMinute;
		const rawDuration = resizing.originalDuration + deltaMinutes;
		resizeDuration = Math.max(snapIncrement, snapToGrid(rawDuration, snapIncrement));
	}

	async function handleResizeEnd() {
		if (!resizing) return;
		const { filename, day, startMinutes } = resizing;
		const startTime = minutesToTime(startMinutes);
		await updateTaskTimeBlock(filename, day, startTime, resizeDuration);
		resizing = null;
	}

	function formatHour(hour: number): string {
		const h = hour % 12 || 12;
		const ampm = hour < 12 ? 'a' : 'p';
		return `${h}${ampm}`;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="time-grid-container"
	onpointermove={handleResizeMove}
	onpointerup={handleResizeEnd}
>
	<!-- Day headers -->
	<div class="grid-header">
		<div class="time-gutter-header"></div>
		{#each weekDays as day}
			<div class="day-header" class:today={isToday(day)}>
				{formatDayHeader(day)}
			</div>
		{/each}
	</div>

	<!-- Grid body (scrollable) -->
	<div class="grid-body">
		<!-- Time gutter + day columns -->
		<div class="grid-row-container" style="height: {gridHeight}px;">
			<!-- Time gutter labels -->
			<div class="time-gutter">
				{#each hours as hour}
					<div
						class="time-label"
						style="top: {(hour - dayStartHour) * SLOT_HEIGHT}px; height: {SLOT_HEIGHT}px;"
					>
						{formatHour(hour)}
					</div>
				{/each}
			</div>

			<!-- Day columns -->
			{#each weekDays as day}
				{@const dayData = blocksByDay.get(day)}
				<div
					class="day-column"
					class:today={isToday(day)}
					ondragover={(e) => handleDragOver(e, day)}
					ondragleave={handleDragLeave}
					ondrop={(e) => handleDrop(e, day)}
					role="region"
					aria-label="Schedule for {formatDayHeader(day)}"
				>
					<!-- Hour grid lines -->
					{#each hours as hour}
						<div
							class="hour-line"
							style="top: {(hour - dayStartHour) * SLOT_HEIGHT}px;"
						></div>
					{/each}

					<!-- Time blocks -->
					{#if dayData}
						{#each dayData.blocks as block (block.task.filename)}
							{@const isResizing = resizing?.filename === block.task.filename}
							<TimeBlockComponent
								block={isResizing ? { ...block, durationMinutes: resizeDuration } : block}
								{pixelsPerMinute}
								dayStartMinutes={dayStartMinutes}
								isColliding={dayData.collisions.has(block.task.filename)}
								ondragstart={(e) => handleBlockDragStart(e, block)}
								onresizestart={(e) => handleResizeStart(e, block, day)}
							/>
						{/each}
					{/if}

					<!-- Drag preview ghost -->
					{#if dragPreview && dragPreview.day === day}
						<div
							class="drag-preview"
							style="top: {(dragPreview.startMinutes - dayStartMinutes) * pixelsPerMinute}px; height: {dragPreview.durationMinutes * pixelsPerMinute}px;"
						>
							{minutesToTime(dragPreview.startMinutes)} - {formatDuration(dragPreview.durationMinutes)}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.time-grid-container {
		display: flex;
		flex-direction: column;
		border: 1px solid rgb(var(--color-surface-200));
		border-radius: 8px;
		overflow: hidden;
		background-color: rgb(var(--color-surface-50));
		min-width: 0;
	}

	:global([data-theme='flexoki-dark']) .time-grid-container,
	:global([data-theme='ayu-dark']) .time-grid-container {
		border-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-900));
	}

	/* Header row */
	.grid-header {
		display: grid;
		grid-template-columns: 40px repeat(7, 1fr);
		border-bottom: 1px solid rgb(var(--color-surface-200));
		position: sticky;
		top: 0;
		z-index: 10;
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .grid-header,
	:global([data-theme='ayu-dark']) .grid-header {
		border-bottom-color: rgb(var(--color-surface-600));
		background-color: rgb(var(--color-surface-800));
	}

	.time-gutter-header {
		/* Empty top-left corner */
	}

	.day-header {
		text-align: center;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 8px 4px;
		border-left: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .day-header,
	:global([data-theme='ayu-dark']) .day-header {
		border-left-color: rgb(var(--color-surface-600));
	}

	.day-header.today {
		color: rgb(var(--color-primary-600));
		background-color: rgb(var(--color-primary-50));
	}

	:global([data-theme='flexoki-dark']) .day-header.today,
	:global([data-theme='ayu-dark']) .day-header.today {
		color: rgb(var(--color-primary-300));
		background-color: rgb(var(--color-primary-900) / 0.3);
	}

	/* Body (scrollable) */
	.grid-body {
		overflow-y: auto;
		overflow-x: hidden;
		flex: 1;
	}

	.grid-row-container {
		display: grid;
		grid-template-columns: 40px repeat(7, 1fr);
		position: relative;
	}

	/* Time gutter */
	.time-gutter {
		position: relative;
	}

	.time-label {
		position: absolute;
		left: 0;
		right: 0;
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
		padding-right: 6px;
		padding-top: 0;
		font-size: 0.625rem;
		opacity: 0.5;
		transform: translateY(-0.4em);
	}

	/* Day columns */
	.day-column {
		position: relative;
		border-left: 1px solid rgb(var(--color-surface-200));
		min-height: 100%;
	}

	:global([data-theme='flexoki-dark']) .day-column,
	:global([data-theme='ayu-dark']) .day-column {
		border-left-color: rgb(var(--color-surface-700));
	}

	.day-column.today {
		background-color: rgb(var(--color-primary-50) / 0.3);
	}

	:global([data-theme='flexoki-dark']) .day-column.today,
	:global([data-theme='ayu-dark']) .day-column.today {
		background-color: rgb(var(--color-primary-900) / 0.1);
	}

	/* Hour grid lines */
	.hour-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 0;
		border-top: 1px solid rgb(var(--color-surface-200) / 0.5);
	}

	:global([data-theme='flexoki-dark']) .hour-line,
	:global([data-theme='ayu-dark']) .hour-line {
		border-top-color: rgb(var(--color-surface-700) / 0.5);
	}

	/* Drag preview */
	.drag-preview {
		position: absolute;
		left: 2px;
		right: 2px;
		border-radius: 4px;
		background-color: rgb(var(--color-primary-200) / 0.5);
		border: 2px dashed rgb(var(--color-primary-400));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.6875rem;
		opacity: 0.8;
		pointer-events: none;
		z-index: 5;
	}

	:global([data-theme='flexoki-dark']) .drag-preview,
	:global([data-theme='ayu-dark']) .drag-preview {
		background-color: rgb(var(--color-primary-800) / 0.5);
		border-color: rgb(var(--color-primary-500));
	}
</style>
