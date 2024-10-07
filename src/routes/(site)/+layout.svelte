<script lang="ts">
	import { SvelteToast, toast } from '@zerodevx/svelte-toast';
	import { DarkMode } from 'flowbite-svelte';
	import Icon from '$lib/assets/android-chrome-192x192.png';
	import { Web3Wallet, selectedWallet, setOnAddHandler, setOnAuthHandler } from 'avm-wallet-svelte';
	import { onDestroy, onMount } from 'svelte';
	import CollectionSearch from '$lib/component/ui/Search.svelte';
	import { page } from '$app/stores';
	import { algodClient, algodIndexer } from '$lib/utils/algod';
	import Cookies from 'js-cookie';
	import { invalidateAll } from '$app/navigation';
	import { Confetti } from 'svelte-confetti';
	import { showConfetti } from '../../stores/collection';
	import { fly } from 'svelte/transition';
	import { fade } from 'svelte/transition';
	import { slide } from 'svelte/transition';

	let showMenu = false;
	let currentPath = '';
	let extensionRoute = '';
	let extensionRouteLounge = '';
	let showBanner = true;
	let lastScrollY = 0;

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
			invalidateAll();
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
		else {
			const data = await response.json();
			if (data.isFirstAction) {
				showConfetti.set(true);
				toast.push('Congratulations! The Connect Wallet Quest has been Completed!');
				setTimeout(() => showConfetti.set(false), 10000);
			}
		}
	});

	setOnAuthHandler(async (wallet) => {
		console.log('Wallet authenticated', wallet);

		const response = await fetch('/api/quests', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				action: 'auth_wallet',
				wallet: wallet,
			}),
		});

		if (!response.ok) {
			console.error('Failed to send wallet data to backend', await response.text());
		}
		else {
			const data = await response.json();
			if (data.isFirstAction) {
				showConfetti.set(true);
				toast.push('Congratulations! The Authenticate Wallet Quest has been Completed!');
				setTimeout(() => {
					invalidateAll();
					showConfetti.set(false)
				}, 10000);
			}
			else {
				invalidateAll();
			}
		}
	});

	onMount(() => {
		// click outside menu to close
		document.addEventListener('click', (e: MouseEvent) => {
			// @ts-expect-error - closest does exist
			if (showMenu && !e.target?.closest('.absolute')) {
				showMenu = false;
			}
		});

		// Modify the scroll event listener
		const handleScroll = () => {
			const currentScrollY = window.scrollY;
			if (currentScrollY > lastScrollY && currentScrollY > 10) {
				showBanner = false;
				window.removeEventListener('scroll', handleScroll);
			}
		};

		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
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

<div class="app dark:text-white min-h-screen flex flex-col">
	<div class="fixed w-full z-10">
		{#if showBanner}
			<div transition:slide="{{ duration: 300, axis: 'y' }}" class="bg-blue-500 text-white text-center py-2 text-sm font-medium">
				You are connected to Voi MainNet. Please use caution.
			</div>
		{/if}
		<header class="bg-white dark:bg-gray-900 py-4 px-6 flex items-center justify-between w-full z-50 shadow-md">
			<a href="/" class="flex items-center space-x-3">
				<img src="{Icon}" class="h-10 rounded-lg" alt="Logo" />
				<div>
					<div class="text-xl font-bold font-sans">NFT Navigator</div>
					<div class="text-xs">on the <a href="https://voi.network" target="_blank" class="underline text-blue-500 hover:text-blue-600">Voi</a> Network</div>
				</div>
			</a>
			<nav class="hidden lg:flex items-center space-x-6">
				<a href="/" class="nav-link {currentPath == '' ? 'text-blue-500' : ''}">Home</a>
				<a href="/forsale" class="nav-link {currentPath == 'forsale' ? 'text-blue-500' : ''}">For Sale</a>
				<a href="/lounge{extensionRouteLounge}" class="nav-link {currentPath == 'lounge' ? 'text-blue-500' : ''}">Lounge</a>
				<a href="/analytics{extensionRoute}" class="nav-link {currentPath == 'analytics' ? 'text-blue-500' : ''}">Analytics</a>
				<a href="/portfolio" class="nav-link {currentPath == 'portfolio' ? 'text-blue-500' : ''}">My Portfolio</a>
			</nav>
			<div class="flex items-center space-x-4">
				<div class="hidden lg:block">
					<CollectionSearch />
				</div>
				<div class="hidden lg:block">
					<Web3Wallet availableWallets={['DeflyWallet','Kibisis','LuteWallet']} showAuthButtons={true} algodClient={algodClient} indexerClient={algodIndexer} allowWatchAccounts={true} walletListClass="bg-gray-100 dark:bg-gray-700 dark:text-gray-200"/>
				</div>
				<DarkMode />
				<button on:click|stopPropagation={() => showMenu = !showMenu} class="lg:hidden">
					<i class="fas fa-bars text-2xl"></i>
				</button>
			</div>
		</header>
	</div>
	{#if showMenu}
		<div transition:fly={{ y: -50, duration: 300 }} class="lg:hidden fixed top-20 right-0 left-0 bg-white dark:bg-gray-800 shadow-lg z-40 p-4">
			<nav class="flex flex-col space-y-4">
				<a href="/" class="nav-link {currentPath == '' ? 'text-blue-500' : ''}">Home</a>
				<a href="/forsale" class="nav-link {currentPath == 'forsale' ? 'text-blue-500' : ''}">For Sale</a>
				<a href="/lounge{extensionRouteLounge}" class="nav-link {currentPath == 'lounge' ? 'text-blue-500' : ''}">Lounge</a>
				<a href="/analytics{extensionRoute}" class="nav-link {currentPath == 'analytics' ? 'text-blue-500' : ''}">Analytics</a>
				<a href="/portfolio" class="nav-link {currentPath == 'portfolio' ? 'text-blue-500' : ''}">My Portfolio</a>
			</nav>
			<div class="mt-4">
				<CollectionSearch />
			</div>
			<div class="mt-4 flex justify-center">
				<Web3Wallet availableWallets={['DeflyWallet','Kibisis','LuteWallet']} showAuthButtons={true} algodClient={algodClient} indexerClient={algodIndexer} allowWatchAccounts={true} walletListClass="bg-gray-100 dark:bg-gray-700"/>
			</div>
		</div>
	{/if}

	<main class="flex-grow {showBanner ? 'pt-28' : 'pt-20'}">
		<slot />
	</main>

	<SvelteToast {options} />
	{#if $showConfetti}
		<div class="fixed inset-0 pointer-events-none">
			<Confetti x={[-5, 5]} y={[0, 0.1]} delay={[0, 2000]} amount={400} fallDistance="100vh" />
		</div>
	{/if}
</div>

<style>
	.nav-link {
		@apply hover:text-blue-500 transition duration-300;
	}
</style>