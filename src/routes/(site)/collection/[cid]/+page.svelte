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
    import { filters as filterToggles } from '../../../../stores/collection';

    export let data: PageData;
    let contractId = data.contractId;
    let tokens = data.tokens as Token[];
    let categories = {} as { [key: string]: {} };
    let collectionName = data.collectionName;
    let filteredTokens = [] as Token[];
    let displayCount = 25;
    let filters = {} as { [key: string]: string };
    let isMobile = false;
    let searchText = '';

    const zeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

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

                token.traits = Object.entries(token.metadata.properties).map(([key, value]) => key + ': ' + value);
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
            if ($filterToggles.forSale && (!token.marketData || token.marketData?.sale || token.marketData?.delete)) return false;
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
        displayCount += 25;
    }
</script>

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
<div class="flex">
    {#if !isMobile}
        <div class="p-4">
            <input type="text" placeholder="Search" bind:value={searchText} class="p-2 border border-gray-300 dark:border-gray-500 rounded-lg dark:bg-gray-600 dark:text-gray-200" />
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
                <button on:click={() => window.open('https://highforge.io/project/'+contractId)} class="m-4 px-4 py-2 bg-blue-600 text-white rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                    View on High Forge <i class="fas fa-external-link-alt"></i>
                </button>
                <button on:click={() => window.open('https://nft-games.boeieruurd.com/collections/'+contractId)} class="m-4 px-4 py-2 bg-blue-600 text-white rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50">
                    View on NFT Games Tracker <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
            <div class="flex justify-end p-4">
                <Switch label="For Sale" bind:checked={$filterToggles.forSale} />
            </div>
        </div>
        {#if isMobile}
            <div class="flex pl-4 justify-center">
                <input type="text" placeholder="Search" bind:value={searchText} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600" />
            </div>
        {/if}
        <div class="flex flex-wrap flex-grow justify-center">
            {#each filteredTokens.slice(0, displayCount) as token (token.tokenId)}
                <div class="p-4">
                    <TokenCard {token} />
                </div>
            {/each}
        </div>
        {#if filteredTokens.length > displayCount}
            <button on:click={showMore} class="show-more">Show More</button>
        {/if}
    </div>
</div>

<style>
    .show-more {
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
    }
</style>