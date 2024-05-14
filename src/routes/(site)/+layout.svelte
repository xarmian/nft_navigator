<script lang="ts">
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import { DarkMode } from 'flowbite-svelte';
	import Icon from '$lib/assets/android-chrome-192x192.png';
	import { Web3Wallet, selectedWallet, setOnAddHandler, setOnAuthHandler } from 'avm-wallet-svelte';
	import { onDestroy, onMount } from 'svelte';
	import CollectionSearch from '$lib/component/ui/Search.svelte';
	import { page } from '$app/stores';
	import { algodClient, algodIndexer } from '$lib/utils/algod';
	import Cookies from 'js-cookie';
	import { invalidateAll } from '$app/navigation';

	let showMenu = false;
	let currentPath = '';
	let extensionRoute = '';
	let extensionRouteLounge = '';

	const unsub = page.subscribe(value => {
		let pathPieces = value.url.pathname.split('/');
		currentPath = pathPieces[1];

		// this is a hack to allow routing from collection page directly to analytics page for the colleciton
		if (currentPath == 'collection') {
			extensionRoute = '/' + pathPieces[1] + '/' + pathPieces[2];
			extensionRouteLounge = '/' + pathPieces[2];
		}
	});

	const unsubWallet = selectedWallet.subscribe((value) => {
        if (value) {
			Cookies.set('avm-wallet', value.address);
		}
		else {
			Cookies.remove('avm-wallet');
		}
    });

	setOnAddHandler(async (wallets) => {
		console.log('Wallet added', wallets);

		const response = await fetch('/api/quests', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				action: 'connect_wallet',
				wallets: wallets,
			}),
		});

		if (!response.ok) {
			console.error('Failed to send wallet data to backend', await response.text());
		}
	});

	setOnAuthHandler((wallet) => {
		console.log('Wallet authenticated', wallet);

		const response = fetch('/api/quests', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				action: 'auth_wallet',
				wallet: wallet,
			}),
		});
		invalidateAll();
	});

	onMount(() => {
		// click outside menu to close
		document.addEventListener('click', (e: MouseEvent) => {
			// @ts-expect-error - closest does exist
			if (showMenu && !e.target?.closest('.absolute')) {
				showMenu = false;
			}
		});

	});

	onDestroy(() => {
		unsub();
		unsubWallet();
		//connectedWalletsUnsub();
	});

	const options = {
  	}
	//import { Footer, FooterCopyright, FooterLinkGroup, FooterBrand, FooterLink } from 'flowbite-svelte';
</script>

<div class="app dark:text-white">
	<header class="h-20 bg-gray-100 dark:bg-gray-800 py-4 px-4 flex flex-col border-b border-b-gray-200 dark:border-b-gray-900 fixed w-full z-50 dark:bg-opacity-50 bg-opacity-50">
		<div class="flex">
			<div class="flex-start">
				<a href="/" class="absolute top-0 left-0 p-4 flex flex-row space-x-2">
					<img src="{Icon}" class="h-12 rounded-2xl" alt="Logo" />
					<div class="flex flex-col justify-center">
						<div class="cursor-pointer text-2xl font-bold content-center font-[fantasy]">NFT Navigator</div>
						<div class="cursor-pointer text-xs content-center font-sans -m-2">on the <a href="https://voi.network" target="_blank" on:click|stopPropagation class="underline text-blue-500 hover:text-blue-600">Voi</a> Network</div>
					</div>
				</a>
			</div>
			<div class="md:flex items-center space-x-2 flex-grow justify-center p-2 hidden">
				<a href="/" class="hover:text-blue-500 {currentPath == '' ? 'text-blue-600' : ''}">Home</a>
				<span class="text-gray-400">|</span>
				<a href="/forsale" class="hover:text-blue-500 {currentPath == 'forsale' ? 'text-blue-600' : ''}">For Sale</a>
				<span class="text-gray-400">|</span>
				<a href="/lounge{extensionRouteLounge}" class="hover:text-blue-500 {currentPath == 'lounge' ? 'text-blue-600' : ''}">Lounge</a>
				<span class="text-gray-400">|</span>
				<a href="/analytics{extensionRoute}" class="hover:text-blue-500 {currentPath == 'analytics' ? 'text-blue-600' : ''}">Analytics</a>
				{#if $selectedWallet}
					<span class="text-gray-400">|</span>
					<a href="/portfolio/{$selectedWallet?.address}" class="hover:text-blue-500 {currentPath == 'portfolio' ? 'text-blue-600' : ''}">
						My Portfolio
					</a>
				{/if}
			</div>
			<div class="flex-grow p-2 md:hidden">&nbsp;</div>
			<div class="absolute top-0 right-0 flex p-4 flex-row space-x-2">
				<div class="hidden md:flex">
					<CollectionSearch />
				</div>
				<div class="hidden md:flex">
					<div class="w-42 flex">
						<Web3Wallet availableWallets={['DeflyWallet','Kibisis','LuteWallet']} showAuthButtons={true} algodClient={algodClient} indexerClient={algodIndexer} walletListClass="bg-gray-100 dark:bg-slate-600 dark:text-gray-200"/>
					</div>
				</div>
				<div class="ml-auto relative content-end flex flex-row">
					<DarkMode />
					<div class="flex flex-row md:hidden">
						<button on:click|stopPropagation={() => showMenu = !showMenu} class="h-10 w-10 rounded-2xl bg-slate-500 flex items-center justify-center mr-2">
							<i class="fas fa-bars cursor-pointer"></i>
						</button>
						{#if showMenu}
							<div class="absolute w-48 top-full right-0 bg-white dark:bg-gray-600 rounded-lg shadow-lg z-50 text-nowrap" on:click|stopPropagation={() => showMenu = false}>
								<ul class="flex flex-col divide-y divide-gray-300 dark:divide-gray-500">
									<a href='/' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer overflow-hidden">Home</a>
									<a href='/forsale' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">For Sale</a>
									<a href='/lounge' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">Lounge</a>
									<a href='/analytics{extensionRoute}' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">Analytics</a>
									{#if $selectedWallet}
										<a href='/portfolio/{$selectedWallet?.address}' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">My Portfolio</a>
									{/if}
								</ul>
								<div on:click|stopPropagation>
									<CollectionSearch />
								</div>
								<Web3Wallet availableWallets={['DeflyWallet','Kibisis','LuteWallet']} showAuthButtons={true} algodClient={algodClient} indexerClient={algodIndexer} walletListClass="bg-gray-100 dark:bg-gray-500"/>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>		
	</header>
	<div class="w-full h-20"></div>
	<main>
		<slot />
	</main>
	<SvelteToast {options} />
<!--	<Footer footerType="logo">
		<div class="sm:flex sm:items-center sm:justify-between">
		  <FooterLinkGroup ulClass="flex flex-wrap items-center mb-6 text-sm text-gray-500 sm:mb-0 dark:text-gray-400">
			<FooterLink href="/what_is_voi">What is Voi?</FooterLink>
			<FooterLink href="/how_to_node">How to Node?</FooterLink>
			<FooterLink href="/about">About</FooterLink>
		  </FooterLinkGroup>
		  <FooterLinkGroup ulClass="flex flex-wrap items-center mb-6 text-sm text-gray-500 sm:mb-0 dark:text-gray-400">
			<FooterLink href="https://twitter.com/xarmian" target="_blank">My Twitter</FooterLink>
			<FooterLink href="https://twitter.com/Voi_Net" target="_blank">Voi Twitter</FooterLink>
			<FooterLink href="https://t.co/mXYdYkWE6i" target="_blank">Voi Discord</FooterLink>
			<FooterLink href="https://github.com/xarmian/voi_rewards_svelte" target="_blank">Source Code</FooterLink>
		  </FooterLinkGroup>
		</div>
		<hr class="my-6 border-gray-200 sm:mx-auto dark:border-gray-700 lg:my-8" />
	 </Footer>-->
</div>