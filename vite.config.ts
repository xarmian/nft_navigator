import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	define: { global: "globalThis", },
	ssr: {
		noExternal: ['three', 'arcpay-sdk', 'algosdk','@txnlab/use-wallet']
	},
	/* optimizeDeps: {
		include: ['avm-wallet-svelte']
	},*/
});
