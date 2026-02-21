import { isTauri } from '@tauri-apps/api/core';

type TauriInvoke = typeof import('@tauri-apps/api/core').invoke;

type TauriRetryOptions = {
	delayMs?: number;
	maxAttempts?: number;
	probeCommand?: string;
};

let cachedInvoke: TauriInvoke | null = null;
let pendingInvoke: Promise<TauriInvoke> | null = null;

export function hasTauriInvoke(): boolean {
	if (typeof window === 'undefined') return false;

	const globalWindow = window as Window & {
		__TAURI_INTERNALS__?: { invoke?: unknown };
		__TAURI__?: { invoke?: unknown };
	};

	if (
		typeof globalWindow.__TAURI_INTERNALS__?.invoke === 'function' ||
		typeof globalWindow.__TAURI__?.invoke === 'function'
	) {
		return true;
	}

	// Tauri v2 may not expose a global invoke function even when runtime is present.
	try {
		return isTauri();
	} catch {
		return false;
	}
}

export function isTauriRuntime(): boolean {
	try {
		return isTauri();
	} catch {
		return false;
	}
}

function wait(delayMs: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function getTauriInvoke(options: TauriRetryOptions = {}): Promise<TauriInvoke> {
	if (typeof window === 'undefined') {
		throw new Error('Tauri invoke is unavailable outside the browser runtime');
	}

	if (cachedInvoke) return cachedInvoke;
	if (pendingInvoke) return pendingInvoke;

	const {
		delayMs = 200,
		maxAttempts = 0,
		probeCommand = 'tauri_ready'
	} = options;

	pendingInvoke = (async () => {
		let attempt = 0;
		let lastError: unknown = null;

		while (maxAttempts <= 0 || attempt < maxAttempts) {
			attempt += 1;
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				await invoke<boolean>(probeCommand);
				cachedInvoke = invoke;
				return invoke;
			} catch (error) {
				lastError = error;
				await wait(delayMs);
			}
		}

		throw new Error(`Tauri invoke not ready after ${attempt} attempts: ${String(lastError)}`);
	})().finally(() => {
		pendingInvoke = null;
	});

	return pendingInvoke;
}

export async function waitForTauriReady(options: TauriRetryOptions = {}): Promise<boolean> {
	try {
		await getTauriInvoke(options);
		return true;
	} catch {
		return false;
	}
}
