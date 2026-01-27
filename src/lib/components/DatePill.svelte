<script lang="ts">
	interface Props {
		date: Date;
		onselect?: (date: Date) => void;
		showPicker?: boolean;
	}

	let { date = $bindable(new Date()), onselect, showPicker = false }: Props = $props();

	let pickerOpen = $state(false);

	function formatDate(d: Date): string {
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (isSameDay(d, today)) return 'Today';
		if (isSameDay(d, tomorrow)) return 'Tomorrow';
		if (isSameDay(d, yesterday)) return 'Yesterday';

		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function isSameDay(a: Date, b: Date): boolean {
		return (
			a.getFullYear() === b.getFullYear() &&
			a.getMonth() === b.getMonth() &&
			a.getDate() === b.getDate()
		);
	}

	function selectQuickDate(offset: number) {
		const newDate = new Date();
		newDate.setDate(newDate.getDate() + offset);
		date = newDate;
		onselect?.(date);
		pickerOpen = false;
	}

	function handleDateInput(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.value) {
			date = new Date(target.value + 'T00:00:00');
			onselect?.(date);
			pickerOpen = false;
		}
	}

	function formatInputDate(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
</script>

<div class="date-pill-container relative inline-block">
	<button type="button" class="date-pill" onclick={() => (pickerOpen = !pickerOpen)}>
		{formatDate(date)}
	</button>

	{#if pickerOpen}
		<div class="date-picker-dropdown absolute top-full left-0 mt-1 p-2 rounded-lg shadow-lg z-50">
			<div class="quick-dates flex flex-col gap-1 mb-2">
				<button type="button" class="quick-date-btn" onclick={() => selectQuickDate(-1)}>
					Yesterday
				</button>
				<button type="button" class="quick-date-btn" onclick={() => selectQuickDate(0)}>
					Today
				</button>
				<button type="button" class="quick-date-btn" onclick={() => selectQuickDate(1)}>
					Tomorrow
				</button>
				<button type="button" class="quick-date-btn" onclick={() => selectQuickDate(3)}>
					In 3 days
				</button>
				<button type="button" class="quick-date-btn" onclick={() => selectQuickDate(7)}>
					In 1 week
				</button>
			</div>
			<div class="divider my-2"></div>
			<input
				type="date"
				value={formatInputDate(date)}
				onchange={handleDateInput}
				class="date-input w-full p-2 rounded border"
			/>
		</div>
	{/if}
</div>

<style>
	.date-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.375rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--body-text-color));
		transition: background-color 0.15s;
	}

	:global([data-theme='flexoki-dark']) .date-pill,
	:global([data-theme='ayu-dark']) .date-pill {
		background-color: rgb(var(--color-surface-800));
	}

	.date-pill:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .date-pill:hover,
	:global([data-theme='ayu-dark']) .date-pill:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.date-picker-dropdown {
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-200));
		min-width: 160px;
	}

	:global([data-theme='flexoki-dark']) .date-picker-dropdown,
	:global([data-theme='ayu-dark']) .date-picker-dropdown {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.quick-date-btn {
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		transition: background-color 0.15s;
	}

	.quick-date-btn:hover {
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .quick-date-btn:hover,
	:global([data-theme='ayu-dark']) .quick-date-btn:hover {
		background-color: rgb(var(--color-surface-700));
	}

	.divider {
		height: 1px;
		background-color: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .divider,
	:global([data-theme='ayu-dark']) .divider {
		background-color: rgb(var(--color-surface-600));
	}

	.date-input {
		background-color: rgb(var(--color-surface-100));
		border-color: rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-theme='flexoki-dark']) .date-input,
	:global([data-theme='ayu-dark']) .date-input {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}
</style>
