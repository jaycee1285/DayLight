<script lang="ts">
	interface Props {
		projects: string[];
		selectedProject: string | null;
		onselect: (project: string | null) => void;
	}

	let { projects, selectedProject, onselect }: Props = $props();
</script>

<div class="project-tabs">
	<div class="tabs-scroll">
		<button
			type="button"
			class="tab"
			class:active={selectedProject === null}
			onclick={() => onselect(null)}
		>
			All
		</button>
		{#each projects as project}
			<button
				type="button"
				class="tab"
				class:active={selectedProject === project}
				onclick={() => onselect(project)}
			>
				{project}
			</button>
		{/each}
	</div>
</div>

<style>
	.project-tabs {
		width: 100%;
		overflow: hidden;
	}

	.tabs-scroll {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.5rem 0;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.tabs-scroll::-webkit-scrollbar {
		display: none;
	}

	.tab {
		flex-shrink: 0;
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		border: none;
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--body-text-color));
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	:global([data-mode='dark']) .tab {
		background-color: rgb(var(--color-surface-700));
	}

	.tab:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .tab:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.tab.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.tab.active:hover {
		background-color: rgb(var(--color-primary-600));
	}
</style>
