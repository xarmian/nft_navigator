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
	import { slide } from 'svelte/transition';
	import { PUBLIC_WALLET_CONNECT_PROJECT_ID } from '$env/static/public';
	import { fetchProjects } from '$lib/utils/projects';
	import type { IProject } from '$lib/utils/projects';

	let projects: IProject[] = [];

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

		/*const response = await fetch('/api/quests', {
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
		}*/
	});

	setOnAuthHandler(async (wallet) => {
		console.log('Wallet authenticated', wallet);

		/*const response = await fetch('/api/quests', {
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
		}*/
	});

	async function loadProjects() {
		projects = await fetchProjects();
		projects = projects.filter(p => p.status === 'active');
	}

	onMount(() => {
		loadProjects();

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
		<header class="bg-white dark:bg-gray-800 py-4 px-6 flex items-center justify-between w-full z-50 shadow-md">
			<div class="flex items-center space-x-3">
				<a href="/">
					<img src="{Icon}" class="h-10 rounded-lg" alt="Logo" />
				</a>
				<div>
					<div class="text-xl font-bold font-sans">NFT Navigator</div>
					<div class="text-xs">on the <a href="https://voi.network" target="_blank" class="underline text-blue-500 hover:text-blue-600">Voi</a> Network</div>
				</div>
			</div>
			<nav class="hidden lg:flex items-center space-x-6">
				<a href="/" class="nav-link {currentPath == '' ? 'text-blue-500' : ''}">Home</a>
				<a href="/collection" class="nav-link {currentPath == 'collection' ? 'text-blue-500' : ''}">Collections</a>
				<a href="/forsale" class="nav-link {currentPath == 'forsale' ? 'text-blue-500' : ''}">For Sale</a>
				<a href="/lounge{extensionRouteLounge}" class="nav-link {currentPath == 'lounge' ? 'text-blue-500' : ''}">Lounge</a>
				<a href="/analytics{extensionRoute}" class="nav-link {currentPath == 'analytics' ? 'text-blue-500' : ''}">Analytics</a>
				<a href="/portfolio" class="nav-link {currentPath == 'portfolio' ? 'text-blue-500' : ''}">My Portfolio</a>
				<a href="/nftgames" class="nav-link relative group hidden">
					<div class="absolute inset-0 flex items-center justify-center text-yellow-400/50 transform transition-transform group-hover:scale-110">
						<i class="fas fa-trophy text-3xl"></i>
					</div>
					<div class="relative text-center">
						<div class="leading-tight">Winter Games</div>
					</div>
				</a>
			</nav>
			<div class="flex items-center space-x-4">
				<div class="hidden lg:block">
					<CollectionSearch expandDirection="left" />
				</div>
				<div class="hidden lg:block">
					<Web3Wallet availableWallets={['Kibisis','LuteWallet','Biatec Wallet','WalletConnect']}
					 showAuthButtons={true} 
					 algodClient={algodClient} 
					 indexerClient={algodIndexer} 
					 allowWatchAccounts={true} 
					 wcProject={{
						projectId: PUBLIC_WALLET_CONNECT_PROJECT_ID,
						projectName: 'NFT Navigator',
						projectDescription: 'NFT Navigator',
						projectUrl: 'https://nftnavigator.xyz',
						projectIcons: ['https://nftnavigator.xyz/android-chrome-192x192.png'],
					 }}
					 walletListClass="bg-gray-100 dark:bg-gray-700 dark:text-gray-200"/>
				</div>
				<DarkMode />
				<button on:click|stopPropagation={() => showMenu = !showMenu} aria-label="Menu" class="lg:hidden">
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
			<div class="mt-4 z-50 relative">
				<CollectionSearch expandDirection="right" isExpanded={true} />
			</div>
			<div class="mt-4 flex justify-center">
				<Web3Wallet availableWallets={['Kibisis', 'LuteWallet', 'WalletConnect']}
					showAuthButtons={true} 
					algodClient={algodClient} 
					indexerClient={algodIndexer} 
					allowWatchAccounts={true} 
					wcProject={{
						projectId: PUBLIC_WALLET_CONNECT_PROJECT_ID,
						projectName: 'NFT Navigator',
						projectDescription: 'NFT Navigator',
						projectUrl: 'https://nftnavigator.xyz',
						projectIcons: ['https://nftnavigator.xyz/android-chrome-192x192.png'],
					}}
					walletListClass="bg-gray-100 dark:bg-gray-700"/>
			</div>
		</div>
	{/if}

	<main class="flex-grow {showBanner ? 'pt-28' : 'pt-20'}">
		<slot />
	</main>

	<div class="w-full overflow-hidden mb-8 pt-4 border-t border-gray-200 dark:border-gray-700" style="position: relative; z-index: 0;">
		<p class="text-sm text-gray-500 dark:text-gray-400 font-semibold px-4">Voi Ecosystem Projects</p>
		<div class="relative">
			<div class="flex overflow-x-auto space-x-2 py-4 px-2 scrollbar-hide">
				{#each projects as project}
					<a
						href={project.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex-shrink-0 group w-24"
					>
						<div class="w-24 h-24 rounded-lg bg-gray-200 dark:bg-gray-700 p-2 flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors">
							{#if project.logo}
								<img
									src={project.logo}
									alt={project.title}
									class="max-w-full max-h-full object-contain"
								/>
							{:else}
								<span class="text-sm text-center text-gray-600 dark:text-gray-300">
									{project.title}
								</span>
							{/if}
						</div>
						<p class="text-xs text-center mt-2 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 break-words hyphens-auto">
							{project.title}
						</p>
					</a>
				{/each}
			</div>
		</div>
	</div>

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