<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import '../app.css';
	import Sheet from '$lib/components/Sheet.svelte';
	import ChipInput from '$lib/components/ChipInput.svelte';
	import DatePill from '$lib/components/DatePill.svelte';
	import ClockDrag from '$lib/components/ClockDrag.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import RecurrenceEditor from '$lib/components/RecurrenceEditor.svelte';
	import IconMenu from '~icons/lucide/menu';
	import IconCalendar from '~icons/lucide/calendar';
	import IconBarChart2 from '~icons/lucide/bar-chart-2';
	import IconSettings from '~icons/lucide/settings';
	import IconPlus from '~icons/lucide/plus';
	import { createCalendarCache } from '$lib/domain/calendar';
	import {
		store,
		addTimeLog,
		initializeStore,
		setCalendarCache,
		setIsLoading,
		setLoadErrors,
		setMeta,
		setSelectedDate
	} from '$lib/stores/app.svelte';
	import {
		markdownStore,
		initializeMarkdownStore,
		addTask as addMarkdownTask,
		addRecurringTask as addMarkdownRecurringTask
	} from '$lib/stores/markdown-store.svelte';
	import { setDataPathOverride } from '$lib/storage/storage';
	import { parseShortcodes } from '$lib/shortcode/parser';
	import { getTodayDate, getOffsetDate, formatLocalDate } from '$lib/domain/task';
	import {
		createDailyRecurrence,
		createWeeklyRecurrence,
		createMonthlyRecurrence,
		type WeekDay,
		type Recurrence
	} from '$lib/domain/recurrence';
	import IconGear from '~icons/lucide/settings';

	// CRITICAL: Set data path override synchronously BEFORE any child components initialize
	// This fixes a race condition where markdown-store would initialize before the path was set
	if (typeof window !== 'undefined') {
		try {
			const savedDataPath = localStorage.getItem('daylight-data-path');
			if (savedDataPath) {
				setDataPathOverride(savedDataPath);
			}
		} catch {
			// Ignore localStorage errors during SSR or in restricted contexts
		}
	}

	let { children }: { children?: Snippet | null } = $props();

	// Sidebar state
	let sidebarOpen = $state(false);

	const navItems = [
		{ href: '/calendar', label: 'Calendar', icon: IconCalendar },
		{ href: '/reports', label: 'Reports', icon: IconBarChart2 },
		{ href: '/settings', label: 'Settings', icon: IconSettings }
	];

	type ModalMode = 'task' | 'time' | null;
	let modalMode = $state<ModalMode>(null);

	// Add Task state
	let taskInput = $state('');
	let taskScheduledDate = $state<Date>(new Date());

	// Recurrence state
	type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
	let recurrenceType = $state<RecurrenceType>('none');
	let weeklyDays = $state<WeekDay[]>([]);
	let monthlyDay = $state(1);
	let customRecurrence = $state<Recurrence | null>(null);

	const weekDayOptions: { value: WeekDay; label: string }[] = [
		{ value: 'sun', label: 'S' },
		{ value: 'mon', label: 'M' },
		{ value: 'tue', label: 'T' },
		{ value: 'wed', label: 'W' },
		{ value: 'thu', label: 'T' },
		{ value: 'fri', label: 'F' },
		{ value: 'sat', label: 'S' }
	];

	// Log Time state
	let timeTaskId = $state<string | null>(null);
	let timeMinutes = $state(30);
	let timeDate = $state<Date>(new Date());
	let currentTheme = $state('flexoki-light');
	let themePreference = $state('flexoki-light');

	const darkThemes = new Set([
		'flexoki-dark', 'ayu-dark',
		'everforest-dark-hard', 'glacier', 'gruvbox-dark-hard',
		'kanagawa', 'liquidcarbon', 'modus-vivendi', 'modus-vivendi-tinted',
		'nordfox', 'pencildark', 'tokyo-night-storm'
	]);

	function setThemeAttributes(theme: string) {
		document.documentElement.setAttribute('data-theme', theme);
		document.documentElement.setAttribute('data-mode', darkThemes.has(theme) ? 'dark' : 'light');
	}

	function resolveSystemTheme(): string {
		const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		return prefersDark ? 'flexoki-dark' : 'flexoki-light';
	}

	async function applyTheme(preference: string) {
		themePreference = preference;

		if (preference === 'gtk') {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				const { applyGtkTheme, initGtkThemeListener } = await import('$lib/services/gtk-theme');
				const data = await invoke<{ colors: Record<string, string>; prefer_dark: boolean; theme_path: string | null }>('get_gtk_colors');
				applyGtkTheme(data);
				currentTheme = data.prefer_dark ? 'flexoki-dark' : 'flexoki-light';
				await initGtkThemeListener();
			} catch {
				// GTK not available, fall back to system
				const resolved = resolveSystemTheme();
				currentTheme = resolved;
				setThemeAttributes(resolved);
			}
		} else {
			// Clear any GTK overrides when switching away
			try {
				const { clearGtkTheme, destroyGtkThemeListener } = await import('$lib/services/gtk-theme');
				clearGtkTheme();
				destroyGtkThemeListener();
			} catch {
				// Module not loaded yet
			}

			const resolved = preference === 'system' ? resolveSystemTheme() : preference;
			currentTheme = resolved;
			setThemeAttributes(resolved);
		}

		try {
			localStorage.setItem('daylight-theme', preference);
		} catch {
			// Ignore theme persistence errors.
		}
	}

	function isActive(href: string, pathname: string): boolean {
		return pathname === href || pathname.startsWith(href + '/');
	}

	function handleNavClick(href: string) {
		if (href === '/today-bases') {
			setSelectedDate(getTodayDate());
		}
	}

	function openAddTask() {
		modalMode = 'task';
		taskInput = '';
		taskScheduledDate = new Date();
		recurrenceType = 'none';
		weeklyDays = [];
		monthlyDay = new Date().getDate();
		customRecurrence = null;
	}

	function openLogTime() {
		modalMode = 'time';
		timeTaskId = null;
		timeMinutes = 30;
		timeDate = new Date();
	}

	function closeModal() {
		modalMode = null;
	}

	async function handleAddTask() {
		if (!taskInput.trim()) return;

		const parsed = parseShortcodes(taskInput);
		const dateStr = formatLocalDate(taskScheduledDate);
		const projects = parsed.project ? [parsed.project] : [];

		if (recurrenceType === 'none') {
			// Regular one-time task
			await addMarkdownTask(parsed.title || taskInput.trim(), {
				tags: parsed.tags,
				contexts: parsed.contexts,
				projects,
				scheduled: dateStr
			});
		} else if (recurrenceType === 'daily') {
			// Daily recurring task
			const recurrence = createDailyRecurrence(dateStr);
			await addMarkdownRecurringTask(parsed.title || taskInput.trim(), recurrence, {
				tags: parsed.tags,
				contexts: parsed.contexts,
				projects
			});
		} else if (recurrenceType === 'weekly' && weeklyDays.length > 0) {
			// Weekly recurring task
			const recurrence = createWeeklyRecurrence(dateStr, weeklyDays);
			await addMarkdownRecurringTask(parsed.title || taskInput.trim(), recurrence, {
				tags: parsed.tags,
				contexts: parsed.contexts,
				projects
			});
		} else if (recurrenceType === 'monthly') {
			// Monthly recurring task
			const recurrence = createMonthlyRecurrence(dateStr, monthlyDay);
			await addMarkdownRecurringTask(parsed.title || taskInput.trim(), recurrence, {
				tags: parsed.tags,
				contexts: parsed.contexts,
				projects
			});
		} else if (recurrenceType === 'custom' && customRecurrence) {
			// Custom recurrence from editor
			await addMarkdownRecurringTask(parsed.title || taskInput.trim(), customRecurrence, {
				tags: parsed.tags,
				contexts: parsed.contexts,
				projects
			});
		}

		closeModal();
	}

	function toggleWeekDay(day: WeekDay) {
		if (weeklyDays.includes(day)) {
			weeklyDays = weeklyDays.filter(d => d !== day);
		} else {
			weeklyDays = [...weeklyDays, day];
		}
	}

	function handleLogTime() {
		if (!timeTaskId || timeMinutes <= 0) return;

		const dateStr = formatLocalDate(timeDate);
		addTimeLog(timeTaskId, dateStr, timeMinutes);

		closeModal();
	}

	let midnightTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleNextMidnight() {
		if (midnightTimer) {
			clearTimeout(midnightTimer);
		}

		const now = new Date();
		const next = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate() + 1,
			0,
			0,
			0,
			0
		);
		const delayMs = Math.max(0, next.getTime() - now.getTime());

		midnightTimer = setTimeout(() => {
			if (isActive('/today-bases', $page.url.pathname)) {
				setSelectedDate(getTodayDate());
			}
			scheduleNextMidnight();
		}, delayMs);
	}

	onMount(() => {
		// Listen for OS theme changes so "system" preference stays current
		const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
		function onSystemThemeChange() {
			if (themePreference === 'system') {
				const resolved = resolveSystemTheme();
				currentTheme = resolved;
				setThemeAttributes(resolved);
			}
		}
		darkMq.addEventListener('change', onSystemThemeChange);

		(async () => {
			setIsLoading(true);
			try {
				try {
					const savedTheme = localStorage.getItem('daylight-theme');
					if (savedTheme) {
						applyTheme(savedTheme);
					} else {
						// No saved preference — detect system theme
						applyTheme('system');
					}
				} catch {
					// localStorage unavailable — detect system theme
					const resolved = resolveSystemTheme();
					currentTheme = resolved;
					themePreference = 'system';
					setThemeAttributes(resolved);
				}
				const tauriGlobal = window as unknown as { __TAURI__?: { invoke?: unknown } };
				const isTauri =
					typeof window !== 'undefined' &&
					'__TAURI__' in window &&
					!!tauriGlobal.__TAURI__?.invoke;
				const calendarEnabled = true;

				if (!isTauri) {
					setLoadErrors([]);
					return;
				}

				const { loadAllWithErrors, loadCalendarCacheWithErrors } =
					await import('$lib/storage/storage');
				// Note: path override is already set synchronously at the top of this file

				const result = await loadAllWithErrors();
				initializeStore(result);
				initializeMarkdownStore();
				if (calendarEnabled) {
					const { isCalendarRefreshDue, refreshCalendarCache } = await import(
						'$lib/calendar/refresh'
					);
					const cacheResult = await loadCalendarCacheWithErrors();
					setCalendarCache(cacheResult.cache);
					setLoadErrors([...result.errors, ...cacheResult.errors]);
					if (isCalendarRefreshDue(result.meta)) {
						try {
							const refreshed = await refreshCalendarCache(result.meta, cacheResult.cache);
							setMeta(refreshed.meta);
							setCalendarCache(refreshed.cache);
						} catch {
							// Skip refresh errors on boot; user can retry manually in Settings.
						}
					}
				} else {
					setCalendarCache(createCalendarCache());
					setLoadErrors([...result.errors]);
				}
			} catch {
				setLoadErrors([{ file: 'startup', message: 'Failed to initialize storage.' }]);
			} finally {
				setIsLoading(false);
			}
		})();
		scheduleNextMidnight();

		return () => {
			darkMq.removeEventListener('change', onSystemThemeChange);
			if (midnightTimer) {
				clearTimeout(midnightTimer);
			}
			import('$lib/services/gtk-theme')
				.then((m) => m.destroyGtkThemeListener())
				.catch(() => {});
		};
	});
</script>

	<!-- Sidebar -->
	<Sidebar
		open={sidebarOpen}
		onclose={() => (sidebarOpen = false)}
		projects={markdownStore.allProjects}
		tags={markdownStore.allTags}
	/>

	<div class="app-shell min-h-screen flex flex-col">
		<!-- Main content area -->
		<div class="main-content flex-1 overflow-y-auto">
			{#if children}
				{@render children()}
			{/if}
	</div>

	<!-- FAB (Floating Action Button) -->
	<div class="fab-container fixed right-4 z-50">
		<button
			type="button"
			onclick={openAddTask}
			class="fab w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
			aria-label="Add task"
		>
			<IconPlus width="24" height="24" />
		</button>
	</div>

	<!-- Navigation bar (bottom on mobile, top on desktop) -->
	<nav class="nav-bar fixed left-0 right-0 z-40 flex items-center justify-between px-2">
		<button
			type="button"
			class="nav-btn"
			onclick={() => (sidebarOpen = true)}
			aria-label="Open menu"
		>
			<IconMenu width="20" height="20" />
		</button>

		{#each navItems as item}
			{@const Icon = item.icon}
			<a
				href={item.href}
				class="nav-btn"
				class:active={isActive(item.href, $page.url.pathname)}
				onclick={() => handleNavClick(item.href)}
				aria-label={item.label}
			>
				<Icon width="20" height="20" />
			</a>
		{/each}
	</nav>
</div>

<!-- Add Task Sheet -->
<Sheet open={modalMode === 'task'} onclose={closeModal} title="Add Task">
	<div class="space-y-4">
		<ChipInput
			bind:value={taskInput}
			placeholder="Task title with #tags @contexts +project"
			suggestions={[...markdownStore.allTags, ...markdownStore.allContexts, ...markdownStore.allProjects]}
		/>

		<div class="flex items-center gap-2">
			<span class="text-sm opacity-70">Schedule for:</span>
			<DatePill
				bind:date={taskScheduledDate}
			/>
		</div>

		<!-- Recurrence Options -->
		<div class="recurrence-section">
			<span class="text-sm opacity-70 block mb-2">Repeat:</span>
			<div class="flex gap-2 mb-3">
				<button
					type="button"
					class="recurrence-btn"
					class:active={recurrenceType === 'none'}
					onclick={() => recurrenceType = 'none'}
				>
					None
				</button>
				<button
					type="button"
					class="recurrence-btn"
					class:active={recurrenceType === 'daily'}
					onclick={() => recurrenceType = 'daily'}
				>
					Daily
				</button>
				<button
					type="button"
					class="recurrence-btn"
					class:active={recurrenceType === 'weekly'}
					onclick={() => recurrenceType = 'weekly'}
				>
					Weekly
				</button>
				<button
					type="button"
					class="recurrence-btn"
					class:active={recurrenceType === 'monthly'}
					onclick={() => recurrenceType = 'monthly'}
				>
					Monthly
				</button>
				<button
					type="button"
					class="recurrence-btn icon-btn"
					class:active={recurrenceType === 'custom'}
					onclick={() => { recurrenceType = 'custom'; }}
					title="Custom recurrence"
				>
					<IconGear />
				</button>
			</div>

			{#if recurrenceType === 'weekly'}
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
			{/if}

			{#if recurrenceType === 'monthly'}
				<div class="flex items-center gap-2">
					<span class="text-sm opacity-70">Day of month:</span>
					<select
						class="monthly-day-select p-2 rounded-lg"
						bind:value={monthlyDay}
					>
						{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
							<option value={day}>{day}</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if recurrenceType === 'custom'}
				<RecurrenceEditor
					startDate={formatLocalDate(taskScheduledDate)}
					initialRecurrence={customRecurrence}
					inline={true}
					onchange={(rec) => {
						customRecurrence = rec;
					}}
				/>
			{/if}
		</div>

		<div class="flex justify-between items-center pt-4">
			<button
				type="button"
				class="text-sm opacity-70"
				onclick={openLogTime}
			>
				Log time instead
			</button>
			<div class="flex gap-2">
				<button
					type="button"
					class="px-4 py-2 rounded-lg cancel-btn"
					onclick={closeModal}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-4 py-2 rounded-lg primary-btn"
					onclick={handleAddTask}
					disabled={(recurrenceType === 'weekly' && weeklyDays.length === 0) || (recurrenceType === 'custom' && !customRecurrence)}
				>
					Add
				</button>
			</div>
		</div>
	</div>
</Sheet>

<!-- Log Time Sheet -->
<Sheet open={modalMode === 'time'} onclose={closeModal} title="Log Time">
	<div class="space-y-4">
		<!-- Task selector -->
		<div>
			<label for="time-task-select" class="block text-sm opacity-70 mb-2">Task</label>
			<select
				id="time-task-select"
				class="w-full p-3 rounded-lg border select-input"
				bind:value={timeTaskId}
			>
				<option value={null}>Select a task...</option>
				{#each store.tasks.filter(t => !t.completed && !t.isSeriesTemplate) as task}
					<option value={task.id}>{task.title || 'Untitled'}</option>
				{/each}
			</select>
		</div>

		<!-- Date selector with quick options -->
		<div>
			<span class="block text-sm opacity-70 mb-2">Date</span>
			<div class="flex gap-2 flex-wrap">
				<button
					type="button"
					class="quick-date-btn"
					class:active={timeDate.toDateString() === new Date(getTodayDate()).toDateString()}
					onclick={() => timeDate = new Date()}
				>
					Today
				</button>
				<button
					type="button"
					class="quick-date-btn"
					class:active={timeDate.toDateString() === new Date(getOffsetDate(-1)).toDateString()}
					onclick={() => {
						const yesterday = new Date();
						yesterday.setDate(yesterday.getDate() - 1);
						timeDate = yesterday;
					}}
				>
					Yesterday
				</button>
				<DatePill bind:date={timeDate} />
			</div>
		</div>

		<!-- Duration with ClockDrag -->
		<div>
			<span class="block text-sm opacity-70 mb-2">Duration</span>
			<ClockDrag bind:minutes={timeMinutes} />
		</div>

		<div class="flex justify-end gap-2 pt-4">
			<button
				type="button"
				class="px-4 py-2 rounded-lg cancel-btn"
				onclick={closeModal}
			>
				Cancel
			</button>
			<button
				type="button"
				class="px-4 py-2 rounded-lg primary-btn"
				onclick={handleLogTime}
				disabled={!timeTaskId || timeMinutes <= 0}
			>
				Log Time
			</button>
		</div>
	</div>
</Sheet>

<style>
	.fab {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.fab:hover {
		background-color: rgb(var(--color-primary-600));
	}

	/* Mobile: nav bar at bottom */
	.nav-bar {
		bottom: 0;
		top: auto;
		/* Use max() to ensure minimum height even if env() returns 0 on Android */
		height: calc(3.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback)));
		padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback));
		background-color: rgb(var(--color-surface-100));
		border-top: 1px solid rgb(var(--color-surface-200));
		border-bottom: none;
	}

	:global([data-mode='dark']) .nav-bar {
		background-color: rgb(var(--color-surface-800));
		border-top-color: rgb(var(--color-surface-600));
	}

	.main-content {
		/* Add extra padding to ensure content clears the nav bar */
		padding-bottom: calc(4.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback)));
		padding-top: max(env(safe-area-inset-top, 0px), var(--android-status-fallback));
	}

	.fab-container {
		bottom: calc(5.5rem + max(env(safe-area-inset-bottom, 0px), var(--android-nav-fallback)));
	}

	/* Desktop: nav bar at top */
	@media (min-width: 768px) {
		.nav-bar {
			top: 0;
			bottom: auto;
			height: calc(3.5rem + env(safe-area-inset-top, 0px));
			padding-bottom: 0;
			padding-top: env(safe-area-inset-top, 0px);
			border-top: none;
			border-bottom: 1px solid rgb(var(--color-surface-200));
		}

		:global([data-mode='dark']) .nav-bar {
			border-bottom-color: rgb(var(--color-surface-600));
			border-top: none;
		}

		.main-content {
			padding-top: calc(3.5rem + env(safe-area-inset-top, 0px));
			padding-bottom: 1rem;
		}

		.fab-container {
			bottom: 1.5rem;
		}
	}

	.nav-btn {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		font-size: 1.25rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgb(var(--color-surface-600));
		transition: background-color 0.15s, color 0.15s;
		text-decoration: none;
	}

	.nav-btn:hover {
		background-color: rgb(var(--color-hover-bg));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .nav-btn:hover {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.nav-btn.active {
		color: rgb(var(--color-primary-500));
		background-color: rgb(var(--color-primary-100));
	}

	:global([data-mode='dark']) .nav-btn.active {
		background-color: rgb(var(--color-primary-900) / 0.5);
		color: rgb(var(--color-primary-400));
	}

	.primary-btn {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.primary-btn:hover {
		background-color: rgb(var(--color-primary-600));
	}

	.primary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-btn {
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .cancel-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.select-input {
		background-color: rgb(var(--color-surface-100));
		border-color: rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .select-input {
		background-color: rgb(var(--color-hover-bg-strong));
		border-color: rgb(var(--color-surface-600));
	}

	.quick-date-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		background-color: rgb(var(--color-hover-bg));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .quick-date-btn {
		background-color: rgb(var(--color-hover-bg-strong));
		color: rgb(var(--body-text-color));
	}

	.quick-date-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .quick-date-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.quick-date-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	:global([data-mode='dark']) .quick-date-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--body-text-color));
	}

	/* Recurrence styles */
	.recurrence-btn {
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background-color: rgb(var(--color-hover-bg));
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .recurrence-btn {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.recurrence-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .recurrence-btn:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.recurrence-btn.active {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.recurrence-btn.icon-btn {
		padding: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
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
		color: rgb(var(--color-on-primary));
	}

	.monthly-day-select {
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .monthly-day-select {
		background-color: rgb(var(--color-hover-bg-strong));
		border-color: rgb(var(--color-surface-600));
	}
</style>
