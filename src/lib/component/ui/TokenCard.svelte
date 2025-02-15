<script lang="ts">
    import type { Token, Listing, Currency } from '$lib/data/types';
    import TokenName from './TokenName.svelte';
    import { A, Card } from 'flowbite-svelte';
	import { onMount } from 'svelte';
	import { getCurrency } from '$lib/utils/currency';
	import { getTokens, populateTokenRanking } from '$lib/utils/indexer';
	import { selectedWallet } from 'avm-wallet-svelte';
	import { getTokenImageUrl } from '$lib/utils/functions';
	import { isLoading } from '../../../stores/loading';
	import { goto } from '$app/navigation';
    import { resolveEnvoiToken } from '$lib/utils/envoi';

    export let token: Token | null = null;
    export let listing: Listing | null = null;
    // export let includeCollection: boolean = false;

    let currency: Currency | null = null;
    let imageLoaded = false;
    let imageUrl: string;

    // Memoize token props to avoid recalculation
    let tokenProps: any[] = [];
    let flipped = false

    onMount(async () => {
        if (!token) return;

        // Set image URL immediately
        imageUrl = getTokenImageUrl(token, 480) ?? '';

        // Preload image
        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            imageLoaded = true;
        };

        if (listing == null) listing = token?.marketData??null;
        if (listing) {
            if (!token) {
                token = await getTokens({ contractId: listing.collectionId, fetch }).then((tokens) => {
                    return tokens[0];
                });
            }
            
            currency = await getCurrency(listing.currency);
        }

        if (token && token.metadata) {
            tokenProps = Object.keys(token.metadata.properties).map((key) => {
                if (token && token.metadata) {
                    return { trait_type: key, value: token?.metadata.properties[key as keyof typeof token.metadata.properties] };
                }
            });
        }

        if (token) {
            infourl = (`/collection/${token.contractId}/token/${token.tokenId}`);
            collectionurl = `/collection/${token.contractId}`;
            marketurl = `https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`;
        }

        // Only populate ranking if not already present
        if (token && !token.rank) {
            populateTokenRanking(token.contractId,[token],fetch).then((tokens) => {
                token = tokens[0];
            });
        }

        if (token && token.contractId === 797609) {
            const envoiResults = await resolveEnvoiToken([token.tokenId]);
            token.metadata = {
                ...token.metadata,
                envoiName: envoiResults[0].name || token.metadata.name,
                image: envoiResults[0].metadata.avatar || token.metadata.image
            };
        }
    });

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

    function handleClick(event: MouseEvent) {
        event.preventDefault();
        isLoading.set(true);
        goto(infourl).then(() => {
            isLoading.set(false);
        });
    }
</script>

<div class="card-container">
    <div class="card">
        {#if token}
            <button class="side cursor-pointer" on:click={handleClick}>
                <Card padding="none">
                    <div class="image-container relative rounded-t-lg overflow-hidden flex justify-center">
                        {#if imageUrl}
                            <img
                                src={imageUrl}
                                alt={token.metadata?.name}
                                title={token.metadata?.name}
                                class="h-72 max-h-72 max-w-72 object-contain object-center transition-opacity duration-300"
                                class:opacity-0={!imageLoaded}
                                class:opacity-100={imageLoaded}
                            />
                            {#if !imageLoaded}
                                <div class="absolute inset-0 bg-gray-100 dark:bg-gray-800 animate-pulse"></div>
                            {/if}
                        {/if}
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
                    <div class="text-center">
                        {#if token.contractId === 797609}
                            {token.metadata?.envoiName}
                        {:else}
                            <TokenName name="{token.metadata?.name??String(token.tokenId)}" tokenId={token.tokenId}/>
                        {/if}
                    </div>
                </Card>
            </button>
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