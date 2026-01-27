import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		alias: {
			$lib: './src/lib',
			$components: './src/lib/components',
			$domain: './src/lib/domain',
			$stores: './src/lib/stores'
		}
	}
};

export default config;
