<script lang="ts">
	import type { PageData } from '../$types';
    import type { Token, Collection } from '$lib/data/types';
	import Switch from '$lib/component/ui/Switch.svelte';
    import { inview } from 'svelte-inview';
    import Select from '$lib/component/ui/Select.svelte';
    import SalesTable from '$lib/component/ui/SalesTable.svelte';
    import HoldersList from '$lib/component/ui/HoldersList.svelte';
	import NautilusButton from '$lib/component/ui/NautilusButton.svelte';
    import HighforgeButton from '$lib/component/ui/HighforgeButton.svelte';
	import NftGamesButton from '$lib/component/ui/NFTGamesButton.svelte';
    import { getImageUrl, handleScroll } from '$lib/utils/functions';
	import { goto } from '$app/navigation';
	import PixelPursuitButton from '$lib/component/ui/PixelPursuitButton.svelte';
	import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
	import LoungeButton from '$lib/component/ui/LoungeButton.svelte';

    //const forsale = $page.url.searchParams.get('forsale');

    export let data: PageData;
    $: contractId = data.contractId;
    let subpage = data.subpage;
    $: tokens = data.tokens as Token[];
    let collectionName = data.collectionName;
    $: collection = data.collection as Collection;
    let filteredTokens = [] as Token[];
    let displayCount = 10;
    $: filters = data.filters;
    let searchText = '';
    let forSaleCollection = (subpage === 'forsale');

    $: displayTab = (subpage === 'forsale') ? 'tokens' : subpage;
    $: categories = data.categories;

    $: { 
        filteredTokens = tokens.filter(token => {
            if (forSaleCollection && (!token.marketData || token.marketData?.sale || token.marketData?.delete)) return false;
            if ((displayTab === 'burned') != (token.isBurned??false)) return false;

            if (searchText !== ''
                && !token.metadata?.name.toLowerCase().includes(searchText.toLowerCase())
                && !token.traits?.some(trait => trait.toLowerCase().includes(searchText.toLowerCase()))
                ) return false;
            
            return Object.entries(filters).every(([key, value]) => {
                if (value === '') return true;
                //@ts-ignore
                return token.metadata.properties[key] === value;
            });
        });
        
        // if displayTab == 'ranking' then sort tokens by rank
        if (displayTab === 'ranking') {
            filteredTokens.sort((a: Token, b: Token) => {
                if (a.rank === undefined) return 1;
                if (b.rank === undefined) return -1;
                return (a?.rank??0) - (b?.rank??0);
            });
        }
    }

    function onForSaleChange() {
        goto(`/collection/${contractId}${forSaleCollection ? '/forsale' : ''}`);
        //console.log(val);
    }

    function onSubpageChange(newPage: string | number) {
        if (newPage === 'tokens') {
            if (forSaleCollection) {
                goto(`/collection/${contractId}/forsale`);
            }
            else {
                goto(`/collection/${contractId}`);
            }
        }
        else {
            goto(`/collection/${contractId}/${newPage}`);
        }
    }
    
    function showMore() {
        displayCount += 10;
    }

    const tabs = [ 
        {id: 'tokens', name: 'Tokens'}, 
        {id: 'ranking', name: 'Ranking'},
        {id: 'transactions', name: 'Transactions'},
        {id: 'collectors', name: 'Collectors'}, 
        {id: 'burned', name: 'Burned Tokens'},
    ];

    let inputElement: HTMLInputElement;
</script>

<div use:handleScroll class="banner_container h-60 justify-between overflow-hidden overflow-ellipsis relative flex flex-row text-white" style="transition: transform 0.3s ease-out;">
    {#if tokens[0] && tokens[0].metadata?.image}
        <img src="{getImageUrl(data.collection?.highforgeData?.coverImageURL ?? tokens[0].metadata?.image,480)}" class="banner_img object-cover" />
        <img src="{getImageUrl(data.collection?.highforgeData?.coverImageURL ?? tokens[0].metadata?.image,480)}" class="banner_img2 w-1/2 object-cover" />
    {/if}
    <div class="mask_dark flex justify-center h-full absolute w-full content-center bg-slate-100 dark:bg-slate-800">
        <div class="collection_detail w-1/2 flex justify-center content-center md:space-x-10 pr-2">
            <div class="flex h-full place-items-center space-between flex-col space-y-1 w-3/4 md:flex-grow">
                {#if data.collection?.highforgeData}
                    <div class="p-4 overflow-auto mb-auto">
                        <div class="text-4xl font-bold">{data.collection?.highforgeData?.title??collectionName}</div>
                        <div class="text-md">{data.collection?.highforgeData?.description}</div>
                    </div>
                {/if}
                <div class="flex flex-row pl-4 justify-between mt-auto w-full pt-4">
                    <div class="flex flex-row space-x-4">
                        <div>
                            <div class="text-sm">Floor</div>
                            <div class="text-lg text-blue-300">{data.floor}</div>
                        </div>
                        <div>
                            <div class="text-sm">Ceiling</div>
                            <div class="text-lg text-blue-300">{data.ceiling}</div>
                        </div>
                        <div class="tooltip">
                            <div class="text-sm">Tokens</div>
                            <div class="text-lg text-blue-300">
                                {collection.burnedSupply != null ? (collection.totalSupply - collection.burnedSupply) : '-'}
                            </div>
                            <div class="tooltiptext flex flex-col space-y-1 w-auto whitespace-nowrap p-2 bg-slate-700">
                                <div>Original Supply: {collection.totalSupply}</div>
                                <div>Tokens Burned: {collection.burnedSupply}</div>
                                <div>Tokens Remaining: {collection.totalSupply - collection.burnedSupply}</div>
                            </div>
                        </div>
                        <div>
                            <div class="text-sm">Collectors</div>
                            <div class="text-lg text-blue-300">{collection?.uniqueOwners}</div>
                        </div>
                        <div>
                            <div class="text-sm">Creator</div>
                            <div class="text-lg text-blue-300 hover:text-blue-200"><a href='/portfolio/{collection?.creator}'>{collection?.creator.substring(0,8)}...</a></div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col space-y-2 items-stretch justify-center mb-2 z-10 w-24">
                <LoungeButton contractid={contractId} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-12 text-black"/>
                <NautilusButton contractid={contractId} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-12"/>
                <HighforgeButton contractid={contractId} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-12"/>
                <PixelPursuitButton contractid={contractId} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 text-black dark:text-black px-2 rounded-md cursor-pointer min-h-12"/>
                {#if collection?.gameData}
                    <!--<NftGamesButton contractid={contractId} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-12"/>-->
                {/if}
            </div>
        </div>
        <div class="pt-2 md:pt-4 md:p-4 md:flex flex-col lg:flex-row space-x-1 space-y-1 absolute bottom-0 right-0 hidden place-items-end">
            {#if displayTab == 'tokens'}
            <div>
                <Switch label="For Sale" onChange={onForSaleChange} bind:checked={forSaleCollection} sliderStyle="border:1px solid #3c3c3c;" labelStyle="text-shadow: -1px 0 #3c3c3c, 0 1px #3c3c3c, 1px 0 #3c3c3c, 0 -1px #3c3c3c;" ></Switch>
            </div>
            {/if}
            <Select bind:value={displayTab} options={tabs} onchange={onSubpageChange}></Select>
        </div>
    </div>
</div>
<div class="flex pb-16">
    {#if displayTab == 'tokens' || displayTab == 'burned' || displayTab == 'ranking'}
        <div class="p-4 hidden md:block">
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
                            {#if traits}
                                {#each Object.entries(traits) as [trait, count]}
                                    <option value={trait}>{trait+' ('+count+')'}</option>
                                {/each}
                            {/if}
                        </select>
                    </div>
                </div>
            {/each}
        </div>
        <div class="w-full md:mt-3">
            <div class="flex justify-center md:justify-end">
                <div class="pt-2 md:pt-4 md:p-4 flex flex-row md:hidden space-x-1 justify-between md:justify-end mt-3 sm:mt-0">
                    {#if displayTab == 'tokens'}
                        <div class="flex pl-4 justify-center h-10 md:hidden">
                            <input type="text" placeholder="Search" bind:value={searchText} class="border border-gray-300 rounded-lg dark:bg-gray-600 w-40" />
                        </div>
                        <div>
                            <Switch label="For Sale" bind:checked={forSaleCollection} ></Switch>
                        </div>
                    {/if}
                    <Select bind:value={displayTab} options={tabs} onchange={onSubpageChange}></Select>
                </div>
            </div>
            <div class="flex flex-wrap flex-grow justify-center md:justify-start mt-3 md:mt-0">
                {#each filteredTokens.slice(0, displayCount) as token (token.tokenId)}
                    <div class="p-1">
                        <!--<TokenCard {token} />-->
                        <TokenDetail {collection} {token} format="small" />
                    </div>
                {/each}
            </div>
            {#if filteredTokens.length > displayCount}
                <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
            {/if}
        </div>
    {:else if displayTab == 'transactions'}
        <div class="w-full">
            <SalesTable collectionId={Number(contractId)} />
        </div>
    {:else if displayTab == 'collectors'}
        <div class="w-full">
            <HoldersList tokens={tokens} />
        </div>
    {/if}
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
        background: radial-gradient(circle at center, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.9), rgba(0,0,0,0), rgba(0,0,0,1) 100%);
    }
    .banner_img {
        width: calc(50%);
    }
    .collection_detail {
        width: 50%;
    }
    .tooltip {
        position: relative;
        display: inline-block;
    }

    .tooltip .tooltiptext {
        visibility: hidden;
        text-align: center;
        border-radius: 6px;
        position: absolute;
        z-index: 100;
        bottom: 125%;
        left: 50%;
        margin-left: -60px;
        opacity: 0;
        transition: opacity 0.3s;
    }

    .tooltip:hover .tooltiptext {
        visibility: visible;
        opacity: 1;
    }
    @media (max-width: 768px) {
        .mask_dark {
            background: rgba(0,0,0,0.4);
        }
        .banner_img {
            filter: blur(5px);
            width: 100%;
        }
        .banner_img2 {
            display:none;
        }
        .banner_container {
            height: fit-content;
        }
        .collection_detail {
            width: 100%;
        }
    }
</style>