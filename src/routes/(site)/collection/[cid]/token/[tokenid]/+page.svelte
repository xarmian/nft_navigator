<script lang="ts">
	import type { PageData } from './$types';
	import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
    import TokenTransactionHistory from '$lib/component/ui/TokenTransactionHistory.svelte';
	import NautilusButton from '$lib/component/ui/NautilusButton.svelte';
	import HighforgeButton from '$lib/component/ui/HighforgeButton.svelte';
	import NftGamesButton from '$lib/component/ui/NFTGamesButton.svelte';
    import { handleScroll } from '$lib/utils/functions';
    import FanIcon from '$lib/component/ui/icons/FanIcon.svelte';

    export let data: PageData;
    let contractId = data.contractId;
    let token = data.token;
    let collection = data.collection;

    let isMenuOpen = false;

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    function closeMenu(event: any) {
        if (isMenuOpen && !event.target.closest('.hamburger-container')) {
            isMenuOpen = false;
        }
    }
</script>
<svelte:window on:click={closeMenu} />
<div class="m-5">
    <div use:handleScroll class="button-bar">
        <div class="flex flex-row space-x-3">
            <a class="content-evenly text-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" href={`/collection/${token?.contractId}`}><FanIcon /> Collection</a>
            {#if token}
                <NautilusButton contractid={contractId} tokenid={String(token.tokenId)} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
                <HighforgeButton buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
            {/if}
            {#if collection?.gameData}
                <NftGamesButton contractid={contractId} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
            {/if}
            <!--<button class="mr-2 bg-gray-200 dark:bg-gray-600 opacity-50 !cursor-not-allowed" on:click={goToProjectPage}>Project Page <i class="fas fa-external-link-alt"></i></button>-->
        </div>
    </div>
    {#if token}
        <div class='mb-4'>
            {#if collection}
                <TokenDetail {token} {collection} />
            {/if}
        </div>
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
    a {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
    }
</style>
