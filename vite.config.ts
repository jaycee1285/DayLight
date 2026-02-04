import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		Icons({
			compiler: 'svelte',
			autoInstall: false
		})
	],

	// Tauri expects a fixed port
	server: {
		port: 43181,
		strictPort: true,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},

	// Clear the screen in dev mode
	clearScreen: false,

	// Env prefix for Tauri
	envPrefix: ['VITE_', 'TAURI_']
});
