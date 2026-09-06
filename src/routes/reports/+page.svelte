<script lang="ts">
	import {
		markdownStore,
		initializeMarkdownStore
	} from '$lib/stores/markdown-store.svelte';
	import {
		getTotalTimeInRange,
		getTimeByProject,
		getTimeByTag,
		type ViewTask
	} from '$lib/services/ViewService';
	import { loadArchiveFiles, type ParsedTaskFile } from '$lib/storage/markdown-storage';
	import { formatDuration } from '$lib/domain/timeLog';
	import { getTodayDate, formatLocalDate } from '$lib/domain/task';
	import { slide } from 'svelte/transition';
	import IconChevronRight from '~icons/lucide/chevron-right';

	type RangeType = 'week' | 'month' | 'custom';
	let rangeType = $state<RangeType>('week');
	let customStartDate = $state(getTodayDate());
	let customEndDate = $state(getTodayDate());
	let initialized = $state(false);

	// Archive state: loaded once on demand, cached for session
	let archiveFiles = $state<ParsedTaskFile[]>([]);
	let archiveLoaded = $state(false);
	let archiveLoading = $state(false);

	// Metric mode cycled by tapping any duration pill.
	// 0 = total, 1 = per-day average, 2 = per-week average (month/custom only).
	let metricMode = $state(0);

	// Per-list expansion (top 7 + view more)
	const TOP_N = 7;
	let tagsExpanded = $state(false);
	let projectsExpanded = $state(false);
	let projectsOpen = $state(false); // Projects section starts collapsed

	// Iterated fill palette — limited known tokens, just enough to differentiate.
	const PALETTE = ['primary', 'secondary', 'tertiary'];
	function barColor(i: number): string {
		return `rgb(var(--color-${PALETTE[i % PALETTE.length]}-200))`;
	}

	$effect(() => {
		if (initialized) return;
		initialized = true;
		initializeMarkdownStore();
	});

	// Load archive when switching to custom range
	$effect(() => {
		if (rangeType === 'custom' && !archiveLoaded && !archiveLoading) {
			archiveLoading = true;
			loadArchiveFiles().then((files) => {
				archiveFiles = files;
				archiveLoaded = true;
				archiveLoading = false;
			}).catch(() => {
				archiveLoading = false;
			});
		}
	});

	// Convert archive files to minimal ViewTask shells for time aggregation
	let archiveViewTasks = $derived<ViewTask[]>(
		archiveFiles.map((f) => ({
			filename: f.filename,
			title: f.filename.replace(/\.md$/, ''),
			frontmatter: f.frontmatter,
			body: f.body,
			dateGroup: 'Wrapped' as const,
			urgencyScore: 0,
			isActiveToday: false,
			hasPastUncompleted: false,
			totalTimeTracked: f.frontmatter.timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0),
			timeTrackedToday: 0,
			instanceDate: null,
			effectiveDate: null
		}))
	);

	let activeViewTasks = $derived(markdownStore.viewTasks);

	let viewTasks = $derived<ViewTask[]>(
		rangeType === 'custom' ? [...activeViewTasks, ...archiveViewTasks] : activeViewTasks
	);

	// Calculate date range based on selected type
	let dateRange = $derived.by(() => {
		const today = new Date();

		switch (rangeType) {
			case 'week': {
				const startOfWeek = new Date(today);
				startOfWeek.setDate(today.getDate() - today.getDay());
				return { start: formatLocalDate(startOfWeek), end: getTodayDate() };
			}
			case 'month': {
				const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
				return { start: formatLocalDate(startOfMonth), end: getTodayDate() };
			}
			case 'custom':
				return { start: customStartDate, end: customEndDate };
		}
	});

	// Inclusive day count, floor of 1
	let daysInRange = $derived.by(() => {
		const s = new Date(dateRange.start + 'T00:00:00').getTime();
		const e = new Date(dateRange.end + 'T00:00:00').getTime();
		return Math.max(1, Math.round((e - s) / 86400000) + 1);
	});

	// Highest available metric mode for the current range
	let maxMode = $derived(rangeType === 'week' ? 1 : 2);
	$effect(() => {
		if (metricMode > maxMode) metricMode = 0;
	});
	let metricSuffix = $derived(metricMode === 1 ? '/day' : metricMode === 2 ? '/wk' : '');

	function cycleMetric() {
		metricMode = metricMode >= maxMode ? 0 : metricMode + 1;
	}

	// Transform a total-minutes figure into the active metric, then format.
	function showTime(totalMinutes: number): string {
		let m = totalMinutes;
		if (metricMode === 1) m = totalMinutes / daysInRange;
		else if (metricMode === 2) m = totalMinutes / (daysInRange / 7);
		return formatDuration(Math.round(m)) + (metricSuffix ? ` ${metricSuffix}` : '');
	}

	// Aggregates (bar widths always use raw totals so proportions are stable)
	let projectData = $derived(getTimeByProject(viewTasks, dateRange.start, dateRange.end));
	let tagData = $derived(getTimeByTag(viewTasks, dateRange.start, dateRange.end));
	let totalMinutes = $derived(getTotalTimeInRange(viewTasks, dateRange.start, dateRange.end));

	let sortedTags = $derived(Array.from(tagData.entries()).sort((a, b) => b[1] - a[1]));
	let sortedProjects = $derived(Array.from(projectData.entries()).sort((a, b) => b[1] - a[1]));

	let visibleTags = $derived(tagsExpanded ? sortedTags : sortedTags.slice(0, TOP_N));
	let visibleProjects = $derived(projectsExpanded ? sortedProjects : sortedProjects.slice(0, TOP_N));

	function getPercentage(minutes: number): number {
		if (totalMinutes === 0) return 0;
		return (minutes / totalMinutes) * 100;
	}
</script>

{#if markdownStore.isLoading}
	<main class="p-4 flex items-center justify-center min-h-[60vh]">
		<p class="text-center opacity-60">Loading time data...</p>
	</main>
{:else}
	<main class="p-4">
		<h1 class="text-2xl font-bold mb-4">Reports</h1>

		<!-- Range selector -->
		<div class="range-selector flex gap-2 mb-4 overflow-x-auto pb-2">
			<button type="button" class="range-btn" class:active={rangeType === 'week'} onclick={() => rangeType = 'week'}>Week</button>
			<button type="button" class="range-btn" class:active={rangeType === 'month'} onclick={() => rangeType = 'month'}>Month</button>
			<button type="button" class="range-btn" class:active={rangeType === 'custom'} onclick={() => rangeType = 'custom'}>Custom</button>
		</div>

		{#if rangeType === 'custom'}
			<div class="custom-range flex gap-4 mb-4">
				<div>
					<label for="start-date" class="block text-sm opacity-70 mb-1">Start</label>
					<input id="start-date" type="date" bind:value={customStartDate} class="date-input p-2 rounded-lg border" />
				</div>
				<div>
					<label for="end-date" class="block text-sm opacity-70 mb-1">End</label>
					<input id="end-date" type="date" bind:value={customEndDate} class="date-input p-2 rounded-lg border" />
				</div>
			</div>
		{/if}

		<!-- Summary: just the number, tappable to cycle metric -->
		<button type="button" class="summary-total" onclick={cycleMetric} title="Tap to cycle total / per-day / per-week">
			{showTime(totalMinutes)}
		</button>

		<!-- Tags -->
		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-3">Tags</h2>
			{#if sortedTags.length > 0}
				<div class="space-y-3">
					{#each visibleTags as [tag, minutes], i}
						<div class="report-row p-3 rounded-lg">
							<div class="flex justify-between items-center mb-1">
								<span class="font-medium">#{tag}</span>
								<button type="button" class="metric-pill" onclick={cycleMetric}>{showTime(minutes)}</button>
							</div>
							<div class="progress-bar">
								<div class="progress-fill" style="width: {getPercentage(minutes)}%; background-color: {barColor(i)}"></div>
							</div>
						</div>
					{/each}
				</div>
				{#if sortedTags.length > TOP_N}
					<button type="button" class="view-more" onclick={() => tagsExpanded = !tagsExpanded}>
						{tagsExpanded ? 'View less' : `View more (${sortedTags.length - TOP_N})`}
					</button>
				{/if}
			{:else}
				<p class="empty-state text-center py-8 opacity-60">No time logged in this period</p>
			{/if}
		</section>

		<!-- Projects: collapsed by default -->
		<section>
			<button type="button" class="section-toggle" class:open={projectsOpen} aria-expanded={projectsOpen} onclick={() => projectsOpen = !projectsOpen}>
				<span class="text-lg font-semibold">Projects</span>
				<span class="toggle-chevron" class:open={projectsOpen} aria-hidden="true">
					<IconChevronRight width="18" height="18" />
				</span>
			</button>

			{#if projectsOpen}
				<div transition:slide={{ duration: 180 }}>
					{#if sortedProjects.length > 0}
						<div class="space-y-3 mt-3">
							{#each visibleProjects as [project, minutes], i}
								<div class="report-row p-3 rounded-lg">
									<div class="flex justify-between items-center mb-1">
										<span class="font-medium">{project}</span>
										<button type="button" class="metric-pill" onclick={cycleMetric}>{showTime(minutes)}</button>
									</div>
									<div class="progress-bar">
										<div class="progress-fill" style="width: {getPercentage(minutes)}%; background-color: {barColor(i)}"></div>
									</div>
								</div>
							{/each}
						</div>
						{#if sortedProjects.length > TOP_N}
							<button type="button" class="view-more" onclick={() => projectsExpanded = !projectsExpanded}>
								{projectsExpanded ? 'View less' : `View more (${sortedProjects.length - TOP_N})`}
							</button>
						{/if}
					{:else}
						<p class="empty-state text-center py-6 opacity-60">No project time in this period</p>
					{/if}
				</div>
			{/if}
		</section>
	</main>
{/if}

<style>
	.range-btn {
		padding: 0.5rem 1rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
		white-space: nowrap;
	}

	:global([data-mode='dark']) .range-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.range-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .range-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.range-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.date-input {
		background-color: rgb(var(--color-surface-50));
		border-color: rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .date-input {
		background-color: rgb(var(--color-hover-bg-strong));
		border-color: rgb(var(--color-surface-600));
	}

	.summary-total {
		display: block;
		margin-bottom: 1.5rem;
		padding: 0;
		border: none;
		background: transparent;
		color: rgb(var(--body-text-color));
		font-size: 2rem;
		font-weight: 700;
		line-height: 1.1;
		cursor: pointer;
		text-align: left;
	}

	.report-row {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .report-row {
		background-color: rgb(var(--color-surface-800));
	}

	.metric-pill {
		font-size: 0.8125rem;
		padding: 0.1rem 0.5rem;
		border-radius: 9999px;
		border: none;
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--body-text-color));
		cursor: pointer;
		white-space: nowrap;
	}

	:global([data-mode='dark']) .metric-pill {
		background-color: rgb(var(--color-surface-700));
	}

	.progress-bar {
		height: 4px;
		background-color: rgb(var(--color-hover-bg));
		border-radius: 2px;
		overflow: hidden;
	}

	:global([data-mode='dark']) .progress-bar {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.progress-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease-out;
	}

	.section-toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.25rem 0;
		border: none;
		background: transparent;
		color: rgb(var(--body-text-color));
		cursor: pointer;
	}

	.toggle-chevron {
		display: inline-flex;
		align-items: center;
		opacity: 0.7;
		transition: transform 0.18s ease;
	}

	.toggle-chevron.open {
		transform: rotate(90deg);
	}

	.view-more {
		margin-top: 0.75rem;
		font-size: 0.8125rem;
		padding: 0.25rem 0;
		border: none;
		background: transparent;
		color: rgb(var(--color-primary-500));
		cursor: pointer;
	}
</style>
