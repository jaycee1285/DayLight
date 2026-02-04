<script lang="ts">
	import { getTodayDate, getOffsetDate } from '$lib/domain/task';
	import type { ViewTask } from '$lib/services/ViewService';
	import {
		markTaskComplete,
		markTaskIncomplete,
		rescheduleTask,
		rescheduleInstance,
		deleteTask
	} from '$lib/stores/markdown-store.svelte';

	// Lucide icons
	import IconSun from '~icons/lucide/sun';
	import IconArrowRight from '~icons/lucide/arrow-right';
	import IconCalendar from '~icons/lucide/calendar';
	import IconCalendarDays from '~icons/lucide/calendar-days';
	import IconTrash2 from '~icons/lucide/trash-2';
	import IconCheck from '~icons/lucide/check';
	import IconUndo2 from '~icons/lucide/undo-2';
	import IconClock from '~icons/lucide/clock';
	import IconPencil from '~icons/lucide/pencil';

	interface Props {
		task: ViewTask;
		x: number;
		y: number;
		onclose: () => void;
		onpickdate?: () => void;
		ontracktime?: () => void;
		onedit?: () => void;
	}

	let {
		task,
		x,
		y,
		onclose,
		onpickdate,
		ontracktime,
		onedit
	}: Props = $props();

	// For recurring tasks with instanceDate, check if that instance is completed
	// For non-recurring tasks, check status
	const isCompleted = $derived.by(() => {
		if (task.instanceDate) {
			return task.frontmatter.complete_instances.includes(task.instanceDate);
		}
		return task.frontmatter.status === 'done';
	});

	// Adjust position to stay within viewport
	let menuElement: HTMLDivElement | null = $state(null);
	let adjustedX = $state(x);
	let adjustedY = $state(y);

	// Position the menu within viewport
	$effect(() => {
		// Use requestAnimationFrame to ensure DOM has updated
		requestAnimationFrame(() => {
			if (menuElement) {
				const rect = menuElement.getBoundingClientRect();
				const viewportWidth = window.innerWidth;
				const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
				const bottomMargin = 60;

				if (x + rect.width > viewportWidth - 16) {
					adjustedX = Math.max(16, viewportWidth - rect.width - 16);
				} else {
					adjustedX = x;
				}

				if (y + rect.height > viewportHeight - bottomMargin) {
					adjustedY = Math.max(16, viewportHeight - rect.height - bottomMargin);
				} else {
					adjustedY = y;
				}
			}
		});
	});

	async function quickReschedule(offset: number) {
		const newDate = offset === 0 ? getTodayDate() : getOffsetDate(offset);
		if (task.instanceDate && task.frontmatter.recurrence) {
			await rescheduleInstance(task.filename, task.instanceDate, newDate);
		} else {
			await rescheduleTask(task.filename, newDate);
		}
		onclose();
	}

	async function handleDelete() {
		await deleteTask(task.filename);
		onclose();
	}

	async function handleToggleComplete() {
		// Use instanceDate for recurring tasks, default to today for non-recurring
		const dateToUse = task.instanceDate || getTodayDate();
		if (isCompleted) {
			await markTaskIncomplete(task.filename, dateToUse);
		} else {
			await markTaskComplete(task.filename, dateToUse);
		}
		onclose();
	}

	function handleTrackTime() {
		ontracktime?.();
		onclose();
	}

	function handlePickDate() {
		onpickdate?.();
		onclose();
	}

	function handleEditTask() {
		onedit?.();
		onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="context-menu-backdrop" onclick={handleBackdropClick}>
	<div
		bind:this={menuElement}
		class="context-menu"
		style="left: {adjustedX}px; top: {adjustedY}px;"
	>
		<!-- Quick reschedule icons row -->
		<div class="quick-actions">
			<button
				type="button"
				class="quick-action-btn"
				onclick={() => quickReschedule(0)}
				aria-label="Reschedule for today"
				title="Today"
			>
				<IconSun width="18" height="18" />
			</button>
			<button
				type="button"
				class="quick-action-btn"
				onclick={() => quickReschedule(1)}
				aria-label="Reschedule for tomorrow"
				title="Tomorrow"
			>
				<IconArrowRight width="18" height="18" />
			</button>
			<button
				type="button"
				class="quick-action-btn"
				onclick={() => quickReschedule(7)}
				aria-label="Reschedule for next week"
				title="In 1 week"
			>
				<IconCalendar width="18" height="18" />
			</button>
			<button
				type="button"
				class="quick-action-btn"
				onclick={handlePickDate}
				aria-label="Pick a date"
				title="Pick date"
			>
				<IconCalendarDays width="18" height="18" />
			</button>
			<button
				type="button"
				class="quick-action-btn quick-action-delete"
				onclick={handleDelete}
				aria-label="Delete task"
				title="Delete"
			>
				<IconTrash2 width="18" height="18" />
			</button>
		</div>

		<hr class="menu-divider" />

		<!-- Menu options -->
		<div class="menu-options">
			<button type="button" class="menu-option" onclick={handleToggleComplete}>
				<span class="menu-icon">
					{#if isCompleted}
						<IconUndo2 width="16" height="16" />
					{:else}
						<IconCheck width="16" height="16" />
					{/if}
				</span>
				<span>{isCompleted ? 'Mark Incomplete' : 'Mark as Done'}</span>
			</button>

			<button type="button" class="menu-option" onclick={handleTrackTime}>
				<span class="menu-icon">
					<IconClock width="16" height="16" />
				</span>
				<span>Track Time</span>
			</button>

			<button type="button" class="menu-option" onclick={handleEditTask}>
				<span class="menu-icon">
					<IconPencil width="16" height="16" />
				</span>
				<span>Edit Task</span>
			</button>
		</div>
	</div>
</div>

<style>
	.context-menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
	}

	.context-menu {
		position: fixed;
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-200));
		border-radius: 0.75rem;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
		min-width: 200px;
		max-height: calc(100dvh - 80px);
		overflow-y: auto;
		z-index: 201;
	}

	:global([data-mode='dark']) .context-menu {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.quick-actions {
		display: flex;
		justify-content: space-around;
		padding: 0.75rem 0.5rem;
		gap: 0.25rem;
	}

	.quick-action-btn {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		border: none;
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--body-text-color));
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s, transform 0.1s;
	}

	:global([data-mode='dark']) .quick-action-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.quick-action-btn:hover {
		background-color: rgb(var(--color-primary-100));
		transform: scale(1.05);
	}

	:global([data-mode='dark']) .quick-action-btn:hover {
		background-color: rgb(var(--color-primary-900));
	}

	.quick-action-btn:active {
		transform: scale(0.95);
	}

	.quick-action-delete:hover {
		background-color: rgb(var(--color-error-100));
	}

	:global([data-mode='dark']) .quick-action-delete:hover {
		background-color: rgb(var(--color-error-900));
	}

	.menu-divider {
		margin: 0;
		border: none;
		border-top: 1px solid rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .menu-divider {
		border-top-color: rgb(var(--color-surface-600));
	}

	.menu-options {
		padding: 0.5rem 0;
	}

	.menu-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		background: none;
		cursor: pointer;
		font-size: 0.9375rem;
		color: rgb(var(--body-text-color));
		text-align: left;
		transition: background-color 0.15s;
	}

	.menu-option:hover {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .menu-option:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.menu-icon {
		width: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.7;
	}
</style>
