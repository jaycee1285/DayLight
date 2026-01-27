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

export {};
