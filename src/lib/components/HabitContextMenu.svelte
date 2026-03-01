<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';
	import { getTodayDate } from '$lib/domain/task';
	import { deleteTask, markTaskComplete, markTaskIncomplete } from '$lib/stores/markdown-store.svelte';
	import { isHabitCompletedOnDate } from '$lib/services/ViewService';

	import IconTrash2 from '~icons/lucide/trash-2';
	import IconPencil from '~icons/lucide/pencil';
	import IconCheck from '~icons/lucide/check';
	import IconUndo2 from '~icons/lucide/undo-2';

	interface Props {
		habit: ViewTask;
		x: number;
		y: number;
		onclose: () => void;
		onedit?: () => void;
	}

	let { habit, x, y, onclose, onedit }: Props = $props();
	const today = getTodayDate();
	const habitType = $derived(habit.frontmatter.habit_type || 'check');

	const isCompletedToday = $derived.by(() => isHabitCompletedOnDate(habit.frontmatter, today));

	let menuElement: HTMLDivElement | null = $state(null);
	let adjustedX = $state(0);
	let adjustedY = $state(0);

	$effect(() => {
		requestAnimationFrame(() => {
			if (!menuElement) return;
			const rect = menuElement.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
			const bottomMargin = 60;

			adjustedX = x + rect.width > viewportWidth - 16
				? Math.max(16, viewportWidth - rect.width - 16)
				: x;
			adjustedY = y + rect.height > viewportHeight - bottomMargin
				? Math.max(16, viewportHeight - rect.height - bottomMargin)
				: y;
		});
	});

	async function handleDelete() {
		await deleteTask(habit.filename);
		onclose();
	}

	async function handleToggleComplete() {
		if (isCompletedToday) {
			await markTaskIncomplete(habit.filename, today);
		} else {
			await markTaskComplete(habit.filename, today);
		}
		onclose();
	}

	function handleEdit() {
		onedit?.();
		onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
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
		<div class="menu-options">
			<button type="button" class="menu-option" onclick={handleEdit}>
				<span class="menu-icon"><IconPencil width="16" height="16" /></span>
				<span>Edit Habit</span>
			</button>
			{#if habitType === 'check'}
				<button type="button" class="menu-option" onclick={handleToggleComplete}>
					<span class="menu-icon">
						{#if isCompletedToday}
							<IconUndo2 width="16" height="16" />
						{:else}
							<IconCheck width="16" height="16" />
						{/if}
					</span>
					<span>{isCompletedToday ? 'Mark Incomplete' : 'Mark Complete'}</span>
				</button>
			{/if}
			<button type="button" class="menu-option danger" onclick={handleDelete}>
				<span class="menu-icon"><IconTrash2 width="16" height="16" /></span>
				<span>Delete Habit</span>
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
	}

	.menu-option:hover {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .menu-option:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.menu-option.danger {
		color: rgb(var(--color-error-500));
	}

	.menu-icon {
		width: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0.8;
	}
</style>
