<script lang="ts">
	import type { PageData } from './$types';
    import type { Token } from '$lib/data/types';
	import { onMount } from 'svelte';
    import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
    import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
    import TokenTransactionHistory from '$lib/component/ui/TokenTransactionHistory.svelte';
    import { goto } from '$app/navigation';
    //@ts-ignore
    import Device from 'svelte-device-info';

    $: isMobile = false;
    export let data: PageData;
    let contractId = data.contractId;
    let tokenId = data.tokenId;
    let token = data.token;
    let tokenName = token?.metadata.name??'';
	let collectionName = token?.metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
console.log(token);
    let isMenuOpen = false;

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    function closeMenu(event: any) {
        if (isMenuOpen && !event.target.closest('.hamburger-container')) {
            isMenuOpen = false;
        }
    }

    onMount(() => {
        isMobile = Device.isMobile;
    });

    const goToMarketplace = () => {
        if (token) window.open(`https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`,'_blank');
    }

    const goToContract = () => {
        if (token) window.open(`https://voi.observer/explorer/application/${token.contractId}/transactions`, '_blank');
    }

    const goToProjectPage = () => {
        //window.location.href = token.metadata.image;
    }

    const goToCollection = () => {
        if (token) goto(`/collection/${token.contractId}`);
    }
</script>
<svelte:window on:click={closeMenu} />
<Breadcrumb aria-label="Navigation breadcrumb" solid>
    <BreadcrumbItem href="/" class="hover:text-blue-800" >
        <svelte:fragment slot="icon">
            <HomeOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>Home
    </BreadcrumbItem>
    <BreadcrumbItem href="/collection/{contractId}" class="hover:text-blue-800">
        <svelte:fragment slot="icon">
            <ChevronDoubleRightOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>Collection ({collectionName})
    </BreadcrumbItem>
    <BreadcrumbItem href="/collection/{contractId}/token/{tokenId}" class="hover:text-blue-800">
        <svelte:fragment slot="icon">
            <ChevronDoubleRightOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>{tokenName}
    </BreadcrumbItem>
</Breadcrumb>
<div class="m-5">
    <div class="button-bar">
        {#if isMobile}
            <div class="hamburger-container">
                <button class="hamburger-button" on:click={toggleMenu}>
                    <span class="hamburger-icon"></span>
                    <span class="hamburger-icon"></span>
                    <span class="hamburger-icon"></span>
                </button>
                {#if isMenuOpen}
                    <div class="menu">
                        <button class="mb-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" on:click={goToMarketplace}>Marketplace</button>
                        <button class="mb-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" on:click={goToContract}>Contract</button>
                        <button class="bg-gray-200 dark:bg-gray-600 opacity-50 !cursor-not-allowed" on:click={goToProjectPage}>Project Page</button>
                    </div>
                {/if}
            </div>
        {:else}
            <button class="mr-2 mb-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" on:click={goToCollection}><i class='fas fa-arrow-left'></i> Collection</button>
            <button class="mr-2 mb-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" on:click={goToMarketplace}>Marketplace</button>
            <button class="mr-2 mb-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" on:click={goToContract}>Contract</button>
            <button class="bg-gray-200 dark:bg-gray-600 opacity-50 !cursor-not-allowed" on:click={goToProjectPage}>Project Page</button>
        {/if}
    </div>
    {#if token}
        <TokenDetail {token} />
        <TokenTransactionHistory {token}/>
    {/if}
</div>
<style>
    .button-bar {
        display: flex;
        justify-content:left;
        align-items: center;
        margin-bottom: 1rem;
    }
    button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
    }
    .hamburger-container {
        position: relative;
    }
    .hamburger-button {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        width: 1.5rem;
        height: 1.5rem;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        z-index: 10;
    }
    .hamburger-icon {
        width: 1.5rem;
        height: 0.2rem;
        background: #333;
    }
    .menu {
        position: absolute;
        top: 0rem;
        left: 2rem;
        background-color: #f0f0f0;
        border: 1px solid #e0e0e0;
        border-radius: 0.5rem;
        padding: 0.5rem;
        display: flex;
        flex-direction: column;
        z-index: 9;
        white-space: nowrap;
    }
    @media (prefers-color-scheme: dark) {
        button {
            background-color: #333;
            color: #f0f0f0;
        }

        button:hover {
            background-color: #444;
        }
    }
</style>
