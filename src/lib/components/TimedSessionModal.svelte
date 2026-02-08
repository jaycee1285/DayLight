<script lang="ts">
	import type { ViewTask } from '$lib/services/ViewService';
	import { getTodayDate } from '$lib/domain/task';
	import { formatDuration } from '$lib/domain/timeLog';
	import { logTime, markTaskComplete } from '$lib/stores/markdown-store.svelte';
	import ClockDrag from './ClockDrag.svelte';

	import IconPlay from '~icons/lucide/play';
	import IconPause from '~icons/lucide/pause';
	import IconX from '~icons/lucide/x';

	interface Props {
		task: ViewTask;
		open: boolean;
		onclose: () => void;
	}

	let { task, open, onclose }: Props = $props();

	// Session states
	type SessionState = 'select' | 'running' | 'paused' | 'done';
	let sessionState = $state<SessionState>('select');
	let plannedMinutes = $state(25);
	let elapsedSeconds = $state(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Derived values
	const remainingSeconds = $derived(Math.max(0, plannedMinutes * 60 - elapsedSeconds));
	const actualMinutes = $derived(Math.ceil(elapsedSeconds / 60));
	const progressPercent = $derived(
		plannedMinutes > 0 ? Math.min(100, (elapsedSeconds / (plannedMinutes * 60)) * 100) : 0
	);
	const isOvertime = $derived(elapsedSeconds > plannedMinutes * 60);

	// Format MM:SS display
	function formatTime(seconds: number): string {
		const mins = Math.floor(Math.abs(seconds) / 60);
		const secs = Math.abs(seconds) % 60;
		const sign = seconds < 0 ? '-' : '';
		return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}

	// Reset state when modal opens
	$effect(() => {
		if (open) {
			sessionState = 'select';
			plannedMinutes = 25;
			elapsedSeconds = 0;
			stopTimer();
		}
	});

	// Cleanup on unmount
	$effect(() => {
		return () => stopTimer();
	});

	function startTimer() {
		sessionState = 'running';
		intervalId = setInterval(() => {
			elapsedSeconds += 1;
			// Auto-complete when timer finishes (but keep running for overtime tracking)
			if (elapsedSeconds === plannedMinutes * 60) {
				// Could add a notification here in v2
			}
		}, 1000);
	}

	function pauseTimer() {
		sessionState = 'paused';
		stopTimer();
	}

	function resumeTimer() {
		sessionState = 'running';
		intervalId = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
	}

	function stopTimer() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function handleLogNow() {
		stopTimer();
		sessionState = 'done';
	}

	async function handleLogTime() {
		if (actualMinutes > 0) {
			const today = getTodayDate();
			await logTime(task.filename, today, actualMinutes);
		}
		onclose();
	}

	async function handleLogAndComplete() {
		if (actualMinutes > 0) {
			const today = getTodayDate();
			await logTime(task.filename, today, actualMinutes);
			const completionDate = task.instanceDate || today;
			await markTaskComplete(task.filename, completionDate);
		}
		onclose();
	}

	function handleClose() {
		stopTimer();
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && sessionState === 'select') {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="session-backdrop" onclick={(e) => e.target === e.currentTarget && sessionState === 'select' && handleClose()}>
		<div class="session-modal">
			<!-- Header -->
			<div class="session-header">
				<h2 class="session-title">{task.title}</h2>
				{#if sessionState === 'select'}
					<button type="button" class="close-btn" onclick={handleClose} aria-label="Close">
						<IconX width="20" height="20" />
					</button>
				{/if}
			</div>

			<!-- Select Duration State -->
			{#if sessionState === 'select'}
				<div class="session-content">
					<p class="session-label">Set session duration</p>
					<ClockDrag bind:minutes={plannedMinutes} />
					<button
						type="button"
						class="start-btn"
						disabled={plannedMinutes === 0}
						onclick={startTimer}
					>
						<IconPlay width="20" height="20" />
						Start Session
					</button>
				</div>

			<!-- Running/Paused State -->
			{:else if sessionState === 'running' || sessionState === 'paused'}
				<div class="session-content">
					<!-- Countdown Display -->
					<div class="countdown-container">
						<svg class="countdown-ring" viewBox="0 0 100 100">
							<circle
								class="countdown-bg"
								cx="50"
								cy="50"
								r="45"
								fill="none"
								stroke-width="6"
							/>
							<circle
								class="countdown-progress"
								class:overtime={isOvertime}
								cx="50"
								cy="50"
								r="45"
								fill="none"
								stroke-width="6"
								stroke-linecap="round"
								stroke-dasharray="282.7"
								stroke-dashoffset={282.7 - (progressPercent / 100) * 282.7}
								transform="rotate(-90 50 50)"
							/>
						</svg>
						<div class="countdown-text">
							<span class="countdown-time" class:overtime={isOvertime}>
								{#if isOvertime}
									+{formatTime(elapsedSeconds - plannedMinutes * 60)}
								{:else}
									{formatTime(remainingSeconds)}
								{/if}
							</span>
							<span class="countdown-label">
								{#if isOvertime}
									overtime
								{:else if sessionState === 'paused'}
									paused
								{:else}
									remaining
								{/if}
							</span>
						</div>
					</div>

					<!-- Control Buttons -->
					<div class="control-buttons">
						{#if sessionState === 'running'}
							<button type="button" class="control-btn pause-btn" onclick={pauseTimer}>
								<IconPause width="24" height="24" />
							</button>
						{:else}
							<button type="button" class="control-btn resume-btn" onclick={resumeTimer}>
								<IconPlay width="24" height="24" />
							</button>
						{/if}
					</div>

					<button type="button" class="log-now-btn" onclick={handleLogNow}>
						Log Now
					</button>

					<p class="elapsed-info">
						Elapsed: {formatDuration(actualMinutes)}
					</p>
				</div>

			<!-- Done State -->
			{:else if sessionState === 'done'}
				<div class="session-content">
					<div class="done-display">
						<span class="done-label">Session {isOvertime ? 'Complete' : 'Stopped'}</span>
						<span class="done-time">{formatDuration(actualMinutes)}</span>
						<span class="done-sublabel">tracked</span>
					</div>

					<div class="done-buttons">
						<button type="button" class="log-btn" onclick={handleLogTime}>
							Log Time
						</button>
						<button type="button" class="log-complete-btn" onclick={handleLogAndComplete}>
							Log & Complete
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.session-backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background-color: rgb(var(--color-overlay) / 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.session-modal {
		background-color: rgb(var(--color-surface-50));
		border-radius: 1rem;
		width: 100%;
		max-width: 320px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	:global([data-mode='dark']) .session-modal {
		background-color: rgb(var(--color-surface-800));
	}

	.session-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1rem 0.5rem;
		gap: 0.5rem;
	}

	.session-title {
		font-size: 1rem;
		font-weight: 600;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	.close-btn {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.close-btn:hover {
		opacity: 1;
	}

	.session-content {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.session-label {
		font-size: 0.875rem;
		opacity: 0.7;
		margin: 0;
	}

	.start-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.875rem;
		border: none;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s, opacity 0.15s;
	}

	.start-btn:hover:not(:disabled) {
		background-color: rgb(var(--color-primary-600));
	}

	.start-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Countdown Display */
	.countdown-container {
		position: relative;
		width: 200px;
		height: 200px;
	}

	.countdown-ring {
		width: 100%;
		height: 100%;
	}

	.countdown-bg {
		stroke: rgb(var(--color-surface-200));
	}

	:global([data-mode='dark']) .countdown-bg {
		stroke: rgb(var(--color-surface-600));
	}

	.countdown-progress {
		stroke: rgb(var(--color-primary-500));
		transition: stroke-dashoffset 0.5s ease-out;
	}

	.countdown-progress.overtime {
		stroke: rgb(var(--color-warning-500));
	}

	.countdown-text {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.countdown-time {
		font-size: 2.5rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.countdown-time.overtime {
		color: rgb(var(--color-warning-500));
	}

	.countdown-label {
		font-size: 0.875rem;
		opacity: 0.6;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.control-buttons {
		display: flex;
		gap: 1rem;
	}

	.control-btn {
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.1s, background-color 0.15s;
	}

	.control-btn:hover {
		transform: scale(1.05);
	}

	.control-btn:active {
		transform: scale(0.95);
	}

	.pause-btn {
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--body-text-color));
	}

	:global([data-mode='dark']) .pause-btn {
		background-color: rgb(var(--color-surface-600));
	}

	.resume-btn {
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
	}

	.log-now-btn {
		width: 100%;
		padding: 0.75rem;
		border: none;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-surface-200));
		color: rgb(var(--body-text-color));
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	:global([data-mode='dark']) .log-now-btn {
		background-color: rgb(var(--color-surface-600));
	}

	.log-now-btn:hover {
		background-color: rgb(var(--color-surface-300));
	}

	:global([data-mode='dark']) .log-now-btn:hover {
		background-color: rgb(var(--color-surface-500));
	}

	.elapsed-info {
		font-size: 0.875rem;
		opacity: 0.6;
		margin: 0;
	}

	/* Done State */
	.done-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding: 1.5rem 0;
	}

	.done-label {
		font-size: 1rem;
		opacity: 0.7;
	}

	.done-time {
		font-size: 3rem;
		font-weight: 700;
		color: rgb(var(--color-primary-500));
	}

	.done-sublabel {
		font-size: 0.875rem;
		opacity: 0.5;
	}

	.done-buttons {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.log-btn {
		width: 100%;
		padding: 0.875rem;
		border: none;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-primary-500));
		color: rgb(var(--color-on-primary));
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.log-btn:hover {
		background-color: rgb(var(--color-primary-600));
	}

	.log-complete-btn {
		width: 100%;
		padding: 0.875rem;
		border: none;
		border-radius: 0.5rem;
		background-color: rgb(var(--color-tertiary-500));
		color: rgb(var(--color-surface-50));
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.log-complete-btn:hover {
		background-color: rgb(var(--color-tertiary-600));
	}
</style>
