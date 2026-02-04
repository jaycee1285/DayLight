<script lang="ts">
	import {
		createDailyRecurrence,
		createWeeklyRecurrence,
		createMonthlyRecurrence,
		createMonthlyNthWeekdayRecurrence,
		createYearlyRecurrence,
		type Recurrence,
		type WeekDay
	} from '$lib/domain/recurrence';
	import { formatLocalDate } from '$lib/domain/task';

	interface Props {
		/** Initial recurrence to edit (optional) */
		initialRecurrence?: Recurrence | null;
		/** Start date for new recurrence */
		startDate: string;
		/** Callback when recurrence is saved */
		onsave?: (recurrence: Recurrence) => void;
		/** Callback when editor is cancelled */
		oncancel?: () => void;
		/** Inline mode - hides buttons, auto-updates via onchange */
		inline?: boolean;
		/** Called on every change in inline mode */
		onchange?: (recurrence: Recurrence) => void;
	}

	let { initialRecurrence = null, startDate, onsave, oncancel, inline = false, onchange }: Props = $props();

	// Frequency selection
	type FrequencyType = 'daily' | 'weekly' | 'monthly' | 'yearly';
	let frequency = $state<FrequencyType>(initialRecurrence?.frequency || 'daily');

	// Daily options
	let dailyInterval = $state(initialRecurrence?.interval || 1);

	// Weekly options
	let weeklyDays = $state<WeekDay[]>(initialRecurrence?.weekDays || []);
	let weeklyInterval = $state(initialRecurrence?.interval || 1);

	// Monthly options
	type MonthlyMode = 'dayOfMonth' | 'nthWeekday';
	let monthlyMode = $state<MonthlyMode>(
		initialRecurrence?.nthWeekday !== undefined ? 'nthWeekday' : 'dayOfMonth'
	);
	let monthlyDay = $state(initialRecurrence?.dayOfMonth || new Date().getDate());
	let monthlyNth = $state(initialRecurrence?.nthWeekday || 1);
	let monthlyWeekday = $state<WeekDay>(initialRecurrence?.weekdayForNth || 'mon');

	const weekDayOptions: { value: WeekDay; label: string }[] = [
		{ value: 'sun', label: 'Su' },
		{ value: 'mon', label: 'Mo' },
		{ value: 'tue', label: 'Tu' },
		{ value: 'wed', label: 'We' },
		{ value: 'thu', label: 'Th' },
		{ value: 'fri', label: 'Fr' },
		{ value: 'sat', label: 'Sa' }
	];

	const nthOptions = [
		{ value: 1, label: '1st' },
		{ value: 2, label: '2nd' },
		{ value: 3, label: '3rd' },
		{ value: 4, label: '4th' },
		{ value: -1, label: 'Last' }
	];

	const weekdayFullNames: { value: WeekDay; label: string }[] = [
		{ value: 'sun', label: 'Sunday' },
		{ value: 'mon', label: 'Monday' },
		{ value: 'tue', label: 'Tuesday' },
		{ value: 'wed', label: 'Wednesday' },
		{ value: 'thu', label: 'Thursday' },
		{ value: 'fri', label: 'Friday' },
		{ value: 'sat', label: 'Saturday' }
	];

	function toggleWeekDay(day: WeekDay) {
		if (weeklyDays.includes(day)) {
			weeklyDays = weeklyDays.filter(d => d !== day);
		} else {
			weeklyDays = [...weeklyDays, day];
		}
	}

	function buildRecurrence(): Recurrence {
		switch (frequency) {
			case 'daily':
				return createDailyRecurrence(startDate, dailyInterval);
			case 'weekly':
				return createWeeklyRecurrence(startDate, weeklyDays, weeklyInterval);
			case 'monthly':
				if (monthlyMode === 'nthWeekday') {
					return createMonthlyNthWeekdayRecurrence(startDate, monthlyNth, monthlyWeekday);
				}
				return createMonthlyRecurrence(startDate, monthlyDay);
			case 'yearly':
				return createYearlyRecurrence(startDate);
		}
	}

	function handleSave() {
		const recurrence = buildRecurrence();
		onsave?.(recurrence);
	}

	// Validation
	const isValid = $derived(
		frequency === 'daily' ||
		frequency === 'yearly' ||
		(frequency === 'weekly' && weeklyDays.length > 0) ||
		frequency === 'monthly'
	);

	// In inline mode, call onchange whenever configuration changes
	$effect(() => {
		if (inline && onchange && isValid) {
			const recurrence = buildRecurrence();
			onchange(recurrence);
		}
	});
</script>

<div class="recurrence-editor" class:compact={inline}>
	<!-- Frequency selector -->
	<div class="mb-4">
		<span class="text-sm opacity-70 block mb-2">Frequency:</span>
		<div class="flex gap-2 flex-wrap">
			<button
				type="button"
				class="freq-btn"
				class:active={frequency === 'daily'}
				onclick={() => frequency = 'daily'}
			>
				Daily
			</button>
			<button
				type="button"
				class="freq-btn"
				class:active={frequency === 'weekly'}
				onclick={() => frequency = 'weekly'}
			>
				Weekly
			</button>
			<button
				type="button"
				class="freq-btn"
				class:active={frequency === 'monthly'}
				onclick={() => frequency = 'monthly'}
			>
				Monthly
			</button>
			<button
				type="button"
				class="freq-btn"
				class:active={frequency === 'yearly'}
				onclick={() => frequency = 'yearly'}
			>
				Yearly
			</button>
		</div>
	</div>

	<!-- Daily options -->
	{#if frequency === 'daily'}
		<div class="options-section">
			<label class="flex items-center gap-2">
				<span class="text-sm opacity-70">Every</span>
				<input
					type="number"
					min="1"
					max="365"
					class="interval-input"
					bind:value={dailyInterval}
				/>
				<span class="text-sm opacity-70">{dailyInterval === 1 ? 'day' : 'days'}</span>
			</label>
		</div>
	{/if}

	<!-- Weekly options -->
	{#if frequency === 'weekly'}
		<div class="options-section">
			<div class="mb-3">
				<span class="text-sm opacity-70 block mb-2">On days:</span>
				<div class="weekday-selector flex gap-1">
					{#each weekDayOptions as { value, label }}
						<button
							type="button"
							class="weekday-btn"
							class:selected={weeklyDays.includes(value)}
							onclick={() => toggleWeekDay(value)}
						>
							{label}
						</button>
					{/each}
				</div>
				{#if weeklyDays.length === 0}
					<p class="text-xs opacity-60 mt-2">Select at least one day</p>
				{/if}
			</div>
			<label class="flex items-center gap-2">
				<span class="text-sm opacity-70">Every</span>
				<input
					type="number"
					min="1"
					max="52"
					class="interval-input"
					bind:value={weeklyInterval}
				/>
				<span class="text-sm opacity-70">{weeklyInterval === 1 ? 'week' : 'weeks'}</span>
			</label>
		</div>
	{/if}

	<!-- Monthly options -->
	{#if frequency === 'monthly'}
		<div class="options-section">
			<div class="mb-3">
				<span class="text-sm opacity-70 block mb-2">Repeat on:</span>
				<div class="flex gap-2 mb-3">
					<button
						type="button"
						class="mode-btn"
						class:active={monthlyMode === 'dayOfMonth'}
						onclick={() => monthlyMode = 'dayOfMonth'}
					>
						Day of month
					</button>
					<button
						type="button"
						class="mode-btn"
						class:active={monthlyMode === 'nthWeekday'}
						onclick={() => monthlyMode = 'nthWeekday'}
					>
						Nth weekday
					</button>
				</div>
			</div>

			{#if monthlyMode === 'dayOfMonth'}
				<label class="flex items-center gap-2">
					<span class="text-sm opacity-70">Day:</span>
					<select class="select-input" bind:value={monthlyDay}>
						{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
							<option value={day}>{day}</option>
						{/each}
					</select>
				</label>
			{:else}
				<div class="flex items-center gap-2 flex-wrap">
					<select class="select-input" bind:value={monthlyNth}>
						{#each nthOptions as { value, label }}
							<option {value}>{label}</option>
						{/each}
					</select>
					<select class="select-input" bind:value={monthlyWeekday}>
						{#each weekdayFullNames as { value, label }}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Yearly - no extra options needed -->
	{#if frequency === 'yearly'}
		<div class="options-section">
			<p class="text-sm opacity-70">Repeats yearly on the same date</p>
		</div>
	{/if}

	<!-- Action buttons (hidden in inline mode) -->
	{#if !inline}
		<div class="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
			<button
				type="button"
				class="px-4 py-2 rounded-lg cancel-btn"
				onclick={() => oncancel?.()}
			>
				Cancel
			</button>
			<button
				type="button"
				class="px-4 py-2 rounded-lg primary-btn"
				onclick={handleSave}
				disabled={!isValid}
			>
				Save
			</button>
		</div>
	{/if}
</div>

<style>
	.recurrence-editor {
		padding: 0.5rem 0;
	}

	.freq-btn, .mode-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background-color: rgb(var(--color-surface-200));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .freq-btn,
	:global([data-mode='dark']) .mode-btn {
		background-color: rgb(var(--color-surface-700));
	}

	.freq-btn:hover, .mode-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .freq-btn:hover,
	:global([data-mode='dark']) .mode-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.freq-btn.active, .mode-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.weekday-btn {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		font-size: 0.75rem;
		font-weight: 600;
		background-color: rgb(var(--color-hover-bg));
		border: none;
		cursor: pointer;
		transition: all 0.15s;
	}

	:global([data-mode='dark']) .weekday-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.weekday-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .weekday-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.weekday-btn.selected {
		background-color: rgb(var(--color-primary-500));
		color: white;
	}

	.interval-input, .select-input {
		padding: 0.5rem;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		font-size: 0.875rem;
	}

	:global([data-mode='dark']) .interval-input,
	:global([data-mode='dark']) .select-input {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.interval-input {
		width: 4rem;
		text-align: center;
	}

	.options-section {
		padding: 1rem;
		background-color: rgb(var(--color-surface-100));
		border-radius: 0.5rem;
		margin-bottom: 0.5rem;
	}

	:global([data-mode='dark']) .options-section {
		background-color: rgb(var(--color-surface-800));
	}

	.cancel-btn {
		background-color: rgb(var(--color-hover-bg));
		border: none;
	}

	:global([data-mode='dark']) .cancel-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.cancel-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .cancel-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.primary-btn {
		background-color: rgb(var(--color-primary-500));
		border: none;
		color: white;
	}

	.primary-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.primary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Compact mode for inline use */
	.recurrence-editor.compact {
		padding: 0;
	}

	.recurrence-editor.compact .mb-4 {
		margin-bottom: 0.5rem;
	}

	.recurrence-editor.compact .options-section {
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.25rem;
	}

	.recurrence-editor.compact .freq-btn,
	.recurrence-editor.compact .mode-btn {
		padding: 0.375rem 0.5rem;
		font-size: 0.8125rem;
	}

	.recurrence-editor.compact .weekday-btn {
		width: 1.875rem;
		height: 1.875rem;
		font-size: 0.6875rem;
	}

	.recurrence-editor.compact .interval-input {
		width: 3.5rem;
		padding: 0.375rem;
	}

	.recurrence-editor.compact .select-input {
		padding: 0.375rem;
	}
</style>
