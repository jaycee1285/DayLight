<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
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
	import IconTarget from '~icons/lucide/target';
	import IconSettings from '~icons/lucide/settings';
	import AddHabitSheet from '$lib/components/AddHabitSheet.svelte';
	import IconPlus from '~icons/lucide/plus';
	import { createCalendarCache } from '$lib/domain/calendar';
	import {
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
		addRecurringTask as addMarkdownRecurringTask,
		logTime as logMarkdownTime
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
	import {
		resolveShortcutCommand,
		eventMatchesKey,
		isEditableTarget,
		formatAriaKeyShortcuts,
		type ShortcutCommand,
		type ShortcutScope
	} from '$lib/shortcuts/registry';
	import { waitForTauriReady } from '$lib/platform/tauri';

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
	const devBuildMarker = '2026-02-18T15:09Z-shortcut-diag';

	// Sidebar state
	let sidebarOpen = $state(false);

		const shortcutCombos = {
			newTask: { key: 'n', ctrlOrMeta: true },
			newTaskAlt: { key: 'n', alt: true, shift: true },
			logTime: { key: 't', ctrlOrMeta: true, shift: true },
			goToday: { key: '1', ctrlOrMeta: true },
			goCalendar: { key: '2', ctrlOrMeta: true },
			goReports: { key: '3', ctrlOrMeta: true },
			goHabits: { key: '4', ctrlOrMeta: true },
		goSettings: { key: '5', ctrlOrMeta: true },
			openCommandPalette: { key: 'k', ctrlOrMeta: true },
			openCommandPaletteAlt: { key: 'k', alt: true, shift: true },
			openCommandPaletteAltSecondary: { key: 'p', alt: true, shift: true },
			showShortcutHelp: { key: '?', shift: true },
			showShortcutHelpAlt: { key: 'h', alt: true, shift: true },
			closeOverlay: { key: 'Escape' }
		};

	const navItems = [
		{
			href: '/calendar',
			label: 'Calendar',
			icon: IconCalendar,
			ariaKeyShortcuts: formatAriaKeyShortcuts(shortcutCombos.goCalendar)
		},
		{
			href: '/reports',
			label: 'Reports',
			icon: IconBarChart2,
			ariaKeyShortcuts: formatAriaKeyShortcuts(shortcutCombos.goReports)
		},
		{
			href: '/habits',
			label: 'Habits',
			icon: IconTarget,
			ariaKeyShortcuts: formatAriaKeyShortcuts(shortcutCombos.goHabits)
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: IconSettings,
			ariaKeyShortcuts: formatAriaKeyShortcuts(shortcutCombos.goSettings)
		}
	];

	type ModalMode = 'task' | 'time' | 'command' | 'shortcuts' | null;
	type ShortcutDebugEntry = {
		id: number;
		time: string;
		stage: string;
		key: string;
		code: string;
		mods: string;
		scope: string;
		target: string;
		editableTarget: boolean;
		commandId: string;
	};
	let modalMode = $state<ModalMode>(null);
	let showAddHabit = $state(false);
	let commandQuery = $state('');
	let commandInput: HTMLInputElement | null = $state(null);
	let shortcutIsMac = false;
	let shortcutDebugEnabled = $state(import.meta.env.DEV);
	let tauriInvokeAvailable = $state(false);
	let shortcutDebugEntries = $state<ShortcutDebugEntry[]>([]);
	let shortcutDebugNextId = 1;
	const newTaskAriaShortcuts = `${formatAriaKeyShortcuts(shortcutCombos.newTask)} ${formatAriaKeyShortcuts(shortcutCombos.newTaskAlt)}`;
	const logTimeAriaShortcuts = formatAriaKeyShortcuts(shortcutCombos.logTime);
	const commandPaletteAriaShortcuts = `${formatAriaKeyShortcuts(shortcutCombos.openCommandPalette)} ${formatAriaKeyShortcuts(shortcutCombos.openCommandPaletteAlt)} ${formatAriaKeyShortcuts(shortcutCombos.openCommandPaletteAltSecondary)}`;

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
	let lastLogTimeTaskId = $state<string | null>(null);
	let timeMinutes = $state(30);
	let timeDate = $state<Date>(new Date());
	const logTimeTaskOptions = $derived.by(() => {
		const seen = new Set<string>();
		return markdownStore.groupedView.now.filter((task) => {
			if (seen.has(task.filename)) return false;
			seen.add(task.filename);
			return true;
		});
	});
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

	function navigateTo(href: string) {
		handleNavClick(href);
		if (!isActive(href, $page.url.pathname)) {
			void goto(href);
		}
	}

	function openAddTask() {
		// On /habits route, open the add habit sheet instead
		if ($page.url.pathname === '/habits') {
			showAddHabit = true;
			return;
		}
		modalMode = 'task';
		taskInput = '';
		taskScheduledDate = new Date();
		recurrenceType = 'none';
		weeklyDays = [];
		monthlyDay = new Date().getDate();
		customRecurrence = null;
	}

	function openLogTime() {
		openLogTimeForTask(null);
	}

	function openLogTimeForTask(taskId: string | null) {
		modalMode = 'time';
		const hasRequestedTask =
			typeof taskId === 'string' && logTimeTaskOptions.some((task) => task.filename === taskId);
		const hasRememberedTask =
			typeof lastLogTimeTaskId === 'string' &&
			logTimeTaskOptions.some((task) => task.filename === lastLogTimeTaskId);
		if (hasRequestedTask) {
			timeTaskId = taskId;
		} else if (hasRememberedTask) {
			timeTaskId = lastLogTimeTaskId;
		} else {
			timeTaskId = logTimeTaskOptions[0]?.filename ?? null;
		}
		timeMinutes = 30;
		timeDate = new Date();
	}

	function openCommandPalette() {
		commandQuery = '';
		modalMode = 'command';
	}

	function openShortcutsHelp() {
		modalMode = 'shortcuts';
	}

	function closeModal() {
		modalMode = null;
	}

	function hasOpenMenuOrPopover(): boolean {
		const activeElement = document.activeElement;
		if (!(activeElement instanceof HTMLElement)) return false;
		return !!activeElement.closest(
			'.context-menu, .reschedule-dropdown, .date-picker-dropdown, .picker-sheet'
		);
	}

	function hasOpenModalLayer(): boolean {
		if (modalMode !== null || sidebarOpen) return true;
		const activeElement = document.activeElement;
		if (!(activeElement instanceof HTMLElement)) return false;
		return !!activeElement.closest('[role="dialog"], .session-modal, .sidebar');
	}

	function getCurrentShortcutScope(): ShortcutScope {
		if (hasOpenModalLayer()) return 'modal';
		if (hasOpenMenuOrPopover()) return 'menu';
		if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.task-row')) {
			return 'task-row';
		}
		return 'page';
	}

	function closeLayoutLayer(): boolean {
		if (modalMode !== null) {
			closeModal();
			return true;
		}
		if (sidebarOpen) {
			sidebarOpen = false;
			return true;
		}
		return false;
	}

	interface CommandPaletteAction {
		id: string;
		label: string;
		hint: string;
		run: () => void;
	}

	const commandPaletteActions: CommandPaletteAction[] = [
		{
			id: 'new-task',
			label: 'New task',
			hint: 'Ctrl/Cmd+N or Alt+Shift+N',
			run: openAddTask
		},
		{
			id: 'log-time',
			label: 'Log time',
			hint: 'Ctrl/Cmd+Shift+T',
			run: openLogTime
		},
			{
				id: 'go-today',
				label: 'Go to Today',
				hint: 'Ctrl/Cmd+1',
				run: () => navigateTo('/today-bases')
			},
			{
				id: 'go-calendar',
				label: 'Go to Calendar',
				hint: 'Ctrl/Cmd+2',
				run: () => navigateTo('/calendar')
			},
			{
				id: 'go-reports',
				label: 'Go to Reports',
				hint: 'Ctrl/Cmd+3',
				run: () => navigateTo('/reports')
			},
			{
				id: 'go-settings',
				label: 'Go to Settings',
				hint: 'Ctrl/Cmd+4',
				run: () => navigateTo('/settings')
			},
			{
				id: 'show-shortcuts',
				label: 'Keyboard shortcuts',
				hint: '?',
				run: openShortcutsHelp
			}
		];

	const filteredCommandPaletteActions = $derived.by(() => {
		const query = commandQuery.trim().toLowerCase();
		if (!query) return commandPaletteActions;
		return commandPaletteActions.filter((action) =>
			action.label.toLowerCase().includes(query)
		);
	});

	function runCommandPaletteAction(action: CommandPaletteAction) {
		if (action.id === 'show-shortcuts') {
			openShortcutsHelp();
			return;
		}
		modalMode = null;
		action.run();
	}

	const shortcutCommands: ShortcutCommand[] = [
		{
			id: 'new-task',
			description: 'Open add task',
			combo: shortcutCombos.newTask,
			scope: 'page',
			run: openAddTask
		},
		{
			id: 'new-task-alt',
			description: 'Open add task (alternate)',
			combo: shortcutCombos.newTaskAlt,
			scope: 'page',
			run: openAddTask
		},
		{
			id: 'log-time',
			description: 'Open log time',
			combo: shortcutCombos.logTime,
			scope: 'page',
			run: openLogTime
		},
		{
			id: 'go-today',
			description: 'Go to Today',
			combo: shortcutCombos.goToday,
			scope: 'page',
			run: () => navigateTo('/today-bases')
		},
		{
			id: 'go-calendar',
			description: 'Go to Calendar',
			combo: shortcutCombos.goCalendar,
			scope: 'page',
			run: () => navigateTo('/calendar')
		},
		{
			id: 'go-reports',
			description: 'Go to Reports',
			combo: shortcutCombos.goReports,
			scope: 'page',
			run: () => navigateTo('/reports')
		},
		{
			id: 'go-habits',
			description: 'Go to Habits',
			combo: shortcutCombos.goHabits,
			scope: 'page',
			run: () => navigateTo('/habits')
		},
		{
			id: 'go-settings',
			description: 'Go to Settings',
			combo: shortcutCombos.goSettings,
			scope: 'page',
			run: () => navigateTo('/settings')
		},
		{
			id: 'open-command-palette',
			description: 'Open command palette',
			combo: shortcutCombos.openCommandPalette,
			scope: 'page',
			run: openCommandPalette
		},
		{
			id: 'open-command-palette-alt',
			description: 'Open command palette (alternate)',
			combo: shortcutCombos.openCommandPaletteAlt,
			scope: 'page',
			run: openCommandPalette
		},
		{
			id: 'open-command-palette-alt-secondary',
			description: 'Open command palette (alternate)',
			combo: shortcutCombos.openCommandPaletteAltSecondary,
			scope: 'page',
			run: openCommandPalette
		},
		{
			id: 'show-shortcuts-help',
			description: 'Show keyboard shortcuts',
			combo: shortcutCombos.showShortcutHelp,
			scope: 'page',
			run: openShortcutsHelp
		},
		{
			id: 'show-shortcuts-help-alt',
			description: 'Show keyboard shortcuts (alternate)',
			combo: shortcutCombos.showShortcutHelpAlt,
			scope: 'page',
			run: openShortcutsHelp
		},
		{
			id: 'close-overlay',
			description: 'Close overlay',
			combo: shortcutCombos.closeOverlay,
			scope: 'global',
			allowInInput: true,
			run: closeLayoutLayer
		}
	];

	function getShortcutTargetSummary(target: EventTarget | null): string {
		if (!(target instanceof HTMLElement)) return String(target);
		const parts = [target.tagName.toLowerCase()];
		if (target.id) parts.push(`#${target.id}`);
		if (target.classList.length > 0) parts.push(`.${Array.from(target.classList).join('.')}`);
		return parts.join('');
	}

	function logShortcutDebug(
		event: KeyboardEvent,
		stage: string,
		extra: Record<string, unknown> = {}
	) {
		if (!shortcutDebugEnabled) return;
		const mods = [
			event.ctrlKey ? 'Ctrl' : null,
			event.metaKey ? 'Meta' : null,
			event.altKey ? 'Alt' : null,
			event.shiftKey ? 'Shift' : null
		]
			.filter(Boolean)
			.join('+');
		const commandIdValue =
			typeof extra.commandId === 'string' ? extra.commandId : '';
		const scopeValue = typeof extra.scope === 'string' ? extra.scope : '';
		const targetSummary = getShortcutTargetSummary(event.target);
		const editableTarget = isEditableTarget(event.target);
		const time = new Date().toLocaleTimeString();

		console.debug('[shortcut-debug]', {
			stage,
			key: event.key,
			code: event.code,
			ctrl: event.ctrlKey,
			meta: event.metaKey,
			alt: event.altKey,
			shift: event.shiftKey,
			repeat: event.repeat,
			target: targetSummary,
			editableTarget,
			...extra
		});

		const entry: ShortcutDebugEntry = {
			id: shortcutDebugNextId++,
			time,
			stage,
			key: event.key,
			code: event.code,
			mods: mods || '-',
			scope: scopeValue || '-',
			target: targetSummary,
			editableTarget,
			commandId: commandIdValue || '-'
		};
		const nextEntries = [...shortcutDebugEntries, entry];
		shortcutDebugEntries = nextEntries.length > 80 ? nextEntries.slice(-80) : nextEntries;
	}

	function logShortcutSystemEvent(stage: string, commandId: string) {
		if (!shortcutDebugEnabled) return;
		const entry: ShortcutDebugEntry = {
			id: shortcutDebugNextId++,
			time: new Date().toLocaleTimeString(),
			stage,
			key: '-',
			code: '-',
			mods: 'native',
			scope: getCurrentShortcutScope(),
			target: 'tauri-event',
			editableTarget: false,
			commandId
		};
		const nextEntries = [...shortcutDebugEntries, entry];
		shortcutDebugEntries = nextEntries.length > 80 ? nextEntries.slice(-80) : nextEntries;
	}

	function onGlobalShortcutKeydown(event: KeyboardEvent) {
		logShortcutDebug(event, 'raw-keydown');
	}

	function onGlobalShortcutKeyup(event: KeyboardEvent) {
		logShortcutDebug(event, 'raw-keyup');
		try {
			if (event.repeat) {
				logShortcutDebug(event, 'ignored-repeat');
				return;
			}
			if (isEditableTarget(event.target)) {
				logShortcutDebug(event, 'ignored-editable');
				return;
			}

			const normalizedKey = event.key.toLowerCase();
			const modifierOnlyKey =
				normalizedKey === 'control' ||
				normalizedKey === 'meta' ||
				normalizedKey === 'alt' ||
				normalizedKey === 'shift';
			if (modifierOnlyKey) {
				logShortcutDebug(event, 'ignored-modifier-keyup');
				return;
			}

			const currentScope = getCurrentShortcutScope();
			logShortcutDebug(event, 'received', {
				scope: currentScope,
				modalMode,
				sidebarOpen,
				pathname: $page.url.pathname
			});

			const command = resolveShortcutCommand(
				shortcutCommands,
				event,
				currentScope,
				shortcutIsMac
			);
			if (!command) {
				logShortcutDebug(event, 'no-command', { scope: currentScope });
				return;
			}

			logShortcutDebug(event, 'matched', {
				commandId: command.id,
				commandScope: command.scope
			});

			const handled = command.run();
			if (command.id === 'close-overlay') {
				if (handled === true) {
					event.preventDefault();
				}
				logShortcutDebug(event, 'close-overlay', { handled: handled === true });
				return;
			}

			event.preventDefault();
			logShortcutDebug(event, 'prevented-default', { commandId: command.id });
		} catch (error) {
			console.error('[shortcut-debug] keyup handler error', error);
		}
	}

	function onShortcutAddTaskEvent(_event: Event) {
		logShortcutSystemEvent('native-event', 'open-add-task');
		openAddTask();
	}

	function onShortcutLogTimeEvent(event: Event) {
		logShortcutSystemEvent('native-event', 'open-log-time');
		const shortcutEvent = event as CustomEvent<{ taskId?: string | null }>;
		openLogTimeForTask(shortcutEvent.detail?.taskId ?? null);
	}

	function runShortcutSelfTest() {
		const syntheticEvent = new KeyboardEvent('keyup', {
			key: 'x',
			code: 'KeyX',
			ctrlKey: true,
			bubbles: true,
			cancelable: true
		});
		window.dispatchEvent(syntheticEvent);
	}

	function bindMediaQueryChange(
		mediaQuery: MediaQueryList,
		handler: (event: MediaQueryListEvent) => void
	): () => void {
		if (
			typeof mediaQuery.addEventListener === 'function' &&
			typeof mediaQuery.removeEventListener === 'function'
		) {
			mediaQuery.addEventListener('change', handler);
			return () => mediaQuery.removeEventListener('change', handler);
		}

		const legacyHandler = handler as (this: MediaQueryList, ev: MediaQueryListEvent) => void;
		mediaQuery.addListener(legacyHandler);
		return () => mediaQuery.removeListener(legacyHandler);
	}

	$effect(() => {
		if (modalMode === 'command' && typeof window !== 'undefined') {
			window.requestAnimationFrame(() => commandInput?.focus());
		}
	});

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

	async function handleLogTime() {
		if (!timeTaskId || timeMinutes <= 0) return;

		const dateStr = formatLocalDate(timeDate);
		await logMarkdownTime(timeTaskId, dateStr, timeMinutes);
		lastLogTimeTaskId = timeTaskId;

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
		const cleanupMediaListeners: Array<() => void> = [];
		let unlistenTauriAddTask: null | (() => void) = null;
		let unlistenTauriLogTime: null | (() => void) = null;
		shortcutIsMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
		tauriInvokeAvailable = false;
		const tauriReadyPromise = waitForTauriReady({ maxAttempts: 0, delayMs: 200 }).then((ready) => {
			if (!ready) return false;
			tauriInvokeAvailable = true;
			logShortcutSystemEvent('tauri-ready', 'invoke-ok');
			void import('@tauri-apps/api/event')
				.then(async ({ listen }) => {
					const unlistenAddTask = await listen('daylight:shortcut:add-task', () =>
						onShortcutAddTaskEvent(new Event('daylight:shortcut:add-task'))
					);
					const unlistenLogTime = await listen('daylight:shortcut:log-time', () =>
						onShortcutLogTimeEvent(new CustomEvent('daylight:shortcut:log-time'))
					);
					unlistenTauriAddTask = unlistenAddTask;
					unlistenTauriLogTime = unlistenLogTime;
					logShortcutSystemEvent('tauri-listener', 'attached');
				})
				.catch(() => {});
			return true;
		});

			try {
				const params = new URLSearchParams(window.location.search);
				const queryDebug = params.get('debugShortcuts');
				if (queryDebug === '1') {
					localStorage.setItem('daylight-shortcuts-debug', '1');
				} else if (queryDebug === '0') {
					localStorage.removeItem('daylight-shortcuts-debug');
				}
				const storedShortcutDebug = localStorage.getItem('daylight-shortcuts-debug');
				if (storedShortcutDebug === '1') {
					shortcutDebugEnabled = true;
				} else if (storedShortcutDebug === '0') {
					shortcutDebugEnabled = false;
				}
			} catch {
				shortcutDebugEnabled = import.meta.env.DEV;
			}

		window.addEventListener('daylight:shortcut:add-task', onShortcutAddTaskEvent);
		window.addEventListener('daylight:shortcut:log-time', onShortcutLogTimeEvent as EventListener);
		if (shortcutDebugEnabled) {
			console.info(
				'[shortcut-debug] enabled (disable with localStorage.removeItem("daylight-shortcuts-debug"))'
			);
		}

		// Listen for OS theme changes so "system" preference stays current
		const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
		function onSystemThemeChange() {
			if (themePreference === 'system') {
				const resolved = resolveSystemTheme();
				currentTheme = resolved;
				setThemeAttributes(resolved);
			}
		}
		cleanupMediaListeners.push(bindMediaQueryChange(darkMq, onSystemThemeChange));

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
					const isTauri = await tauriReadyPromise;
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
				for (const cleanupMediaListener of cleanupMediaListeners) {
					cleanupMediaListener();
				}
				window.removeEventListener('daylight:shortcut:add-task', onShortcutAddTaskEvent);
				window.removeEventListener('daylight:shortcut:log-time', onShortcutLogTimeEvent as EventListener);
				if (unlistenTauriAddTask) {
					unlistenTauriAddTask();
				}
			if (unlistenTauriLogTime) {
				unlistenTauriLogTime();
			}
			if (midnightTimer) {
				clearTimeout(midnightTimer);
			}
			import('$lib/services/gtk-theme')
				.then((m) => m.destroyGtkThemeListener())
				.catch(() => {});
		};
	});
	</script>

<svelte:window onkeydown={onGlobalShortcutKeydown} onkeyup={onGlobalShortcutKeyup} />

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
				aria-label={$page.url.pathname === '/habits' ? 'Add habit' : 'Add task'}
				aria-keyshortcuts={newTaskAriaShortcuts}
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
					aria-keyshortcuts={item.ariaKeyShortcuts}
				>
					<Icon width="20" height="20" />
				</a>
			{/each}
	</nav>
</div>

<!-- Add Habit Sheet (shown on /habits route) -->
<AddHabitSheet open={showAddHabit} onclose={() => showAddHabit = false} />

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
					aria-keyshortcuts={logTimeAriaShortcuts}
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
					<option value="">Select a task...</option>
					{#if logTimeTaskOptions.length === 0}
						<option value="" disabled>No tasks in Now</option>
					{/if}
					{#each logTimeTaskOptions as task}
						<option value={task.filename}>{task.title || 'Untitled task'}</option>
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

<!-- Command Palette Sheet -->
<Sheet open={modalMode === 'command'} onclose={closeModal} title="Command Palette">
	<div class="space-y-3">
		<input
			bind:this={commandInput}
			bind:value={commandQuery}
			type="text"
			class="command-search w-full p-3 rounded-lg border"
			placeholder="Type to filter commands..."
			aria-label="Filter commands"
			aria-keyshortcuts={commandPaletteAriaShortcuts}
		/>
		{#if filteredCommandPaletteActions.length > 0}
			<div class="command-list">
				{#each filteredCommandPaletteActions as action}
					<button
						type="button"
						class="command-item w-full"
						onclick={() => runCommandPaletteAction(action)}
					>
						<span>{action.label}</span>
						<kbd class="command-hint">{action.hint}</kbd>
					</button>
				{/each}
			</div>
		{:else}
			<p class="text-sm opacity-70">No matching commands.</p>
		{/if}
	</div>
</Sheet>

<!-- Keyboard Shortcut Help Sheet -->
<Sheet open={modalMode === 'shortcuts'} onclose={closeModal} title="Keyboard Shortcuts">
	<div class="space-y-3">
		<p class="text-sm opacity-70">Desktop shortcuts are available when no text field is focused.</p>
				<ul class="shortcut-list">
					<li><span>New task</span><kbd>Ctrl/Cmd+N or Alt+Shift+N</kbd></li>
					<li><span>Log time</span><kbd>Ctrl/Cmd+Shift+T</kbd></li>
					<li><span>Go to Today</span><kbd>Ctrl/Cmd+1</kbd></li>
					<li><span>Go to Calendar</span><kbd>Ctrl/Cmd+2</kbd></li>
					<li><span>Go to Reports</span><kbd>Ctrl/Cmd+3</kbd></li>
				<li><span>Go to Settings</span><kbd>Ctrl/Cmd+4</kbd></li>
					<li><span>Command palette</span><kbd>Ctrl/Cmd+K, Alt+Shift+K, or Alt+Shift+P</kbd></li>
				<li><span>Shortcuts help</span><kbd>? or Alt+Shift+H</kbd></li>
					<li><span>Close overlay</span><kbd>Esc</kbd></li>
				</ul>
		</div>
</Sheet>

	{#if false && shortcutDebugEnabled}
		<div class="shortcut-build-marker">BUILD {devBuildMarker} | tauriInvoke:{tauriInvokeAvailable ? 'yes' : 'no'}</div>
		<div
			class="shortcut-debug-badge"
			class:ready={tauriInvokeAvailable}
			class:not-ready={!tauriInvokeAvailable}
		>
			DEBUG {tauriInvokeAvailable ? 'ON • TAURI READY' : 'ON • TAURI PENDING'}
		</div>
		<section class="shortcut-debug-panel" aria-label="Shortcut debug panel">
		<div class="shortcut-debug-header">
			<strong>Shortcut Debug</strong>
			<div class="shortcut-debug-actions">
				<button type="button" class="shortcut-debug-clear" onclick={runShortcutSelfTest}>
					Self test
				</button>
				<button type="button" class="shortcut-debug-clear" onclick={() => (shortcutDebugEntries = [])}>
					Clear
				</button>
			</div>
		</div>
		<div class="shortcut-debug-body">
			{#if shortcutDebugEntries.length === 0}
				<div class="shortcut-debug-empty">No events yet.</div>
			{:else}
				{#each shortcutDebugEntries as entry (entry.id)}
					<div class="shortcut-debug-row">
						<code>{entry.time}</code>
						<code>{entry.stage}</code>
						<code>{entry.mods} {entry.key} ({entry.code})</code>
						<code>scope:{entry.scope}</code>
						<code>cmd:{entry.commandId}</code>
						<code>{entry.editableTarget ? 'editable' : 'non-editable'}</code>
					</div>
				{/each}
			{/if}
		</div>
	</section>
{/if}

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

	.command-search {
		background-color: rgb(var(--color-surface-100));
		border-color: rgb(var(--color-surface-300));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .command-search {
		background-color: rgb(var(--color-hover-bg-strong));
		border-color: rgb(var(--color-surface-600));
	}

	.command-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.command-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.625rem 0.75rem;
		border: none;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-hover-bg));
		color: rgb(var(--body-text-color));
		cursor: pointer;
		text-align: left;
	}

	.command-item:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .command-item {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	:global([data-mode='dark']) .command-item:hover {
		background-color: rgb(var(--color-surface-600));
	}

	.command-hint {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
		border-radius: 0.375rem;
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--color-surface-700));
	}

	:global([data-mode='dark']) .command-hint {
		background-color: rgb(var(--color-surface-600));
		color: rgb(var(--color-surface-100));
	}

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
		padding: 0.5rem 0.625rem;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-hover-bg));
	}

	:global([data-mode='dark']) .shortcut-list li {
		background-color: rgb(var(--color-hover-bg-strong));
	}

	.shortcut-debug-panel {
		position: fixed;
		left: 0.75rem;
		right: 0.75rem;
		bottom: 2.5rem;
		z-index: 1000;
		max-height: min(42vh, 360px);
		border-radius: 0.5rem;
		background-color: rgb(var(--color-surface-100));
		border: 1px solid rgb(var(--color-surface-300));
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	:global([data-mode='dark']) .shortcut-debug-panel {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
	}

	.shortcut-debug-badge {
		position: fixed;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 1001;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: white;
	}

	.shortcut-debug-badge.not-ready {
		background: #dc2626;
	}

	.shortcut-debug-badge.ready {
		background: #16a34a;
	}

	.shortcut-build-marker {
		position: fixed;
		top: 0.75rem;
		left: 0.75rem;
		z-index: 1001;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		color: #111827;
		background: #f59e0b;
	}

	.shortcut-debug-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.5rem;
		border-bottom: 1px solid rgb(var(--color-surface-300));
		font-size: 0.75rem;
	}

	:global([data-mode='dark']) .shortcut-debug-header {
		border-bottom-color: rgb(var(--color-surface-600));
	}

	.shortcut-debug-clear {
		border: none;
		background: transparent;
		color: inherit;
		font-size: 0.75rem;
		cursor: pointer;
		opacity: 0.8;
	}

	.shortcut-debug-actions {
		display: flex;
		gap: 0.5rem;
	}

	.shortcut-debug-body {
		overflow: auto;
		padding: 0.375rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.shortcut-debug-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		font-size: 0.7rem;
		line-height: 1.2;
	}

	.shortcut-debug-empty {
		font-size: 0.75rem;
		opacity: 0.7;
	}
</style>
