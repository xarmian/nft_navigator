<script lang="ts">
	import type { PageData } from './$types';
    import { filters } from '../../stores/collection';
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
                || t.traits?.some(trait => trait.toLowerCase().includes(textFilter.toLowerCase())));
        });
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
<div class="pb-16">
    {#if $filters.forSale && listings}
        <div class="flex flex-wrap justify-center">
            {#each filterTokens.slice(0, displayCount) as token (String(token.contractId) + '_' + String(token.tokenId))}
                <div class="inline-block m-2">
                    <TokenCard token={token}></TokenCard>
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