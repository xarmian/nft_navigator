<script lang="ts">
	import { goto } from '$app/navigation';
    import type { Token, Listing, Currency } from '$lib/data/types';
    import { A, Card } from 'flowbite-svelte';
	import { onMount } from 'svelte';
    import { arc200 as Contract } from "ulujs";
	import { algodClient, algodIndexer } from '$lib/utils/algod';

    export let token: Token | null = null;
    export let listing: Listing | null = null;

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
                        };
                    });
            }
            
            if (listing.currency == 0) {
                currency = {
                    id: 0,
                    name: 'Voi',
                    symbol: 'VOI',
                    decimals: 6,
                };
            }
            else {
                const ctc = new Contract(Number(listing.currency), algodClient, algodIndexer);
                const decimals = await ctc.arc200_decimals();
                const name = await ctc.arc200_name();
                const symbol = await ctc.arc200_symbol();

                currency = {
                    id: listing.currency,
                    name: (name.success) ? name.returnValue : '',
                    symbol: (symbol.success) ? symbol.returnValue : '',
                    decimals: (decimals.success) ? Number(decimals.returnValue) : 0,
                };
            }
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
    let contracturl = '';
    $: {
        if (token) {
            tokenProps = Object.keys(token.metadata.properties).map((key) => {
                return { trait_type: key, value: token?.metadata.properties[key as keyof typeof token.metadata.properties] };
            });

            infourl = `/collection/${token.contractId}/token/${token.tokenId}`;
            marketurl = `https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`;
            contracturl = `https://voi.observer/explorer/application/${token.contractId}/transactions`;
        }
    }
</script>

<div class="card-container" on:mouseenter={() => setTimeout(() => flipped = true,100)} on:mouseleave={() => setTimeout(() => flipped = false,100)}>
    <div class="card">
        {#if token}
            {#if flipped}
                <div class="side cursor-pointer" transition:flip={{}} on:click={() => goto(infourl)}>
                    <Card class="flex justify-between" style="height: 270px; width:240px;">
                        <div class="overflow-auto h-5/6">
                            <div class="text-2xl font-bold mb-2"><A on:click={() => goto(infourl)}>{token.metadata.name}</A></div>
                            {#each tokenProps as prop}
                                <div class="text-sm">
                                    <div class="font-bold inline">{prop.trait_type}</div>: {prop.value}
                                </div>
                            {/each}
                        </div>
                        <hr class="w-full my-2"/>
                        <div class="flex justify-between">
                            <div class="text-center">
                                <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-14" on:click|stopPropagation={() => window.open(marketurl,'_blank')}>
                                    <i class="fas fa-store" aria-details="Marketplace"></i>
                                    <div class="text-xs">Market</div>
                                </button>
                            </div>
                            <div class="text-center">
                                <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-14" on:click|stopPropagation={() => goto(infourl)}>
                                    <i class="fas fa-info-circle" aria-details="Info"></i>
                                    <div class="text-xs">Detail</div>
                                </button>
                            </div>
                            <div class="text-center">
                                <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-14" on:click|stopPropagation={() => window.open(contracturl,'_blank')}>
                                    <i class="fas fa-file-contract" aria-details="Contract"></i>
                                    <div class="text-xs">Contract</div>
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            {:else}
            <div class="side back" transition:flip={{}} on:click|stopPropagation>
                <Card padding="none">
                    <div class="image-container">
                        <img src={token.metadata.image} alt={token.metadata.name} title={token.metadata.name} class="rounded-t-lg"/>
                        {#if listing && !listing.sale && !listing.delete}
                            {#if currency}
                                <div class="badge top-right"><div>For Sale</div><div class="text-xs">{(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.symbol}</div></div>
                            {:else}
                                <div class="badge top-right"><div>For Sale</div><div class="text-xxs">See Marketplace</div></div>
                            {/if}
                        {/if}
                    </div>
                    <div class="text-center">{token.metadata.name}</div>
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
    height: 280px;
    width: 240px;
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