<script lang="ts">
	import {
		markdownStore,
		initializeMarkdownStore,
		markTaskComplete,
		markTaskIncomplete,
		logHabitEntry
	} from '$lib/stores/markdown-store.svelte';
	import {
		filterHabits,
		deduplicateByFilename,
		isHabitCompletedOnDate,
		getHabitCompletionRate,
		getCompletionColor,
		type ViewTask
	} from '$lib/services/ViewService';
	import { getTodayDate, formatLocalDate } from '$lib/domain/task';

	type RangeType = 'week' | 'month' | 'alltime';
	let rangeType = $state<RangeType>('week');

	let initialized = $state(false);

	$effect(() => {
		if (initialized) return;
		initialized = true;
		initializeMarkdownStore();
	});

	const today = getTodayDate();

	// All habit ViewTasks, deduplicated by filename (one per habit file)
	const allHabits = $derived(deduplicateByFilename(filterHabits(markdownStore.viewTasks)));

	// Today's completion status per habit
	function isCompletedToday(task: ViewTask): boolean {
		return isHabitCompletedOnDate(task.frontmatter, today);
	}

	function getTodayValue(task: ViewTask): number | null {
		const val = task.frontmatter.habit_entries[today];
		return val !== undefined ? val : null;
	}

	// Handle check-type toggle
	function toggleCheck(task: ViewTask) {
		if (isCompletedToday(task)) {
			markTaskIncomplete(task.filename, today);
		} else {
			markTaskComplete(task.filename, today);
		}
	}

	// Handle numerical input change
	function handleValueChange(task: ViewTask, event: Event) {
		const input = event.target as HTMLInputElement;
		const value = parseFloat(input.value);
		if (!isNaN(value) && value >= 0) {
			logHabitEntry(task.filename, today, value);
		}
	}

	// Date range calculation (mirrors reports pattern)
	let dateRange = $derived.by(() => {
		const todayDate = new Date();

		switch (rangeType) {
			case 'week': {
				const startOfWeek = new Date(todayDate);
				startOfWeek.setDate(todayDate.getDate() - todayDate.getDay());
				return {
					start: formatLocalDate(startOfWeek),
					end: getTodayDate()
				};
			}
			case 'month': {
				const startOfMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
				return {
					start: formatLocalDate(startOfMonth),
					end: getTodayDate()
				};
			}
			case 'alltime': {
				// Find earliest DTSTART across all habits
				let earliest = getTodayDate();
				for (const habit of allHabits) {
					const rec = habit.frontmatter.recurrence;
					if (rec) {
						const match = rec.match(/DTSTART:(\d{4})(\d{2})(\d{2})/);
						if (match) {
							const dt = `${match[1]}-${match[2]}-${match[3]}`;
							if (dt < earliest) earliest = dt;
						}
					}
				}
				return { start: earliest, end: getTodayDate() };
			}
		}
	});

	// Completion rates per habit in the selected range
	const habitStats = $derived(
		allHabits.map((habit) => {
			const rate = getHabitCompletionRate(habit.frontmatter, dateRange.start, dateRange.end);
			return {
				habit,
				rate,
				color: getCompletionColor(rate)
			};
		})
	);

	// Overall completion rate across all habits
	const overallRate = $derived.by(() => {
		if (habitStats.length === 0) return 0;
		const sum = habitStats.reduce((acc, s) => acc + s.rate, 0);
		return sum / habitStats.length;
	});

	function formatPercent(rate: number): string {
		return Math.round(rate * 100) + '%';
	}

	function formatRangeLabel(): string {
		const start = new Date(dateRange.start + 'T00:00:00');
		const end = new Date(dateRange.end + 'T00:00:00');

		if (rangeType === 'week') {
			return `This Week (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
		}
		if (rangeType === 'month') {
			return `This Month (${start.toLocaleDateString('en-US', { month: 'long' })})`;
		}
		return `All Time (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - now)`;
	}
</script>

{#if markdownStore.isLoading}
	<main class="p-4 flex items-center justify-center min-h-[60vh]">
		<p class="text-center opacity-60">Loading habits...</p>
	</main>
{:else}
	<main class="p-4">
		<h1 class="text-2xl font-bold mb-4">Habits</h1>

		<!-- Today section -->
		<section class="mb-6">
			<h2 class="section-header text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full" style="background-color: rgb(var(--color-primary-500))"></span>
				Today
				{#if allHabits.length > 0}
					<span class="text-sm font-normal opacity-70">
						({allHabits.filter(h => isCompletedToday(h)).length}/{allHabits.length})
					</span>
				{/if}
			</h2>

			{#if allHabits.length > 0}
				<div class="flex flex-col gap-2">
					{#each allHabits as habit (habit.filename)}
						{@const completed = isCompletedToday(habit)}
						{@const habitType = habit.frontmatter.habit_type || 'check'}
						<div class="habit-row p-3 rounded-lg flex items-center gap-3" class:completed>
							{#if habitType === 'check'}
								<!-- Checkbox for check-type habits -->
								<button
									type="button"
									class="habit-check w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0"
									class:checked={completed}
									onclick={() => toggleCheck(habit)}
									aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
								>
									{#if completed}
										<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
											<path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									{/if}
								</button>
							{:else}
								<!-- Status indicator for numerical types -->
								<div
									class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
									class:indicator-success={completed}
									class:indicator-pending={!completed}
								>
									{#if completed}
										<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
											<path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
										</svg>
									{/if}
								</div>
							{/if}

							<span class="habit-title flex-1" class:line-through={completed} class:opacity-60={completed}>
								{habit.title}
							</span>

							{#if habitType === 'target' || habitType === 'limit'}
								<div class="flex items-center gap-1.5">
									<input
										type="number"
										class="value-input"
										value={getTodayValue(habit) ?? ''}
										min="0"
										step="1"
										placeholder="0"
										onchange={(e) => handleValueChange(habit, e)}
									/>
									{#if habit.frontmatter.habit_goal !== null}
										<span class="text-xs opacity-50">
											/ {habit.frontmatter.habit_goal}
										</span>
									{/if}
									{#if habit.frontmatter.habit_unit}
										<span class="text-xs opacity-50">{habit.frontmatter.habit_unit}</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No habits yet
				</p>
			{/if}
		</section>

		<!-- Stats section -->
		<section>
			<h2 class="section-header text-lg font-semibold mb-3 flex items-center gap-2">
				<span class="w-2 h-2 rounded-full" style="background-color: rgb(var(--color-secondary-500))"></span>
				Stats
			</h2>

			<!-- Range selector -->
			<div class="range-selector flex gap-2 mb-4 overflow-x-auto pb-2">
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
					class:active={rangeType === 'alltime'}
					onclick={() => rangeType = 'alltime'}
				>
					All Time
				</button>
			</div>

			<!-- Overall summary -->
			{#if allHabits.length > 0}
				<div class="summary-card p-4 rounded-lg mb-4">
					<div class="text-sm opacity-70">{formatRangeLabel()}</div>
					<div class="text-3xl font-bold" style="color: rgb(var(--color-{getCompletionColor(overallRate)}-500))">
						{formatPercent(overallRate)}
					</div>
					<div class="text-sm opacity-70">Overall completion</div>
				</div>

				<!-- Per-habit breakdown -->
				<div class="space-y-3">
					{#each habitStats as { habit, rate, color } (habit.filename)}
						<div class="report-row p-3 rounded-lg">
							<div class="flex justify-between items-center mb-1">
								<span class="font-medium">{habit.title}</span>
								<span class="text-sm font-semibold" style="color: rgb(var(--color-{color}-500))">
									{formatPercent(rate)}
								</span>
							</div>
							<div class="progress-bar">
								<div
									class="progress-fill"
									style="width: {Math.round(rate * 100)}%; background-color: rgb(var(--color-{color}-500))"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-state text-center py-8 opacity-60">
					No habit data for this period
				</p>
			{/if}
		</section>
	</main>
{/if}


<style>
	.habit-row {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-mode='dark']) .habit-row {
		background-color: rgb(var(--color-surface-800));
	}

	.habit-row.completed {
		opacity: 0.8;
	}

	.habit-check {
		border-color: rgb(var(--color-surface-400));
		background: transparent;
		color: transparent;
		cursor: pointer;
		transition: all 0.15s;
	}

	.habit-check.checked {
		border-color: rgb(var(--color-success-500));
		background-color: rgb(var(--color-success-500));
		color: white;
	}

	.indicator-success {
		background-color: rgb(var(--color-success-500));
		color: white;
	}

	.indicator-pending {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .indicator-pending {
		background-color: rgb(var(--color-surface-600));
	}

	.habit-title {
		font-size: 0.9375rem;
	}

	.value-input {
		width: 3.5rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.375rem;
		border: 1px solid rgb(var(--color-surface-300));
		background-color: rgb(var(--color-surface-50));
		color: rgb(var(--body-text-color));
		text-align: center;
		font-size: 0.875rem;
		-moz-appearance: textfield;
	}

	.value-input::-webkit-inner-spin-button,
	.value-input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	:global([data-mode='dark']) .value-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

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
</style>
