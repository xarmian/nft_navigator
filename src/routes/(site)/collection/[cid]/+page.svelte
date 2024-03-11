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
    import Select from '$lib/component/ui/Select.svelte';
    import SalesTable from '$lib/component/ui/SalesTable.svelte';
    import { page } from '$app/stores';

    const forsale = $page.url.searchParams.get('forsale');

    export let data: PageData;
    let contractId = data.contractId;
    let tokens = data.tokens as Token[];
    let categories = {} as { [key: string]: {} };
    let collectionName = data.collectionName;
    let collection = data.collection;
    let filteredTokens = [] as Token[];
    let displayCount = 10;
    let filters = {} as { [key: string]: string };
    let isMobile = false;
    let searchText = '';
    let forSaleCollection = (typeof forsale === 'string') ? true : false;
    let displayTab = 'tokens';

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
        images: [{ url: data.collection?.highforgeData?.coverImageURL ?? tokens[0]?.metadata?.image ?? '' }],
    }} />

<div class="justify-between h-60 overflow-hidden overflow-ellipsis relative flex flex-row text-white">
    <img src="{data.collection?.highforgeData?.coverImageURL ?? tokens[0].metadata.image}" class="w-1/2 object-cover" />
    <img src="{data.collection?.highforgeData?.coverImageURL ?? tokens[0].metadata.image}" class="w-1/2 object-cover" />
    <div class="mask_dark flex justify-center h-full position absolute w-full content-center bg-slate-100 dark:bg-slate-800">
        <div class="flex h-full {isMobile ? 'w-full' : 'w-1/2'} pl-4 pr-4 place-items-center space-between flex-col space-y-1">
            {#if data.collection?.highforgeData}
                <div class="p-4 overflow-hidden mb-auto">
                    <div class="text-4xl font-bold">{data.collection?.highforgeData?.title??collectionName}</div>
                    <div class="text-md">{data.collection?.highforgeData?.description}</div>
                </div>
            {/if}
            <div class="flex flex-row pl-4 justify-between mt-auto w-full">
                <div class="flex flex-row space-x-10">
                    <div>
                        <div class="text-sm">Floor</div>
                        <div class="text-lg text-blue-300">{data.floor}</div>
                    </div>
                    <div>
                        <div class="text-sm">Tokens</div>
                        <div class="text-lg text-blue-300">{collection?.totalSupply}</div>
                    </div>
                    <div>
                        <div class="text-sm">Holders</div>
                        <div class="text-lg text-blue-300">{collection?.uniqueOwners}</div>
                    </div>
                    <div>
                        <div class="text-sm">Creator</div>
                        <div class="text-lg text-blue-300"><a href='https://voi.observer/explorer/account/{collection?.creator}' target="_blank">{collection?.creator.substring(0,8)}...</a></div>
                    </div>
                </div>
                <div class="flex flex-row space-x-2 mb-2">
                    <button on:click={() => window.open('https://highforge.io/project/'+contractId)} class="p-2 bg-purple-900  text-gray-100 rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-900 outline-1">
                        High Forge <i class="fas fa-external-link-alt"></i>
                    </button>
                    {#if data.collection?.gameData}
                        <button on:click={() => window.open('https://nft-games.boeieruurd.com/collections/'+contractId)} class="p-2 bg-purple-900 text-gray-100 rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-900">
                            <img src={voiGamesImage} class="h-10 inline-block" alt="Voi Games" /><i class="fas fa-external-link-alt inline-block"></i>
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
<div class="flex pb-16">
    {#if !isMobile && displayTab == 'tokens'}
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
    <div class="w-full">
        {#if isMobile}
            <div class="flex justify-center">
                <button on:click={() => window.open('https://highforge.io/project/'+contractId)} class="bg-opacity-20 m-4 px-4 py-1 bg-blue-600 text-gray-500 dark:text-gray-100 rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-900 outline-1">
                    High Forge <i class="fas fa-external-link-alt"></i>
                </button>
                {#if data.collection?.gameData}
                    <button on:click={() => window.open('https://nft-games.boeieruurd.com/collections/'+contractId)} class="bg-opacity-20 m-4 px-4 py-1 bg-blue-600 text-white rounded-md transition-colors duration-200 ease-in-out hover:bg-blue-900">
                        <img src={voiGamesImage} class="h-12 inline-block" alt="Voi Games" /><i class="fas fa-external-link-alt inline-block"></i>
                    </button>
                {/if}
            </div>
        {/if}
        <div class="flex {isMobile ? 'justify-center' : 'justify-end'}">
            <div class="p-4 flex flex-row">
                {#if displayTab == 'tokens'}
                    <Switch label="For Sale" bind:checked={forSaleCollection} ></Switch>
                {/if}
                <Select bind:value={displayTab} options={[{id: 'tokens',name:'Tokens'},{id:'sales',name:'Sales'}]}></Select>
            </div>
        </div>
        {#if displayTab == 'tokens'}
            {#if isMobile}
                <div class="flex pl-4 justify-center">
                    <input type="text" placeholder="Search" bind:value={searchText} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600" />
                </div>
            {/if}
            <div class="flex flex-wrap flex-grow {isMobile ? 'justify-center' : 'justify-start'}">
                {#each filteredTokens.slice(0, displayCount) as token (token.tokenId)}
                    <div class="p-1">
                        <TokenCard {token} />
                    </div>
                {/each}
            </div>
            {#if filteredTokens.length > displayCount}
                <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
            {/if}
        {:else if displayTab == 'sales'}
            <SalesTable collectionId={Number(contractId)} />
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
    .mask_dark {
        background: radial-gradient(circle at center, rgba(0,0,0,1) 20%, rgba(0,0,0,1), rgba(0,0,0,0), rgba(0,0,0,1) 100%);
    }
</style>