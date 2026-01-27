<script lang="ts">
	import { store, setCalendarCache, setMeta, updateMeta } from '$lib/stores/app.svelte';
	import { goto } from '$app/navigation';
	import {
		exportDataBundle,
		getDataPath,
		saveMeta,
		setDataPathOverride,
		copyDataToFolder,
		validateDataFolder
	} from '$lib/storage/storage';
	import { createGoogleCalendarSettings } from '$lib/domain/meta';
	import { refreshCalendarCache } from '$lib/calendar/refresh';
	import { buildAuthUrl, exchangeCodeForToken } from '$lib/calendar/google';

	function handleScanConflicts() {
		goto('/conflicts');
	}

	let calendarStatus = $state<'idle' | 'refreshing' | 'error'>('idle');
	let calendarError = $state<string | null>(null);
	let tauriDiagResult = $state<string | null>(null);
	let exportStatus = $state<'idle' | 'exporting' | 'done' | 'error'>('idle');
	let lastExportPath = $state<string | null>(null);
	let dataPath = $state<string | null>(null);
	let dataPathInput = $state('');
	let dataPathStatus = $state<'idle' | 'saving' | 'error' | 'copied'>('idle');
	let dataPathError = $state<string | null>(null);
	let authStatus = $state<'idle' | 'authorizing' | 'error' | 'done'>('idle');
	const calendarFeatureEnabled = true;
	let isTauri = $state(false);
	let isMobile = $state(false);
	let selectedTheme = $state('flexoki-light');
	let initialized = $state(false);
	let hasStoragePermission = $state(true); // Assume true on non-Android

	const themeOptions = [
		{ value: 'flexoki-light', label: 'Flexoki Light' },
		{ value: 'flexoki-dark', label: 'Flexoki Dark' },
		{ value: 'ayu-light', label: 'Ayu Light' },
		{ value: 'ayu-dark', label: 'Ayu Dark' }
	];

	function getCalendarSettings() {
		return store.meta.googleCalendar ?? createGoogleCalendarSettings();
	}

	function getIcsSources() {
		return store.meta.icsSources ?? { publicUrl: null, secretUrl: null, lastRefresh: null };
	}

	function hasIcsUrls() {
		const sources = getIcsSources();
		return Boolean(sources.publicUrl || sources.secretUrl);
	}

	function canRefreshCalendar() {
		const settings = getCalendarSettings();
		return (
			calendarFeatureEnabled &&
			(hasIcsUrls() || (settings.enabled && settings.calendarId))
		);
	}

	function checkStoragePermission() {
		if (isMobile) {
			const permHelper = (window as Window & { AndroidStoragePermission?: { hasAllFilesAccess: () => boolean } }).AndroidStoragePermission;
			if (permHelper) {
				hasStoragePermission = permHelper.hasAllFilesAccess();
			}
		}
	}

	function requestStoragePermission() {
		const permHelper = (window as Window & { AndroidStoragePermission?: { requestAllFilesAccess: () => void } }).AndroidStoragePermission;
		if (permHelper) {
			permHelper.requestAllFilesAccess();
		}
	}

	$effect(() => {
		if (initialized) return;
		initialized = true;

		// Detect Tauri environment
		isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
		isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

		const currentTheme = document.documentElement.getAttribute('data-theme');
		if (currentTheme) {
			selectedTheme = currentTheme;
		}

		// Check storage permission on Android
		checkStoragePermission();

		// Load saved data path
		try {
			const savedPath = localStorage.getItem('spredux-data-path');
			if (savedPath) {
				dataPathInput = savedPath;
				// Apply the saved path override on load
				setDataPathOverride(savedPath);
			}
		} catch {
			// Ignore storage errors.
		}

		// Get current data path
		if (isTauri) {
			getDataPath().then((path) => {
				dataPath = path;
			}).catch(() => {
				dataPath = isMobile ? '/storage/emulated/0/Download/TaskNotes' : null;
			});
		} else {
			dataPath = isMobile ? '/storage/emulated/0/Download/TaskNotes' : '~/.local/share/SPRedux';
		}
	});

	function handleThemeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		selectedTheme = target.value;
		document.documentElement.setAttribute('data-theme', target.value);
		try {
			localStorage.setItem('spredux-theme', target.value);
		} catch {
			// Ignore theme persistence errors.
		}
	}

	async function persistMeta(updatedMeta: typeof store.meta) {
		updateMeta(updatedMeta);
		if (isTauri) {
			await saveMeta(updatedMeta);
		}
	}

	async function handleRefreshCalendar() {
		if (!canRefreshCalendar()) return;

		calendarStatus = 'refreshing';
		calendarError = null;
		try {
			const result = await refreshCalendarCache(store.meta, store.calendarCache, {
				persist: isTauri
			});
			setMeta(result.meta);
			setCalendarCache(result.cache);
			calendarStatus = 'idle';
		} catch (err) {
			calendarStatus = 'error';
			calendarError = err instanceof Error ? err.message : 'Unknown error';
			console.error('[Calendar] Refresh failed:', err);
		}
	}

	async function handleRefreshIntervalChange(event: Event) {
		if (!calendarFeatureEnabled) return;
		const target = event.target as HTMLSelectElement;
		const hours = Number.parseInt(target.value, 10);
		const settings = getCalendarSettings();
		const updatedMeta = {
			...store.meta,
			googleCalendar: {
				...settings,
				refreshIntervalHours: hours
			}
		};
		await persistMeta(updatedMeta);
	}

	async function handleStartAuth() {
		const settings = getCalendarSettings();
		if (!calendarFeatureEnabled || !isTauri || !settings.clientId) {
			authStatus = 'error';
			return;
		}

		authStatus = 'authorizing';
		try {
			const { invoke } = await import('@tauri-apps/api/core');
			const { open } = await import('@tauri-apps/plugin-shell');
			const port = await invoke<number>('start_oauth_listener');
			const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
			const url = buildAuthUrl(settings.clientId, redirectUri);
			await open(url);
			const code = await invoke<string>('await_oauth_code', { timeoutMs: 120_000 });
			const token = await exchangeCodeForToken(
				settings.clientId,
				settings.clientSecret,
				code,
				redirectUri
			);
			const updatedMeta = {
				...store.meta,
				googleCalendar: {
					...settings,
					enabled: true,
					accessToken: token.accessToken,
					refreshToken: token.refreshToken ?? settings.refreshToken,
					tokenExpiresAt: token.expiresAt
				}
			};
			updateMeta(updatedMeta);
			await saveMeta(updatedMeta);
			authStatus = 'done';
		} catch {
			authStatus = 'error';
		}
	}

	async function runTauriDiagnostics() {
		const results: string[] = [];
		const hasTauri = typeof window !== 'undefined' && '__TAURI__' in window;
		results.push(`__TAURI__ in window: ${hasTauri}`);

		if (hasTauri) {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				results.push('invoke imported: yes');
				try {
					// Test fetch_url with a simple endpoint
					const testResult = await invoke<string>('fetch_url', { url: 'https://httpbin.org/robots.txt' });
					results.push(`fetch_url works: yes (got ${testResult.length} bytes)`);
				} catch (err) {
					results.push(`fetch_url works: NO - ${err}`);
				}
			} catch (err) {
				results.push(`invoke import failed: ${err}`);
			}
		}

		tauriDiagResult = results.join('\n');
	}

	async function handleDisconnectCalendar() {
		if (!calendarFeatureEnabled || !isTauri) return;
		const settings = getCalendarSettings();
		const updatedMeta = {
			...store.meta,
			googleCalendar: {
				...settings,
				enabled: false,
				accessToken: null,
				refreshToken: null,
				tokenExpiresAt: null
			}
		};
		await persistMeta(updatedMeta);
	}

	async function handleOpenDataFolder() {
		if (!isTauri) return;
		const path = dataPath ?? (await getDataPath());
		dataPath = path;
		const { open } = await import('@tauri-apps/plugin-shell');
		await open(path);
	}

	async function handleBrowseFolder() {
		if (!isTauri) {
			dataPathError = 'File picker requires Tauri (desktop/mobile app)';
			return;
		}
		dataPathError = null;
		try {
			if (isMobile) {
				// Use custom Android directory picker via JavaScript interface
				const picker = (window as Window & { AndroidDirectoryPicker?: { pickDirectory: () => void } }).AndroidDirectoryPicker;
				if (picker) {
					console.log('[Settings] Opening Android directory picker...');
					const selected = await new Promise<string | null>((resolve) => {
						// Set up the callback for when the picker returns
						(window as Window & { __DIRECTORY_PICKER_RESOLVE__?: (path: string | null) => void }).__DIRECTORY_PICKER_RESOLVE__ = (path) => {
							console.log('[Settings] Android picker returned:', path);
							resolve(path);
						};
						picker.pickDirectory();
					});
					if (selected) {
						dataPathInput = selected;
						console.log('[Settings] Selected folder:', selected);
					}
				} else {
					console.warn('[Settings] AndroidDirectoryPicker not available, using fallback path');
					// Fallback: pre-fill with common Syncthing path
					dataPathInput = '/storage/emulated/0/Syncthing/TaskNotes';
					dataPathError = 'Directory picker not available. Enter path manually.';
				}
			} else {
				// Use dialog plugin on desktop (Linux/Windows/macOS)
				console.log('[Settings] Opening desktop directory picker...');
				const { open } = await import('@tauri-apps/plugin-dialog');
				const selected = await open({
					directory: true,
					multiple: false,
					title: 'Select Data Folder'
				});
				console.log('[Settings] Desktop picker returned:', selected);
				if (selected && typeof selected === 'string') {
					dataPathInput = selected;
				}
			}
		} catch (err) {
			console.error('[Settings] Folder picker failed:', err);
			dataPathError = err instanceof Error ? err.message : 'Could not open folder picker';
		}
	}

	async function handleSetDataFolder() {
		const trimmed = dataPathInput.trim();
		if (!trimmed) return;
		if (!isTauri) return;
		dataPathStatus = 'saving';
		dataPathError = null;
		const validation = await validateDataFolder(trimmed);
		if (!validation.ok) {
			dataPathStatus = 'error';
			dataPathError = validation.message ?? 'Invalid folder.';
			return;
		}

		// Warn if no Tasks subdirectory exists (for markdown storage)
		if (!validation.hasTasksDir) {
			console.log('[Settings] No Tasks subdirectory found, will be created on first save');
		}

		setDataPathOverride(trimmed);
		try {
			localStorage.setItem('spredux-data-path', trimmed);
		} catch {
			// Ignore storage errors.
		}
		const updatedMeta = {
			...store.meta,
			dataPath: trimmed
		};
		await persistMeta(updatedMeta);
		dataPath = trimmed;
		dataPathStatus = 'idle';
		console.log('[Settings] Data folder set to:', trimmed);
	}

	async function handleCopyDataFolder() {
		const trimmed = dataPathInput.trim();
		if (!trimmed) return;
		if (!isTauri) return;
		dataPathStatus = 'saving';
		dataPathError = null;
		const validation = await validateDataFolder(trimmed);
		if (!validation.ok) {
			dataPathStatus = 'error';
			dataPathError = validation.message ?? 'Invalid folder.';
			return;
		}
		await copyDataToFolder(trimmed);
		setDataPathOverride(trimmed);
		try {
			localStorage.setItem('spredux-data-path', trimmed);
		} catch {
			// Ignore storage errors.
		}
		const updatedMeta = {
			...store.meta,
			dataPath: trimmed
		};
		await persistMeta(updatedMeta);
		dataPath = trimmed;
		dataPathStatus = 'copied';
	}

	async function handleResetDataFolder() {
		setDataPathOverride(null);
		try {
			localStorage.removeItem('spredux-data-path');
		} catch {
			// Ignore storage errors.
		}
		const updatedMeta = {
			...store.meta,
			dataPath: null
		};
		await persistMeta(updatedMeta);
		if (isTauri) {
			dataPath = await getDataPath();
		}
		dataPathStatus = 'idle';
		dataPathError = null;
	}

	async function handleExportData() {
		exportStatus = 'exporting';
		try {
		if (!isTauri) throw new Error('Not supported');
		const result = await exportDataBundle();
			lastExportPath = result.exportPath;
			exportStatus = 'done';
		} catch {
			exportStatus = 'error';
		}
	}
</script>

<main class="p-4">
	<h1 class="text-2xl font-bold mb-4">Settings</h1>

	<!-- Data Summary -->
	<section class="settings-section mb-6">
		<h2 class="text-lg font-semibold mb-3">Data Summary</h2>
		<div class="settings-card p-4 rounded-lg space-y-2">
			<div class="flex justify-between">
				<span class="opacity-70">Tasks</span>
				<span>{store.tasks.filter(t => !t.isSeriesTemplate).length}</span>
			</div>
			<div class="flex justify-between">
				<span class="opacity-70">Time Entries</span>
				<span>{store.timeLogs.length}</span>
			</div>
			<div class="flex justify-between">
				<span class="opacity-70">Tags</span>
				<span>{store.allTags.length}</span>
			</div>
			<div class="flex justify-between">
				<span class="opacity-70">Projects</span>
				<span>{store.allProjects.length}</span>
			</div>
		</div>
	</section>

	{#if store.loadErrors.length > 0}
		<section class="settings-section mb-6">
			<h2 class="text-lg font-semibold mb-3">Data Health</h2>
			<div class="settings-card p-4 rounded-lg space-y-3">
				<p class="text-sm opacity-70">
					Some data files were reset due to invalid JSON. Backups were archived in
					<code class="code-inline">conflicts/</code>.
				</p>
				<div class="space-y-2">
					{#each store.loadErrors as error (error.file)}
						<div class="text-sm">
							<div class="font-medium">{error.file}</div>
							<div class="opacity-70">{error.message}</div>
						</div>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<!-- Data Folder -->
	<section class="settings-section mb-6">
		<h2 class="text-lg font-semibold mb-3">Data Storage</h2>
		<div class="settings-card p-4 rounded-lg">
			{#if isMobile && !hasStoragePermission}
				<div class="mb-4 p-3 rounded-lg bg-warning-100 text-warning-800">
					<p class="font-medium mb-2">Storage Permission Required</p>
					<p class="text-sm mb-3">
						To read your Syncthing folder, the app needs "All files access" permission.
					</p>
					<button
						type="button"
						class="settings-btn"
						onclick={requestStoragePermission}
					>
						Grant Permission
					</button>
					<p class="text-xs mt-2 opacity-70">
						After granting, return to this app and tap "Check Again".
					</p>
					<button
						type="button"
						class="settings-btn mt-2"
						onclick={checkStoragePermission}
					>
						Check Again
					</button>
				</div>
			{/if}
			<p class="text-sm opacity-70 mb-2">
				Tasks are stored as markdown files with YAML frontmatter.
				Sync via Syncthing or any file sync tool.
			</p>
			<p class="text-sm mb-2">
				Location:
				<code class="code-inline">{dataPath ?? '~/.local/share/SPRedux'}</code>
			</p>
			<p class="text-xs opacity-60 mb-3">
				Expected structure: <code class="code-inline">[folder]/Tasks/*.md</code>
			</p>
			<div class="mt-3 space-y-2">
				<div class="text-sm">
					<span class="opacity-70 block mb-1">Custom data folder (e.g., ~/Sync/TaskNotes)</span>
					<div class="flex gap-2">
						<input
							class="settings-input flex-1"
							placeholder={isMobile ? '/storage/emulated/0/Syncthing/TaskNotes' : '/home/user/Sync/TaskNotes'}
							bind:value={dataPathInput}
						/>
						<button
							type="button"
							class="settings-btn"
							onclick={handleBrowseFolder}
							disabled={!isTauri}
						>
							Browse
						</button>
					</div>
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="settings-btn"
						onclick={handleSetDataFolder}
						disabled={!isTauri || dataPathStatus === 'saving'}
					>
						Use this folder
					</button>
					<button
						type="button"
						class="settings-btn"
						onclick={handleCopyDataFolder}
						disabled={!isTauri || dataPathStatus === 'saving'}
					>
						Copy data then use
					</button>
					<button type="button" class="settings-btn" onclick={handleResetDataFolder}>
						Reset to default
					</button>
				</div>
				<p class="text-xs opacity-70">
					Point to your TaskNotes folder. A "Tasks" subfolder will be created if needed.
				</p>
				{#if dataPathStatus === 'copied'}
					<p class="text-xs opacity-70">Data copied to new folder.</p>
				{/if}
				{#if dataPathError}
					<p class="text-xs text-red-600">{dataPathError}</p>
				{/if}
			</div>
			<div class="flex flex-wrap gap-2 mt-3">
				<button type="button" class="settings-btn" onclick={handleOpenDataFolder} disabled={!isTauri}>
					Open data folder
				</button>
					<button
						type="button"
						class="settings-btn"
						onclick={handleExportData}
						disabled={!isTauri || exportStatus === 'exporting'}
					>
					{exportStatus === 'exporting' ? 'Exporting…' : 'Export data bundle'}
				</button>
			</div>
			{#if exportStatus === 'done' && lastExportPath}
				<p class="text-xs opacity-70 mt-2">Exported to: {lastExportPath}</p>
			{/if}
			{#if exportStatus === 'error'}
				<p class="text-xs text-red-600 mt-2">Export failed. Try again.</p>
			{/if}
		</div>
	</section>

	<!-- Google Calendar -->
	<section class="settings-section mb-6">
		<h2 class="text-lg font-semibold mb-3">Google Calendar</h2>
		<div class="settings-card p-4 rounded-lg">
			<p class="text-sm opacity-70 mb-3">Read-only integration with Google Calendar.</p>
			{#if !calendarFeatureEnabled}
				<p class="text-xs opacity-70">
					Calendar integration is disabled. Set
					<code class="code-inline">VITE_CALENDAR_ENABLED=true</code> to enable.
				</p>
			{/if}
			<div class="space-y-3">
				<p class="text-xs opacity-70">
					Uses a local loopback redirect on <code class="code-inline">127.0.0.1</code>.
				</p>
				<label class="text-sm">
					<span class="opacity-70 block mb-1">Client ID (optional)</span>
					<input
						class="settings-input w-full"
						placeholder="OAuth client ID"
						value={getCalendarSettings().clientId ?? ''}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const settings = getCalendarSettings();
							const updatedMeta = {
								...store.meta,
								googleCalendar: {
									...settings,
									clientId: target.value || null
								}
							};
							persistMeta(updatedMeta);
						}}
					/>
				</label>
				<label class="text-sm">
					<span class="opacity-70 block mb-1">Client secret (optional)</span>
					<input
						class="settings-input w-full"
						placeholder="OAuth client secret"
						type="password"
						value={getCalendarSettings().clientSecret ?? ''}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const settings = getCalendarSettings();
							const updatedMeta = {
								...store.meta,
								googleCalendar: {
									...settings,
									clientSecret: target.value || null
								}
							};
							persistMeta(updatedMeta);
						}}
					/>
				</label>
				<label class="text-sm">
					<span class="opacity-70 block mb-1">Calendar ID (optional)</span>
					<input
						class="settings-input w-full"
						placeholder="primary"
						value={getCalendarSettings().calendarId ?? ''}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const settings = getCalendarSettings();
							const updatedMeta = {
								...store.meta,
								googleCalendar: {
									...settings,
									calendarId: target.value || null
								}
							};
							persistMeta(updatedMeta);
						}}
					/>
				</label>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="settings-btn"
						disabled={!calendarFeatureEnabled || !isTauri || authStatus === 'authorizing'}
						onclick={handleStartAuth}
					>
						{authStatus === 'authorizing' ? 'Authorizing…' : 'Connect'}
					</button>
					<button
						type="button"
						class="settings-btn"
						disabled={!calendarFeatureEnabled || !getCalendarSettings().enabled}
						onclick={handleDisconnectCalendar}
					>
						Disconnect
					</button>
				</div>
				<label class="text-sm">
					<span class="opacity-70 block mb-1">Public ICS URL</span>
					<input
						class="settings-input w-full"
						placeholder="https://example.com/calendar.ics"
						value={getIcsSources().publicUrl ?? ''}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const sources = getIcsSources();
							const updatedMeta = {
								...store.meta,
								icsSources: {
									...sources,
									publicUrl: target.value || null
								}
							};
							persistMeta(updatedMeta);
						}}
					/>
				</label>
				<label class="text-sm">
					<span class="opacity-70 block mb-1">Secret ICS URL</span>
					<input
						class="settings-input w-full"
						placeholder="https://example.com/secret.ics"
						value={getIcsSources().secretUrl ?? ''}
						oninput={(e) => {
							const target = e.target as HTMLInputElement;
							const sources = getIcsSources();
							const updatedMeta = {
								...store.meta,
								icsSources: {
									...sources,
									secretUrl: target.value || null
								}
							};
							persistMeta(updatedMeta);
						}}
					/>
				</label>
				{#if authStatus === 'error'}
					<div class="text-xs text-red-600">
						Authorization failed{!isTauri ? ' (requires Tauri app)' : ''}.
					</div>
				{/if}
				{#if authStatus === 'done'}
					<div class="text-xs opacity-70">Connected.</div>
				{/if}
				<div class="flex items-center justify-between text-sm">
					<span class="opacity-70">Refresh interval</span>
					<select
						class="settings-select"
						onchange={handleRefreshIntervalChange}
						disabled={!calendarFeatureEnabled || !getCalendarSettings().enabled}
					>
						<option value="6" selected={getCalendarSettings().refreshIntervalHours === 6}>
							Every 6 hours
						</option>
						<option value="12" selected={getCalendarSettings().refreshIntervalHours === 12}>
							Every 12 hours
						</option>
					</select>
				</div>
				<div class="flex items-center justify-between text-sm">
					<span class="opacity-70">Last refresh</span>
					<span>{getCalendarSettings().lastRefresh ?? getIcsSources().lastRefresh ?? 'Never'}</span>
				</div>
				<button
					type="button"
					class="settings-btn"
					disabled={!canRefreshCalendar() || calendarStatus === 'refreshing'}
					onclick={handleRefreshCalendar}
				>
					{calendarStatus === 'refreshing' ? 'Refreshing…' : 'Refresh now'}
				</button>
				{#if calendarStatus === 'error'}
					<div class="text-xs text-red-600">
						Refresh failed{calendarError ? `: ${calendarError}` : '.'}
					</div>
				{/if}
				<button
					type="button"
					class="settings-btn mt-2"
					onclick={runTauriDiagnostics}
				>
					Run Tauri Diagnostics
				</button>
				{#if tauriDiagResult}
					<pre class="text-xs mt-2 p-2 rounded bg-surface-200 whitespace-pre-wrap">{tauriDiagResult}</pre>
				{/if}
			</div>
		</div>
	</section>

	<!-- Conflicts -->
	<section class="settings-section mb-6">
		<h2 class="text-lg font-semibold mb-3">Sync Conflicts</h2>
		<div class="settings-card p-4 rounded-lg">
			<p class="text-sm opacity-70 mb-3">Scan for and resolve Syncthing conflicts.</p>
			<button type="button" class="settings-btn" onclick={handleScanConflicts}>
				View Conflicts
			</button>
		</div>
	</section>

	<!-- Theme -->
	<section class="settings-section mb-6">
		<h2 class="text-lg font-semibold mb-3">Theme</h2>
		<div class="settings-card p-4 rounded-lg">
			<p class="text-sm opacity-70 mb-3">Switch between Flexoki and Ayu themes.</p>
			<select class="settings-select" onchange={handleThemeChange} bind:value={selectedTheme}>
				{#each themeOptions as option}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>
		</div>
	</section>

	<!-- About -->
	<section class="settings-section">
		<h2 class="text-lg font-semibold mb-3">About</h2>
		<div class="settings-card p-4 rounded-lg">
			<p class="font-semibold">SPRedux</p>
			<p class="text-sm opacity-70">Tasks + Calendar + Time Logging</p>
			<p class="text-sm opacity-70 mt-2">Version 0.1.0</p>
		</div>
	</section>
</main>

<style>
	.settings-card {
		background-color: rgb(var(--color-surface-100));
	}

	:global([data-theme='flexoki-dark']) .settings-card,
	:global([data-theme='ayu-dark']) .settings-card {
		background-color: rgb(var(--color-surface-800));
	}

	.settings-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background-color: rgb(var(--color-primary-500));
		color: white;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.settings-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.settings-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.settings-input {
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		color: rgb(var(--body-text-color));
	}

	:global([data-theme='flexoki-dark']) .settings-input,
	:global([data-theme='ayu-dark']) .settings-input {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
		color: rgb(var(--body-text-color));
	}

	.settings-select {
		background-color: rgb(var(--color-surface-50));
		border: 1px solid rgb(var(--color-surface-300));
		border-radius: 0.5rem;
		padding: 0.25rem 0.5rem;
		color: rgb(var(--body-text-color));
	}

	:global([data-theme='flexoki-dark']) .settings-select,
	:global([data-theme='ayu-dark']) .settings-select {
		background-color: rgb(var(--color-surface-700));
		border-color: rgb(var(--color-surface-600));
		color: rgb(var(--body-text-color));
	}

	.code-inline {
		background-color: rgb(var(--color-surface-200));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: 0.875rem;
	}

	:global([data-theme='flexoki-dark']) .code-inline,
	:global([data-theme='ayu-dark']) .code-inline {
		background-color: rgb(var(--color-surface-700));
	}
</style>
