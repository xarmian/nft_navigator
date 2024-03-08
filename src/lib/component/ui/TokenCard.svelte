<script lang="ts">
    import type { Token, Listing, Currency } from '$lib/data/types';
    import TokenName from './TokenName.svelte';
    import { A, Card } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import { getCurrency } from '$lib/utils/currency';
	import { populateTokenRanking } from '$lib/utils/indexer';

    export let token: Token | null = null;
    export let listing: Listing | null = null;
    export let includeCollection: boolean = false;

    let currency: Currency | null = null;

    onMount(async () => {
        if (listing == null) listing = token?.marketData??null;
        if (listing) {
            if (!token) {
                fetch(`https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens/?contractId=${listing.collectionId}&tokenId=${listing.tokenId}`)
                    .then((response) => response.json())
                    .then((d) => {
                        const data = d.tokens[0];

                        token = {
                            contractId: data.contractId,
                            tokenId: data.tokenId,
                            owner: data.owner,
                            ownerNFD: null,
                            metadataURI: data.metadataURI,
                            metadata: JSON.parse(data.metadata),
                            mintRound: data['mint-round'],
                            approved: data.approved,
                            marketData: null,
                            salesData: null,
                            rank: null,
                            traits: [],
                        };
                    });
            }
            
            currency = await getCurrency(listing.currency);
        }

        if (token) {
            tokenProps = Object.keys(token.metadata.properties).map((key) => {
                return { trait_type: key, value: token?.metadata.properties[key as keyof typeof token.metadata.properties] };
            });

            infourl = (`/collection/${token.contractId}/token/${token.tokenId}`);
            collectionurl = `/collection/${token.contractId}`;
            marketurl = `https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`;

            populateTokenRanking(token.contractId,[token],fetch).then((tokens) => {
                token = tokens[0];
            });
        }
    });

    let tokenProps: any[] = [];
    let flipped = false

    function flip(node: any, {
        delay = 0,
        duration = 500
    }) {
        return {
            delay,
            duration,
            css: (t: number, u: any) => `
                transform: rotateY(${1 - (u * 180)}deg);
                opacity: ${1 - u};
            `
        };
    }

    let infourl = '';
    let marketurl = '';
    let collectionurl = '';
</script>

<div class="card-container" on:mouseenter={() => setTimeout(() => flipped = true,100)} on:mouseleave={() => setTimeout(() => flipped = false,100)}>
    <div class="card">
        {#if token}
            {#if flipped}
                <a class="side cursor-pointer" transition:flip={{}} href={infourl}>
                    <Card class="flex justify-between" style="height: 315px;width:290px;">
                        <div class="overflow-auto h-5/6">
                            <div class="text-2xl font-bold mb-2"><TokenName name={token.metadata.name}></TokenName></div>
                            {#each tokenProps as prop}
                                <div class="text-sm">
                                    <div class="font-bold inline">{prop.trait_type}</div>: {prop.value}
                                </div>
                            {/each}
                            <div class="text-xs mt-2">Owner: {token.owner.slice(0,6)+'...'+token.owner.slice(-8)}</div>
                        </div>
                        <hr class="w-full my-2"/>
                        <div class="flex justify-evenly">
                            <div class="text-center">
                                <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-16 ml-1 mr-1" on:click|stopPropagation={() => window.open(marketurl,'_blank')}>
                                    <i class="fas fa-store" aria-details="Marketplace"></i>
                                    <div class="text-xs">Market <i class="fas fa-external-link-alt"></i></div>
                                </button>
                            </div>
                            <div class="text-center">
                                <a class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-16 ml-1 mr-1 inline-block">
                                    <i class="fas fa-info-circle" aria-details="Info"></i>
                                    <div class="text-xs">Detail</div>
                                </a>
                            </div>
                            {#if includeCollection}
                                <div class="text-center">
                                    <a class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-16 ml-1 mr-1 inline-block" on:click|stopPropagation href={collectionurl}>
                                        <i class="fas fa-file-contract" aria-details="Collection"></i>
                                        <div class="text-xs">Collection</div>
                                    </a>
                                </div>
                            {/if}
                        </div>
                    </Card>
                </a>
            {:else}
            <div class="side back" transition:flip={{}} on:click|stopPropagation>
                <Card padding="none">
                    <div class="image-container relative rounded-t-lg overflow-hidden flex justify-center">
                        <img src={token.metadata.image} alt={token.metadata.name} title={token.metadata.name} class="max-h-72 max-w-72 object-contain object-center"/>
                        {#if token.rank}
                            <div class="absolute bottom-0 left-0 bg-gray-100 dark:bg-gray-400 text-black dark:text-gray-100 p-1 text-xs">
                                <i class="fas fa-medal"></i> {token.rank}
                            </div>
                        {/if}
                        {#if listing && !listing.sale && !listing.delete}
                            {#if currency}
                                <div class="badge top-right"><div>For Sale</div><div class="text-xs">{(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}</div></div>
                            {:else}
                                <div class="badge top-right"><div>For Sale</div><div class="text-xxs">See Marketplace</div></div>
                            {/if}
                        {/if}
                    </div>
                    <div class="text-center"><TokenName name="{token.metadata.name}"/></div>
                </Card>
            </div>
            {/if}
        {/if}
    </div>
</div>
<style>
.image-container {
    position: relative;
}

.text-xxs {
    font-size: 8px;
}

.badge {
    margin: 0;
    padding: 0;
    color: white;
    padding: 1px 10px;
    font-size: 15px;
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
    line-height: normal;
    text-transform: uppercase;
    background: #ed1b24;
}

.badge::before, .badge::after {
    content: '';
    position: absolute;
    top: 0;
    margin: 0 -1px;
    width: 100%;
    height: 100%;
    background: inherit;
    min-width: 55px
}

.badge::before {
    right: 100%
}

.badge::after {
    left: 100%
}

.top-right {
    position: absolute;
    top: 0;
    right: 0;
    -ms-transform: translateX(30%) translateY(0%) rotate(45deg);
    -webkit-transform: translateX(30%) translateY(0%) rotate(45deg);
    transform: translateX(30%) translateY(0%) rotate(45deg);
    -ms-transform-origin: top left;
    -webkit-transform-origin: top left;
    transform-origin: top left;
}

.card-container {
    position: relative;
    height: 330px;
    width: 290px;
}

.card {
    width: 100%;
    height: 100%;
    position: absolute;
    perspective: 600;
}

.side {
    position: absolute;
    height: 100%;
    width: 100%;
    overflow: hidden;
    color: #42529e;
}
</style>