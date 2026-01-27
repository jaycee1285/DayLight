<script lang="ts">
	import { onMount } from 'svelte';

	interface MenuItem {
		label: string;
		icon?: string;
		action: () => void;
		destructive?: boolean;
	}

	interface Props {
		open: boolean;
		x: number;
		y: number;
		items: MenuItem[];
		onclose: () => void;
	}

	let { open, x, y, items, onclose }: Props = $props();

	let menuEl: HTMLDivElement | undefined = $state();

	// Compute adjusted position to keep menu on screen
	const adjustedPosition = $derived(() => {
		if (!menuEl) return { x, y };

		const rect = menuEl.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let adjX = x;
		let adjY = y;

		// Adjust horizontal position
		if (x + rect.width > viewportWidth) {
			adjX = viewportWidth - rect.width - 8;
		}

		// Adjust vertical position
		if (y + rect.height > viewportHeight) {
			adjY = viewportHeight - rect.height - 8;
		}

		return { x: adjX, y: adjY };
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleItemClick(item: MenuItem) {
		item.action();
		onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="menu-backdrop" onclick={onclose}></div>

	<!-- Menu -->
	<div
		bind:this={menuEl}
		class="context-menu"
		style="left: {adjustedPosition().x}px; top: {adjustedPosition().y}px;"
	>
		{#each items as item}
			<button
				type="button"
				class="menu-item"
				class:destructive={item.destructive}
				onclick={() => handleItemClick(item)}
			>
				{#if item.icon}
					<span class="menu-icon">{item.icon}</span>
				{/if}
				<span>{item.label}</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.menu-backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
	}

	.context-menu {
		position: fixed;
		z-index: 201;
		min-width: 160px;
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-200));
		border-radius: 0.5rem;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
		padding: 0.25rem;
	}

	:global([data-theme='flexoki-dark']) .context-menu {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		border-radius: 0.25rem;
		cursor: pointer;
		text-align: left;
		font-size: 0.875rem;
		color: rgb(var(--body-text-color));
		transition: background-color 0.15s;
	}

	.menu-item:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .menu-item:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.menu-item.destructive {
		color: rgb(var(--color-error-500));
	}

	.menu-item.destructive:hover {
		background-color: rgb(var(--color-error-100));
	}

	:global([data-theme='flexoki-dark']) .menu-item.destructive:hover {
		background-color: rgb(var(--color-error-900) / 0.5);
	}

	.menu-icon {
		font-size: 1rem;
	}
</style>
