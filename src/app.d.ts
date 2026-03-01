// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// unplugin-icons type declarations
declare module '~icons/*' {
	import { SvelteComponent } from 'svelte';
	const component: typeof SvelteComponent;
	export default component;
}

declare module 'pulltorefreshjs' {
	interface PullToRefreshOptions {
		mainElement?: string | Element;
		triggerElement?: string | Element;
		distThreshold?: number;
		distMax?: number;
		instructionsPullToRefresh?: string;
		instructionsReleaseToRefresh?: string;
		instructionsRefreshing?: string;
		onRefresh?: () => void | Promise<void>;
		shouldPullToRefresh?: () => boolean;
		resistanceFunction?: (t: number) => number;
	}
	const PullToRefresh: {
		init(options?: PullToRefreshOptions): void;
		destroyAll(): void;
	};
	export default PullToRefresh;
}

export {};
