<script lang="ts">
	import type { PageData } from './$types';
    import { filters } from '../../stores/collection';
    import type { Collection, Listing, Token } from '$lib/data/types';
    import CollectionComponent from '$lib/component/ui/Collection.svelte';
    import TokenCard from '$lib/component/ui/TokenCard.svelte';
    import Switch from '$lib/component/ui/Switch.svelte';
    import { onDestroy } from 'svelte';
    
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
</script>

<div class="m-4 flex justify-end">
    <input type="text" placeholder="Search" bind:value={textFilter} class="self-start mr-6 p-2 border border-gray-300 rounded-lg dark:bg-gray-600"/>
    <Switch bind:checked={$filters.forSale} label="For Sale"></Switch>
    <Switch bind:checked={$filters.voiGames} label="Voi Games"></Switch>
</div>      
<div>
    {#if $filters.forSale && listings}
        <div class="flex flex-wrap justify-center">
            {#each filterTokens.slice(0, displayCount) as token (String(token.contractId) + '_' + String(token.tokenId))}
                <div class="inline-block m-2">
                    <TokenCard token={token}></TokenCard>
                </div>
            {/each}
        </div>
        {#if tokens.length > displayCount}
            <button on:click={showMore} class="show-more">Show More</button>
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
            <button on:click={showMore} class="show-more">Show More</button>
        {/if}
    {/if}
</div>
<style>
    .show-more {
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
    }
</style>