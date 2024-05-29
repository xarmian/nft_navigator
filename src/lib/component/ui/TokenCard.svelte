<script lang="ts">
    import type { Token, Listing, Currency } from '$lib/data/types';
    import TokenName from './TokenName.svelte';
    import { A, Card } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import { getCurrency } from '$lib/utils/currency';
	import { getTokens, populateTokenRanking } from '$lib/utils/indexer';
	import { selectedWallet } from 'avm-wallet-svelte';
	import { getTokenImageUrl } from '$lib/utils/functions';

    export let token: Token | null = null;
    export let listing: Listing | null = null;
    // export let includeCollection: boolean = false;

    let currency: Currency | null = null;

    onMount(async () => {
        if (listing == null) listing = token?.marketData??null;
        if (listing) {
            if (!token) {
                token = await getTokens({ contractId: listing.collectionId, fetch }).then((tokens) => {
                    return tokens[0];
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

<div class="card-container">
    <div class="card">
        {#if token}
            <a class="side cursor-pointer" href={infourl}>
                <Card padding="none">
                    <div class="image-container relative rounded-t-lg overflow-hidden flex justify-center">
                        <img src={getTokenImageUrl(token,240)} alt={token.metadata.name} title={token.metadata.name} class="h-72 max-h-72 max-w-72 object-contain object-center"/>
                        {#if token.rank}
                            <div class="absolute bottom-0 left-0 bg-gray-100 dark:bg-gray-400 text-black dark:text-gray-100 p-1 text-xs">
                                <i class="fas fa-medal"></i> {token.rank}
                            </div>
                        {/if}
                        {#if token.isBurned}
                            <div class="absolute top-0 right-0 p-1 text-red-500 text-3xl" title='Token Burned'>
                                <i class="fas fa-fire"></i>
                            </div>
                        {/if}
                        {#if token.owner == $selectedWallet?.address}
                            <div class="absolute top-0 left-0 p-1 text-green-500 text-3xl" title='Owned by You'>
                                <i class="fas fa-user"></i>
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
            </a>
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
    transition: transform 0.3s ease-out;
}

.card-container:hover {
    position: relative;
    transform: scale(1.04);
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