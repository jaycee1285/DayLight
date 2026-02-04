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

	type RangeType = 'week' | 'month' | 'custom';
	let rangeType = $state<RangeType>('week');
	let customStartDate = $state(getTodayDate());
	let customEndDate = $state(getTodayDate());
	let initialized = $state(false);

	// Archive state: loaded once on demand, cached for session
	let archiveFiles = $state<ParsedTaskFile[]>([]);
	let archiveLoaded = $state(false);
	let archiveLoading = $state(false);

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

	// Get view tasks from markdown store (already computed)
	let activeViewTasks = $derived(markdownStore.viewTasks);

	// For custom range, combine active + archive; otherwise just active
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
				return {
					start: formatLocalDate(startOfWeek),
					end: getTodayDate()
				};
			}
			case 'month': {
				const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
				return {
					start: formatLocalDate(startOfMonth),
					end: getTodayDate()
				};
			}
			case 'custom':
				return {
					start: customStartDate,
					end: customEndDate
				};
		}
	});

	// Aggregate data from ViewTasks
	let projectData = $derived(getTimeByProject(viewTasks, dateRange.start, dateRange.end));
	let tagData = $derived(getTimeByTag(viewTasks, dateRange.start, dateRange.end));
	let totalMinutes = $derived(getTotalTimeInRange(viewTasks, dateRange.start, dateRange.end));

	// Sort by minutes descending
	let sortedProjects = $derived(
		Array.from(projectData.entries())
			.sort((a, b) => b[1] - a[1])
	);

	let sortedTags = $derived(
		Array.from(tagData.entries())
			.sort((a, b) => b[1] - a[1])
	);

	function formatRangeLabel(): string {
		const start = new Date(dateRange.start + 'T00:00:00');
		const end = new Date(dateRange.end + 'T00:00:00');

		if (rangeType === 'week') {
			return `This Week (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
		}
		if (rangeType === 'month') {
			return `This Month (${start.toLocaleDateString('en-US', { month: 'long' })})`;
		}
		return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
	}

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
		<div class="range-selector flex gap-2 mb-6 overflow-x-auto pb-2">
			<button
				type="button"
				class="range-btn"
				class:active={rangeType === 'week'}
				onclick={() => rangeType = 'week'}
			>
				Week
			</button>
			<button
				type="button"
				class="range-btn"
				class:active={rangeType === 'month'}
				onclick={() => rangeType = 'month'}
			>
				Month
			</button>
			<button
				type="button"
				class="range-btn"
				class:active={rangeType === 'custom'}
				onclick={() => rangeType = 'custom'}
			>
				Custom
			</button>
		</div>

		{#if rangeType === 'custom'}
			<div class="custom-range flex gap-4 mb-6">
				<div>
					<label for="start-date" class="block text-sm opacity-70 mb-1">Start</label>
					<input
						id="start-date"
						type="date"
						bind:value={customStartDate}
						class="date-input p-2 rounded-lg border"
					/>
				</div>
				<div>
					<label for="end-date" class="block text-sm opacity-70 mb-1">End</label>
					<input
						id="end-date"
						type="date"
						bind:value={customEndDate}
						class="date-input p-2 rounded-lg border"
					/>
				</div>
			</div>
		{/if}

		<!-- Summary -->
		<div class="summary-card p-4 rounded-lg mb-6">
			<div class="text-sm opacity-70">{formatRangeLabel()}</div>
			<div class="text-3xl font-bold">{formatDuration(totalMinutes)}</div>
			<div class="text-sm opacity-70">
				Total time logged{#if rangeType === 'custom' && archiveLoading}&ensp;(loading archive...){/if}
				{#if rangeType === 'custom' && archiveLoaded}&ensp;(incl. archive){/if}
			</div>
		</div>

		<!-- Time by Project -->
		<section class="mb-6">
			<h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full" style="background-color: rgb(var(--color-tertiary-500))"></span>
				By Project
			</h2>
			{#if sortedProjects.length > 0}
				<div class="space-y-3">
					{#each sortedProjects as [project, minutes]}
						<div class="report-row p-3 rounded-lg">
							<div class="flex justify-between items-center mb-1">
								<span class="font-medium">{project}</span>
								<span class="text-sm">{formatDuration(minutes)}</span>
							</div>
							<div class="progress-bar">
								<div
									class="progress-fill progress-project"
									style="width: {getPercentage(minutes)}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No time logged in this period
				</p>
			{/if}
		</section>

		<!-- Time by Tag -->
		<section>
			<h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full" style="background-color: rgb(var(--color-primary-500))"></span>
				By Tag
			</h2>
			{#if sortedTags.length > 0}
				<div class="space-y-3">
					{#each sortedTags as [tag, minutes]}
						<div class="report-row p-3 rounded-lg">
							<div class="flex justify-between items-center mb-1">
								<span class="font-medium">#{tag}</span>
								<span class="text-sm">{formatDuration(minutes)}</span>
							</div>
							<div class="progress-bar">
								<div
									class="progress-fill progress-tag"
									style="width: {getPercentage(minutes)}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No time logged in this period
				</p>
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

	.summary-card {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .summary-card {
		background-color: rgb(var(--color-surface-800));
	}

	.report-row {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .report-row {
		background-color: rgb(var(--color-surface-800));
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

	.progress-project {
		background-color: rgb(var(--color-tertiary-500));
	}

	.progress-tag {
		background-color: rgb(var(--color-primary-500));
	}
</style>
