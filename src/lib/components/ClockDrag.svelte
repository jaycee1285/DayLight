<script lang="ts">
	import { formatDuration, snapToIncrement } from '$lib/domain/timeLog';

	interface Props {
		minutes: number;
		onchange?: (minutes: number) => void;
		increment?: number;
	}

	let { minutes = $bindable(0), onchange, increment = 5 }: Props = $props();

	let isDragging = $state(false);
	let rotations = $state(0);
	let lastAngle = $state(0);
	let clockElement: HTMLDivElement | null = $state(null);

	// Convert minutes to angle (0-360 per 60 minutes)
	let displayAngle = $derived((minutes % 60) * 6); // 6 degrees per minute

	function getAngleFromEvent(e: MouseEvent | TouchEvent): number {
		if (!clockElement) return 0;

		const rect = clockElement.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		let clientX: number, clientY: number;
		if ('touches' in e) {
			clientX = e.touches[0].clientX;
			clientY = e.touches[0].clientY;
		} else {
			clientX = e.clientX;
			clientY = e.clientY;
		}

		// Calculate angle from center (0 = 12 o'clock, clockwise positive)
		const dx = clientX - centerX;
		const dy = clientY - centerY;
		let angle = Math.atan2(dx, -dy) * (180 / Math.PI);
		if (angle < 0) angle += 360;

		return angle;
	}

	function handlePointerDown(e: MouseEvent | TouchEvent) {
		e.preventDefault();
		isDragging = true;
		lastAngle = getAngleFromEvent(e);

		// Calculate current rotations from minutes
		rotations = Math.floor(minutes / 60);
	}

	function handlePointerMove(e: MouseEvent | TouchEvent) {
		if (!isDragging) return;
		e.preventDefault();

		const currentAngle = getAngleFromEvent(e);

		// Detect crossing the 0/360 boundary
		const angleDiff = currentAngle - lastAngle;

		if (angleDiff > 180) {
			// Crossed from high to low (counter-clockwise over 0)
			rotations = Math.max(0, rotations - 1);
		} else if (angleDiff < -180) {
			// Crossed from low to high (clockwise over 0)
			rotations += 1;
		}

		// Calculate total minutes
		const angleMinutes = (currentAngle / 360) * 60;
		const totalMinutes = rotations * 60 + angleMinutes;
		const snappedMinutes = snapToIncrement(Math.max(0, totalMinutes), increment);

		if (snappedMinutes !== minutes) {
			minutes = snappedMinutes;
			onchange?.(minutes);
		}

		lastAngle = currentAngle;
	}

	function handlePointerUp() {
		isDragging = false;
	}
</script>

<svelte:window
	onmousemove={handlePointerMove}
	onmouseup={handlePointerUp}
	ontouchmove={handlePointerMove}
	ontouchend={handlePointerUp}
/>

<div class="clock-drag-container">
	<!-- Clock face -->
	<div
		bind:this={clockElement}
		class="clock-face"
		onmousedown={handlePointerDown}
		ontouchstart={handlePointerDown}
		role="slider"
		aria-valuenow={minutes}
		aria-valuemin={0}
		aria-valuemax={480}
		aria-label="Duration selector"
		tabindex="0"
	>
		<!-- Hour marks -->
		{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as hour}
			<div
				class="hour-mark"
				style="transform: rotate({hour * 30}deg)"
			>
				<div class="hour-tick"></div>
			</div>
		{/each}

		<!-- Filled arc showing duration -->
		<svg class="duration-arc" viewBox="0 0 100 100">
			<circle
				class="arc-background"
				cx="50"
				cy="50"
				r="40"
				fill="none"
				stroke-width="8"
			/>
			<circle
				class="arc-fill"
				cx="50"
				cy="50"
				r="40"
				fill="none"
				stroke-width="8"
				stroke-dasharray="{(displayAngle / 360) * 251.2} 251.2"
				transform="rotate(-90 50 50)"
			/>
		</svg>

		<!-- Center display -->
		<div class="clock-center">
			<div class="duration-display">{formatDuration(minutes)}</div>
			<div class="duration-hint">{minutes} min</div>
		</div>

		<!-- Hand indicator -->
		<div
			class="clock-hand"
			style="transform: rotate({displayAngle}deg)"
		>
			<div class="hand-dot"></div>
		</div>
	</div>

</div>

<style>
	.clock-drag-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.clock-face {
		position: relative;
		width: 200px;
		height: 200px;
		border-radius: 50%;
		background-color: rgb(var(--color-surface-100));
		border: 2px solid rgb(var(--color-surface-300));
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	:global([data-theme='flexoki-dark']) .clock-face {
		background-color: rgb(var(--color-surface-800));
		border-color: rgb(var(--color-surface-600));
	}

	.clock-face:active {
		cursor: grabbing;
	}

	.hour-mark {
		position: absolute;
		top: 0;
		left: 50%;
		width: 2px;
		height: 50%;
		transform-origin: bottom center;
	}

	.hour-tick {
		width: 2px;
		height: 8px;
		background-color: rgb(var(--color-surface-400));
		margin: 8px auto 0;
	}

	.duration-arc {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}

	.arc-background {
		stroke: rgb(var(--color-surface-200));
	}

	:global([data-theme='flexoki-dark']) .arc-background {
		stroke: rgb(var(--color-surface-700));
	}

	.arc-fill {
		stroke: rgb(var(--color-primary-500));
		transition: stroke-dasharray 0.1s ease-out;
	}

	.clock-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		pointer-events: none;
	}

	.duration-display {
		font-size: 1.5rem;
		font-weight: 700;
		color: rgb(var(--color-primary-500));
	}

	.duration-hint {
		font-size: 0.75rem;
		opacity: 0.6;
	}

	.clock-hand {
		position: absolute;
		top: 10%;
		left: 50%;
		width: 2px;
		height: 40%;
		transform-origin: bottom center;
		pointer-events: none;
	}

	.hand-dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background-color: rgb(var(--color-primary-500));
		margin-left: -7px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}
</style>
