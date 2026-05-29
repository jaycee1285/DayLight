<script lang="ts">
	import { onMount } from 'svelte';
	import Sheet from '$lib/components/Sheet.svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();
	let centered = $state(false);

	onMount(() => {
		const media = window.matchMedia('(min-width: 768px)');
		const updateCentered = () => {
			centered = media.matches;
		};
		updateCentered();
		media.addEventListener('change', updateCentered);
		return () => media.removeEventListener('change', updateCentered);
	});
</script>

<Sheet {open} {onclose} title="Shortcode Reference" {centered}>
	<div class="space-y-4">
		<div>
			<p class="text-sm opacity-70 mb-2">Tags</p>
			<ul class="shortcut-list">
				<li><span><code>#tag</code></span><span class="shortcode-desc">Add a tag</span></li>
			</ul>
		</div>

		<div>
			<p class="text-sm opacity-70 mb-2">Projects</p>
			<ul class="shortcut-list">
				<li><span><code>+project</code></span><span class="shortcode-desc">Set project</span></li>
			</ul>
		</div>

		<div>
			<p class="text-sm opacity-70 mb-2">Dates</p>
			<ul class="shortcut-list">
				<li><span><code>@tom</code></span><span class="shortcode-desc">Schedule for tomorrow</span></li>
				<li><span><code>@d22</code></span><span class="shortcode-desc">Schedule for the 22nd this month</span></li>
				<li><span><code>@d3-15</code></span><span class="shortcode-desc">Schedule for March 15</span></li>
			</ul>
		</div>

		<div>
			<p class="text-sm opacity-70 mb-2">Recurrence</p>
			<ul class="shortcut-list shortcode-list">
				<li><span><code>@d</code></span><span class="shortcode-desc">Repeat daily</span></li>
				<li><span><code>@w</code></span><span class="shortcode-desc">Repeat weekly</span></li>
				<li><span><code>@wMWF</code></span><span class="shortcode-desc">Weekly on Mon/Wed/Fri</span></li>
				<li><span><code>@m</code></span><span class="shortcode-desc">Repeat monthly</span></li>
				<li><span><code>@m15</code></span><span class="shortcode-desc">Monthly on the 15th</span></li>
				<li><span><code>@3d</code></span><span class="shortcode-desc">Every 3 days</span></li>
				<li><span><code>@2w</code></span><span class="shortcode-desc">Every 2 weeks</span></li>
			</ul>
			<p class="text-xs opacity-50 mt-2">Day letters: M=Mon T=Tue W=Wed R=Thu F=Fri S=Sat U=Sun</p>
		</div>
	</div>
</Sheet>

<style>
	.shortcut-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shortcut-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.shortcut-list code {
		background-color: rgb(var(--color-surface-200));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}

	:global([data-mode='dark']) .shortcut-list code {
		background-color: rgb(var(--color-surface-700));
	}

	.shortcode-desc {
		opacity: 0.8;
		font-size: 0.875rem;
		text-align: right;
	}
</style>
