<script lang="ts">
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import WalletSearch from '$lib/component/WalletSearch.svelte';
	import { goto } from '$app/navigation';
	import { DarkMode } from 'flowbite-svelte';
	import Icon from '$lib/assets/android-chrome-192x192.png';
	import { Web3Wallet, selectedWallet } from 'avm-wallet-svelte';
	import { onMount } from 'svelte';
	//@ts-ignore
	import Device from 'svelte-device-info';

	let showWalletSearch = false;
	let isMobile = false;
	let showMenu = false;

	onMount(() => {
		isMobile = Device.isMobile;
	});

    const onSearch = (addr: string) => {
        goto(`/portfolio/${addr}`);
    }

	const options = {
  	}
	//import { Footer, FooterCopyright, FooterLinkGroup, FooterBrand, FooterLink } from 'flowbite-svelte';
</script>

<div class="app dark:text-white">
    <header class="bg-gray-100 dark:bg-gray-800 py-4 px-4 flex border-b border-b-gray-200 dark:border-b-gray-900 relative">
		<a href="/" class="absolute top-0 left-0 p-4 flex flex-row space-x-2">
			<img src="{Icon}" class="h-12 rounded-2xl" alt="Logo" />
			<div class="cursor-pointer text-2xl font-bold content-center">NFT Navigator</div>
		</a>
		<div class="flex-grow content-center hide-on-mobile">
			<div class="flex justify-center">
				<div class="bg-white shadow rounded-lg overflow-hidden dark:bg-gray-600 inline-flex">
					<ul class="flex divide-x divide-gray-300 dark:divide-gray-500">
						<a href='/' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer overflow-hidden">Collections</a>
						<a href='/forsale' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">For Sale</a>
						{#if $selectedWallet}
							<a href='/portfolio/{$selectedWallet?.address}' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">My Portfolio</a>
						{/if}
					</ul>
				</div>
			</div>
        </div>
		<div class="flex place-items-end hide-on-mobile">
			{#if showWalletSearch}
				<div class="mr-2 relative">
		            <WalletSearch onSubmit={onSearch} loadPreviousValue={false}/>
				</div>
			{/if}
			<button on:click={() => showWalletSearch = !showWalletSearch} class="h-10 w-10 rounded-2xl bg-slate-500 flex items-center justify-center mr-2">
				<i class="fas fa-search cursor-pointer"></i>
			</button>
			<div class="w-48">
				<Web3Wallet />
			</div>
			<DarkMode />
		</div>
		<div class="ml-auto hide-on-desktop relative content-end flex flex-row">
			<DarkMode />
			<button on:click={() => showMenu = !showMenu} class="h-10 w-10 rounded-2xl bg-slate-500 flex items-center justify-center mr-2">
				<i class="fas fa-bars cursor-pointer"></i>
			</button>
			{#if showMenu}
				<div class="absolute top-full right-0 bg-white dark:bg-gray-600 rounded-lg shadow-lg z-50" on:click={() => showMenu = false}>
					<ul class="flex flex-col divide-y divide-gray-300 dark:divide-gray-500">
						<a href='/' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer overflow-hidden">Collections</a>
						<a href='/forsale' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">For Sale</a>
						{#if $selectedWallet}
							<a href='/portfolio/{$selectedWallet?.address}' class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer">My Portfolio</a>
						{/if}
					</ul>
					<Web3Wallet/>
				</div>
			{/if}
		</div>
    </header>
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
<style>
    @media (max-width: 600px) {
        .hide-on-mobile {
            display: none;
        }
    }
    @media (min-width: 601px) {
        .hide-on-desktop {
            display: none;
        }
    }
</style>