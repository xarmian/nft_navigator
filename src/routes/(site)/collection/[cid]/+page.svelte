<script lang="ts">
	import type { PageData } from './$types';
    import type { Token } from '$lib/data/types';
	import { onMount } from 'svelte';
    import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
    import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import TokenCard from '$lib/component/ui/TokenCard.svelte';
    import BreadcrumbCustom from '$lib/component/ui/BreadcrumbCustom.svelte';
    //@ts-ignore
    import Device from 'svelte-device-info';
	import Switch from '$lib/component/ui/Switch.svelte';
    import { MetaTags } from 'svelte-meta-tags';
    import { inview } from 'svelte-inview';
    import voiGamesImage from '$lib/assets/voi-games-small.png';

    export let data: PageData;
    let contractId = data.contractId;
    let tokens = data.tokens as Token[];
    let categories = {} as { [key: string]: {} };
    let collectionName = data.collectionName;
    let filteredTokens = [] as Token[];
    let displayCount = 10;
    let filters = {} as { [key: string]: string };
    let isMobile = false;
    let searchText = '';
    let forSaleCollection = false;

    onMount(() => {
        isMobile = Device.isMobile;
    });

    // reactive stuff
    $: {
        let combinedProperties = {} as { [key: string]: { [key: string]: number } };
        tokens.forEach(token => {
            Object.entries(token.metadata.properties).forEach(([key, value]) => {
                if (combinedProperties[key]) {
                    if (combinedProperties[key][value]) {
                        combinedProperties[key][value]++;
                    } else {
                        combinedProperties[key][value] = 1;
                    }
                } else {
                    combinedProperties[key] = { [value]: 1 };
                }

                // token.traits = Object.entries(token.metadata.properties).map(([key, value]) => key + ': ' + value);
            });
        });

        Object.keys(combinedProperties).forEach(key => {
            let sortedObject = Object.entries(combinedProperties[key])
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
            combinedProperties[key] = sortedObject;
        });

        categories = combinedProperties;

        // filter tokens using filters
        filteredTokens = tokens.filter(token => {
            if (forSaleCollection && (!token.marketData || token.marketData?.sale || token.marketData?.delete)) return false;
            if (searchText !== ''
                && !token.metadata.name.toLowerCase().includes(searchText.toLowerCase())
                && !token.traits?.some(trait => trait.toLowerCase().includes(searchText.toLowerCase()))
                ) return false;
            
            return Object.entries(filters).every(([key, value]) => {
                if (value === '') return true;
                //@ts-ignore
                return token.metadata.properties[key] === value;
            });
        });
    }

    function showMore() {
        displayCount += 10;
    }

    let inputElement: HTMLInputElement;
</script>

<MetaTags title={collectionName} 
    titleTemplate="%s | NFT Navigator"
    openGraph={{
        url: `https://nftnavigator.xyz/collection/${contractId}`,
        title: `${collectionName} | NFT Navigator`,
        images: [{ url: tokens[0]?.metadata?.image??'' }],
    }} />
<BreadcrumbCustom aria-label="Navigation breadcrumb" solidClass="flex px-5 py-3 text-gray-700 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 justify-between" solid>
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
    <svelte:fragment slot="right">
        <div></div>
    </svelte:fragment>
</BreadcrumbCustom>
<div class="flex pb-16">
    {#if !isMobile}
        <div class="p-4">
            <div class="relative self-start">
                <input type="text" placeholder="Search" bind:value={searchText} bind:this={inputElement} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600 w-full pr-10"/>
                {#if searchText}
                    <button class="absolute inset-y-0 right-0 pr-3 flex items-center w-10" on:click={() => { searchText = ''; inputElement.focus(); }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                {/if}
            </div>
            {#each Object.entries(categories) as [category, traits]}
                <div class="mt-2 mb-2">
                    <label class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2" for={category}>
                        {category}
                    </label>
                    <div class="relative">
                        <select bind:value={filters[category]} class="block appearance-none w-48 bg-white border border-gray-300 dark:border-gray-500 text-gray-700 dark:bg-gray-600 dark:text-gray-200 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500" id={category}>
                            <option value="">All</option>
                            {#each Object.entries(traits) as [trait, count]}
                                <option value={trait}>{trait+' ('+count+')'}</option>
                            {/each}
                        </select>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
    <div>
        <div class="flex justify-between">
            <div class="flex flex-row">
                <button on:click={() => window.open('https://highforge.io/project/'+contractId)} class="bg-opacity-20 m-4 px-4 py-2 bg-blue-600 text-gray-500 dark:text-gray-100 rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-900 outline-1">
                    View on High Forge <i class="fas fa-external-link-alt"></i>
                </button>
                {#if data.isVoiGames}
                    <button on:click={() => window.open('https://nft-games.boeieruurd.com/collections/'+contractId)} class="bg-opacity-20 m-4 px-4 py-2 bg-blue-600 text-white rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-900">
                        <img src={voiGamesImage} class="h-12 inline-block" alt="Voi Games" /><i class="fas fa-external-link-alt inline-block"></i>
                    </button>
                {/if}
            </div>
            <div class="flex justify-end p-4">
                <Switch label="For Sale" bind:checked={forSaleCollection} />
            </div>
        </div>
        {#if isMobile}
            <div class="flex pl-4 justify-center">
                <input type="text" placeholder="Search" bind:value={searchText} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600" />
            </div>
        {/if}
        <div class="flex flex-wrap flex-grow justify-start">
            {#each filteredTokens.slice(0, displayCount) as token (token.tokenId)}
                <div class="p-1">
                    <TokenCard {token} />
                </div>
            {/each}
        </div>
        {#if filteredTokens.length > displayCount}
            <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
        {/if}
    </div>
</div>

<style>
    /*.show-more {
        display: block;
        margin: 0px auto 40px auto;
        padding: 10px 20px;
        font-size: 16px;
        color: white;
        background-color: #007BFF;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    .show-more:hover {
        background-color: #0056b3;
    }*/
    .sentinel {
        height: 1px;
        width: 100%;
    }
</style>