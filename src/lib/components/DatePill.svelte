<script lang="ts">
	import { onMount, tick } from 'svelte';

	interface Props {
		date: Date;
		onselect?: (date: Date) => void;
		showPicker?: boolean;
		allowFloat?: boolean;
		mode?: 'active' | 'float';
	}

	let {
		date = $bindable(new Date()),
		onselect,
		showPicker = false,
		allowFloat = false,
		mode = $bindable('active')
	}: Props = $props();

	let pickerOpen = $state(false);
	let alignRight = $state(false);
	let containerElement: HTMLDivElement | null = $state(null);
	let dropdownElement: HTMLDivElement | null = $state(null);

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
		mode = 'active';
		onselect?.(date);
		pickerOpen = false;
	}

	function handleDateInput(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.value) {
			date = new Date(target.value + 'T00:00:00');
			mode = 'active';
			onselect?.(date);
			pickerOpen = false;
		}
	}

	function selectFloat() {
		if (!allowFloat) return;
		mode = 'float';
		pickerOpen = false;
	}

	function formatInputDate(d: Date): string {
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function closePicker() {
		pickerOpen = false;
	}

	async function openPicker() {
		pickerOpen = true;
		await tick();
		updateDropdownAlignment();
	}

	function togglePicker() {
		if (pickerOpen) {
			closePicker();
			return;
		}
		void openPicker();
	}

	function updateDropdownAlignment() {
		if (!pickerOpen || !containerElement || !dropdownElement) return;
		const viewportWidth = window.innerWidth;
		const rect = containerElement.getBoundingClientRect();
		const dropdownWidth = dropdownElement.offsetWidth;
		const wouldOverflowRight = rect.left + dropdownWidth > viewportWidth - 8;
		const wouldOverflowLeftIfRightAligned = rect.right - dropdownWidth < 8;
		alignRight = wouldOverflowRight && !wouldOverflowLeftIfRightAligned;
	}

	onMount(() => {
		const handlePointerDown = (event: PointerEvent) => {
			if (!pickerOpen) return;
			if (!(event.target instanceof Node)) return;
			if (containerElement?.contains(event.target)) return;
			closePicker();
		};

		const handleKeydown = (event: KeyboardEvent) => {
			if (!pickerOpen) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				closePicker();
			}
		};

		const handleWindowResize = () => updateDropdownAlignment();

		window.addEventListener('pointerdown', handlePointerDown);
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('resize', handleWindowResize);
		window.addEventListener('scroll', handleWindowResize, true);

		return () => {
			window.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('resize', handleWindowResize);
			window.removeEventListener('scroll', handleWindowResize, true);
		};
	});
</script>

<div class="date-pill-container relative inline-block" bind:this={containerElement}>
	<button type="button" class="date-pill" onclick={togglePicker}>
		{mode === 'float' ? 'Float' : formatDate(date)}
	</button>

	{#if pickerOpen}
		<div
			class="date-picker-dropdown absolute top-full left-0 mt-1 p-2 rounded-lg shadow-lg z-50"
			class:align-right={alignRight}
			bind:this={dropdownElement}
		>
			<div class="quick-dates flex flex-col gap-1 mb-2">
				{#if allowFloat}
					<button type="button" class="quick-date-btn" onclick={selectFloat}>
						Float
					</button>
					<div class="divider my-2"></div>
				{/if}
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
		font-weight: 600;
		background-color: rgb(var(--color-surface-100));
		color: rgb(var(--body-text-color));
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .date-pill {
		background-color: rgb(var(--color-surface-800));
	}

	.date-pill:hover {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .date-pill:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.date-picker-dropdown {
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-200));
		min-width: 160px;
		max-width: min(300px, calc(100vw - 1rem));
	}

	.date-picker-dropdown.align-right {
		left: auto;
		right: 0;
	}

	:global([data-mode='dark']) .date-picker-dropdown {
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
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .quick-date-btn:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.divider {
		height: 1px;
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .divider {
		background-color: rgb(var(--color-surface-600));
	}

	.date-input {
		background-color: rgb(var(--color-surface-50));
		border-color: rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .date-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.date-input:focus {
		outline: none;
		border-color: rgb(var(--color-primary-500));
		box-shadow: 0 0 0 2px rgb(var(--color-primary-500) / 0.2);
	}
</style>
