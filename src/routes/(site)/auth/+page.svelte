<!-- src/routes/+page.svelte -->
<script lang="ts">
	import { Auth } from '@supabase/auth-ui-svelte'
	import { ThemeSupa } from '@supabase/auth-ui-shared'
	import { onMount } from 'svelte';
	import type { Provider } from '@supabase/supabase-js';

	export let data;
	let connectedProviders = data.session?.user.app_metadata.providers ?? [];
	let providers: Provider[] = ['github','google','facebook','twitter','gitlab','bitbucket'];

	const logoutProvider = (provider: string) => async () => {
		const { error } = await data.supabase.auth.signOut({
			scope: 'local',
		});
		if (error) console.error('Error logging out:', error.message);

		// redirect to /
		window.location.href = '/';
	};
</script>

<svelte:head>
	<title>User Management</title>
</svelte:head>

<div class="row flex-center flex">
	<div class="col-6 form-widget">
		{#each providers as provider}
			<div class="flex flex-row">
				<Auth
					supabaseClient={data.supabase}
					providers={[provider]}
					redirectTo={`${data.url}/callback`}
					showLinks={false}
					onlyThirdPartyProviders={true}
					appearance={{ theme: ThemeSupa, style: { input: 'color: #fff' } }}
				>
				</Auth>
				{#if connectedProviders.includes(provider)}
					<button on:click={logoutProvider(provider)}>Disconnect {provider}</button>
				{/if}
			</div>
		{/each}
	</div>
</div>