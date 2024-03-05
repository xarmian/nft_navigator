<script lang="ts">
	import type { PageData } from './$types';
    import { filters, sort } from '../../stores/collection';
    import type { Collection, Listing, Token } from '$lib/data/types';
    import CollectionComponent from '$lib/component/ui/Collection.svelte';
    import TokenCard from '$lib/component/ui/TokenCard.svelte';
    import Switch from '$lib/component/ui/Switch.svelte';
    import { onDestroy } from 'svelte';
    import { inview } from 'svelte-inview';
    
    export let data: PageData;
    let collections: Collection[] = data.collections;
    let filterCollections: Collection[] = [];
    let displayCount = 12;
    let listings: Listing[] | null = null;
    let voiGames: object[] = data.voiGames;
    let tokens: Token[] = [];
    let filterTokens: Token[] = [];
    let textFilter = '';
    let currencyList = [ { id: 0, name: 'VOI' }, { id: 6779767, name: 'VIA' } ];

    $: if ($filters.forSale) {
        if (listings == null) {
            fetch('https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings?active=true')
                .then(response => response.json())
                .then(data => {
                    listings = data.listings as Listing[];
                    if ($filters.voiGames) {
                        listings = listings.filter((l: Listing) => voiGames.find((v: any) => v.applicationID === l.collectionId));
                    }

                    // build array of collectionId+'_'+tokenId from listings and use with tokenIds[] to get token data
                    let tokenIds = listings.map((l: Listing) => l.collectionId + '_' + l.tokenId).join(',');

                    fetch(`https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens/?tokenIds=${tokenIds}`)
                        .then((response) => response.json())
                        .then((d) => {
                            d.tokens.forEach((data: any) => {
                                const metadata = JSON.parse(data.metadata);
                                tokens.push({
                                    contractId: data.contractId,
                                    tokenId: data.tokenId,
                                    owner: data.owner,
                                    ownerNFD: null,
                                    metadataURI: data.metadataURI,
                                    metadata: metadata,
                                    mintRound: data['mint-round'],
                                    approved: data.approved,
                                    marketData: listings?.find((l: Listing) => l.collectionId === data.contractId && l.tokenId === data.tokenId),
                                    salesData: null,
                                    rank: null,
                                    traits: Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value),
                                });

                            });

                            tokens = tokens;
                        });
                });
        }
    }
    else {
        if ($filters.voiGames) {
            filterCollections = collections.filter((c: Collection) => voiGames.find((v: any) => v.applicationID === c.contractId));
        } else {
            filterCollections = collections;
        }

        filterCollections = filterCollections.filter((c: Collection) => {
            return JSON.parse(c.firstToken?.metadata??"{}")?.name?.toLowerCase().includes(textFilter.toLowerCase());
        });
    }

    $: {
        filterTokens = tokens.filter((t: Token) => {
            return (textFilter == ''
                || t.metadata?.name?.toLowerCase().includes(textFilter.toLowerCase())
                || t.traits?.some(trait => trait.toLowerCase().includes(textFilter.toLowerCase())))
                && ($filters.currency == '*' || t.marketData?.currency === Number($filters.currency));
        });

        if ($filters.voiGames) {
            filterTokens = filterTokens.filter((t: Token) => voiGames.find((v: any) => v.applicationID === t.contractId));
        }

        // apply sort
        if ($sort.by === 'Name') {
            filterTokens = filterTokens.sort((a: Token, b: Token) => a.metadata.name.localeCompare(b.metadata.name));
        } else if ($sort.by === 'Price') {
            filterTokens = filterTokens.sort((a: Token, b: Token) => {
                if (a.marketData?.price && b.marketData?.price) {
                    return a.marketData.price - b.marketData.price;
                } else if (a.marketData?.price) {
                    return -1;
                } else if (b.marketData?.price) {
                    return 1;
                } else {
                    return 0;
                }
            });
        } else if ($sort.by === 'Rank') {
            filterTokens = filterTokens.sort((a: Token, b: Token) => {
                if (a.rank && b.rank) {
                    return a.rank - b.rank;
                } else if (a.rank) {
                    return -1;
                } else if (b.rank) {
                    return 1;
                } else {
                    return 0;
                }
            });
        }

        if ($sort.direction === 'Descending') {
           filterTokens = filterTokens.reverse();
        }

    }

    voiGames.forEach((game: any) => {
        let collection = collections.find((c: Collection) => c.contractId === game.applicationID);
        if (collection) {
            collection.gameData = game;
        }
    });

    function showMore() {
        displayCount += 12;
    }

    let inputElement: HTMLInputElement;
</script>

<div class="flex justify-between">
    <div class="m-4 flex justify-start">
        {#if $filters.forSale}
            <div class="relative inline-flex dark:bg-gray-800">
                <svg class="w-2 h-2 absolute top-0 right-0 m-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 232"><path d="M206 171.144L42.678 7.822c-9.763-9.763-25.592-9.763-35.355 0-9.763 9.762-9.763 25.591 0 35.354l189.21 189.209c9.372 9.373 24.749 9.373 34.121 0l189.21-189.209c9.763-9.763 9.763-25.592 0-35.354-9.763-9.763-25.592-9.763-35.355 0L206 171.144z" fill="#648299" fill-rule="nonzero"/></svg>
                <select bind:value={$sort.by} class="border border-gray-300 rounded-full text-gray-600 h-10 pl-5 pr-10 bg-white hover:border-gray-400 focus:outline-none appearance-none dark:bg-gray-800 dark:text-white">
                    <option>Name</option>
                    <option>Price</option>
                    <option>Rank</option>
                </select>
            </div>
            <div class="relative inline-flex ml-4 dark:bg-gray-800">
                <svg class="w-2 h-2 absolute top-0 right-0 m-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 232"><path d="M206 171.144L42.678 7.822c-9.763-9.763-25.592-9.763-35.355 0-9.763 9.762-9.763 25.591 0 35.354l189.21 189.209c9.372 9.373 24.749 9.373 34.121 0l189.21-189.209c9.763-9.763 9.763-25.592 0-35.354-9.763-9.763-25.592-9.763-35.355 0L206 171.144z" fill="#648299" fill-rule="nonzero"/></svg>
                <select bind:value={$sort.direction} class="border border-gray-300 rounded-full text-gray-600 h-10 pl-5 pr-10 bg-white hover:border-gray-400 focus:outline-none appearance-none dark:bg-gray-800 dark:text-white">
                    <option>Ascending</option>
                    <option>Descending</option>
                </select>
            </div>
            <div class="relative inline-flex ml-4 dark:bg-gray-800">
                <svg class="w-2 h-2 absolute top-0 right-0 m-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 412 232"><path d="M206 171.144L42.678 7.822c-9.763-9.763-25.592-9.763-35.355 0-9.763 9.762-9.763 25.591 0 35.354l189.21 189.209c9.372 9.373 24.749 9.373 34.121 0l189.21-189.209c9.763-9.763 9.763-25.592 0-35.354-9.763-9.763-25.592-9.763-35.355 0L206 171.144z" fill="#648299" fill-rule="nonzero"/></svg>
                <select bind:value={$filters.currency} class="border border-gray-300 rounded-full text-gray-600 h-10 pl-5 pr-10 bg-white hover:border-gray-400 focus:outline-none appearance-none dark:bg-gray-800 dark:text-white">
                    <option value='*'>Any Token</option>
                    {#each currencyList as currency}
                        <option value={currency.id}>{currency.name}</option>
                    {/each}
                </select>
            </div>
        {/if}
    </div>
    <div class="m-4 flex justify-end">
        <div class="relative self-start mr-6">
            <input type="text" placeholder="Search" bind:value={textFilter} bind:this={inputElement} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600 w-full pr-8"/>
            {#if textFilter}
                <button class="absolute inset-y-0 right-0 pr-3 flex items-center" on:click={() => { textFilter = ''; inputElement.focus(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            {/if}
        </div>
        <Switch bind:checked={$filters.forSale} label="For Sale"></Switch>
        <Switch bind:checked={$filters.voiGames} label="Voi Games"></Switch>
    </div>
</div>
<div class="pb-16">
    {#if $filters.forSale && listings}
        <div class="flex flex-wrap justify-center">
            {#each filterTokens.slice(0, displayCount) as token (String(token.contractId) + '_' + String(token.tokenId))}
                <div class="inline-block m-2">
                    <TokenCard token={token} includeCollection={true}></TokenCard>
                </div>
            {/each}
        </div>
        {#if tokens.length > displayCount}
            <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
        {/if}
    {:else}
        <div class="flex flex-wrap justify-center">
            {#each filterCollections.slice(0, displayCount) as collection (collection.contractId)}
                <div class="inline-block">
                    <CollectionComponent styleClass="ml-16 mr-16 mt-16" collection={collection}></CollectionComponent>
                </div>
            {/each}
        </div>
        {#if filterCollections.length > displayCount}
            <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
        {/if}
    {/if}
</div>
<style>
    /*.show-more {
        display: block;
        margin: 40px auto;
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