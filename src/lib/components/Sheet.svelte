<script lang="ts">
	import type { Snippet } from 'svelte';
	import IconX from '~icons/lucide/x';

	interface Props {
		open: boolean;
		onclose: () => void;
		title?: string;
		children: Snippet;
	}

	let { open, onclose, title = '', children }: Props = $props();

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

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="sheet-backdrop fixed inset-0 bg-black/50 z-[60] flex items-end justify-center"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby={title ? 'sheet-title' : undefined}
		tabindex="-1"
	>
		<div class="sheet-content w-full max-w-lg rounded-t-xl animate-slide-up">
			{#if title}
				<div class="sheet-header flex items-center justify-between p-4 border-b flex-shrink-0">
					<h2 id="sheet-title" class="text-lg font-semibold">{title}</h2>
					<button
						type="button"
						onclick={onclose}
						class="sheet-close w-8 h-8 flex items-center justify-center rounded-full"
						aria-label="Close"
					>
						<IconX width="20" height="20" />
					</button>
				</div>
			{/if}
			<div class="sheet-body p-4 overflow-y-auto">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<style>
	.sheet-content {
		background-color: rgb(var(--color-surface-100));
		max-height: 90vh;
		max-height: 90dvh;
		display: flex;
		flex-direction: column;
		/* Safe area padding for bottom sheet */
		padding-bottom: max(env(safe-area-inset-bottom, 0px), 12px);
	}

	.sheet-body {
		flex: 1;
		min-height: 0; /* Important for flex scroll */
	}

	:global([data-theme='flexoki-dark']) .sheet-content,
	:global([data-theme='ayu-dark']) .sheet-content {
		background-color: rgb(var(--color-surface-800));
	}

	.sheet-header {
		border-bottom-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .sheet-header,
	:global([data-theme='ayu-dark']) .sheet-header {
		border-bottom-color: rgb(var(--color-surface-600));
	}

	.sheet-close:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .sheet-close:hover,
	:global([data-theme='ayu-dark']) .sheet-close:hover {
		background-color: rgb(var(--color-surface-600));
	}

	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.animate-slide-up {
		animation: slide-up 0.2s ease-out;
	}
</style>
