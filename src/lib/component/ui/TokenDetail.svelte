<script lang="ts">
    import type { Token, Collection, Listing, Currency } from '$lib/data/types';
    import TokenName from '$lib/component/ui/TokenName.svelte';
    import { zeroAddress } from '$lib/data/constants';
    import { selectedWallet } from 'avm-wallet-svelte';
	import SendTokenModal from './SendTokenModal.svelte';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { getCurrency } from '$lib/utils/currency';
	import { onMount } from 'svelte';
	import algosdk from 'algosdk';

    export let token: Token;
    export let collection: Collection | undefined;
    export let showOwnerIcon = true;
    export let format = 'small';
    export let listing: Listing | null = null;

    let formattedOwner = '';
    let royaltyPercentage = 0;
    let isTokenOwner = false;
    let isTokenApproved = false;
    let showSendTokenModal = false;
    let sendTokenModalType = 'send';
    let tokenProps: any[] = [];
    let formattedApproved = '';
    let hidden = false;

    $: currency = null as Currency | null;

    async function getMarketData() {
        //if (listing == null) {
            if (token?.marketData) {
                listing = token.marketData;
            }
            else {
                const marketUrl = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings/?collectionId=${token.contractId}&tokenId=${token.tokenId}&active=true`;
                try {
                    const marketData = await fetch(marketUrl).then((response) => response.json());
                    if (marketData.listings.length > 0) {
                        const marketToken = marketData.listings[0];
                        if (marketToken && !marketToken.sale) {
                            // check if token owner == marketToken.seller and mpContract id still approved to sell token
                            if (token.owner === marketToken.seller && token.approved === algosdk.getApplicationAddress(Number(marketToken.mpContractId))) {
                                listing = marketToken;
                            }
                        }
                    }
                }
                catch (e) {
                    console.error(e);
                }

            }
        //}

        if (listing) {
            currency = await getCurrency(listing.currency);
        }
    }

    $: {
        if (token) {
            listing = token?.marketData??null;
            if (token.approved != zeroAddress) {
                getMarketData();
            }

            if ($selectedWallet?.address) {
                isTokenOwner = token.owner === $selectedWallet.address ? true : false;
                isTokenApproved = token.approved === $selectedWallet.address ? true : false;
            }

            if (token.metadata.royalties) {
                const decodedRoyalties = atob(token.metadata.royalties);

                // Convert the binary string to an array of bytes
                const bytes = new Uint8Array(decodedRoyalties.length);
                for (let i = 0; i < decodedRoyalties.length; i++) {
                    bytes[i] = decodedRoyalties.charCodeAt(i);
                }

                // Extract the first two bytes and convert them to a number
                royaltyPercentage = (bytes[0] << 8) | bytes[1];
            }

            // map token.metadata.properties object of the form {"BACKGROUND":"Aquamarine","BODY":"Red","ON BODY":"Scar"}
            // to an array of objects of the form {trait_type: "BACKGROUND", value: "Aquamarine"}
            tokenProps = Object.keys(token.metadata.properties).map((key) => {
                const colors = propColor(token.metadata.properties[key as keyof typeof token.metadata.properties]);
                return { trait_type: key, value: token.metadata.properties[key as keyof typeof token.metadata.properties], fgcolor: colors[1], bgcolor: colors[0]};
            });

            formattedOwner = token.ownerNFD ? token.ownerNFD as string : token.owner.length > 16
                    ? `${token.owner.slice(0, 8)}...${token.owner.slice(-8)}`
                    : token.owner;

            formattedApproved = token.approved ? token.approved.length > 8
                ? `${token.approved.slice(0, 8)}...${token.approved.slice(-8)}`
                : token.approved : '';
        }
    }

    let collectionName = '';
    $: {
        collectionName = collection?.highforgeData?.title ?? token?.metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
        collectionName = collectionName.substring(0, 28) + (collectionName.length > 28 ? '...' : '');
    }

    // return a tuple of the bg color from bgcolor if value is in the bgcolor array, and its corresponding fg color
    // if value is not in the bgcolors array, return a random bgcolor and its corresponding foreground color
    function propColor(value: string) {
        const bgcolors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Cyan', 'Magenta', 'Black', 'White', 'Gray', 'Pink', 'Brown', 'Dark Grey', 'YBG', 'Gold', 'Lavender', 'Aquamarine'];

        // create a list of softer background colors
        const softBgColors = ['#F08080', '#87CEFA', '#90EE90', '#FFFFE0', '#DDA0DD', '#AFEEEE', '#FFC0CB', '#D3D3D3', '#F5F5F5', '#DCDCDC', '#FFB6C1', '#FFE4C4', '#778899',
            '#FFD700',
            '#FFE000',
            '#E6E6FA',
            '#7FFFD4'
        ];

        // create a list of softer foreground colors
        const softFgColors = ['#8B0000', '#00008B', '#006400', '#FFD700', '#4B0082', '#008B8B', '#FF1493', '#696969', '#A9A9A9', '#2F4F4F', '#FF1493', '#A0522D', '#2F4F4F',
            '#8B0000',
            '#8B0000',
            '#8B008B',
            '#006400'
        ];

        const index = bgcolors.includes(value) ? bgcolors.indexOf(value) : Math.floor(Math.random() * bgcolors.length);

        return [softBgColors[index], softFgColors[index]];
    }

    function sendToken() {
        if (isTokenOwner || isTokenApproved) {
            sendTokenModalType = 'send';
            showSendTokenModal = true;
        }
    }

    function approveToken() {
        if (isTokenOwner) {
            sendTokenModalType = 'approve';
            showSendTokenModal = true;
        }
    }

    async function onAfterSend(t: Token) {
        token = t;
    }
</script>
<div class="shadow-md p-3 rounded-xl bg-opacity-10 bg-slate-400 dark:bg-white dark:bg-opacity-10 my-2 relative overflow-hidden h-full"
    class:hidden={hidden} class:p-3={format !== 'small'}>
    <div class="flex flex-col md:flex-row items-center md:items-start h-full" class:space-x-4={format !== 'small'} class:md:flex-col={format === 'small'}>
        <a href="/collection/{token.contractId}/token/{token.tokenId}" class="relative overflow-hidden" class:rounded-xl={format !== 'small'} >
            <img src={token.metadata.image} class="{format === 'small' ? 'w-72 h-72' : 'w-96'} object-contain" />
            {#if listing && !listing.sale && !listing.delete}
                <a href="https://nautilus.sh/#/collection/{token.contractId}/token/{token.tokenId}" on:click|stopPropagation target="_blank" class="absolute top-0 right-0 p-1 text-white rounded-full text-nowrap" title="View on Marketplace">
                    {#if currency}
                        <div class="badge top-right"><div>For Sale</div><div class="text-xs">{(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}</div></div>
                    {:else}
                        <div class="badge top-right"><div>For Sale</div><div class="text-xxs">See Marketplace</div></div>
                    {/if}
                </a>
            {/if}
            {#if showOwnerIcon && token.owner == $selectedWallet?.address}
                <div class="absolute top-0 left-0 p-1 text-green-500 text-3xl" title='Owned by You'>
                    <i class="fas fa-user"></i>
                </div>
            {/if}
        </a>
        <div class="flex justify-between w-full flex-col md:flex-row" class:flex-grow={format === 'small'} class:md:flex-col={format === 'small'}>
            {#if format !== 'small'}
                <div class="text-left flex-grow">
                    <div class="text-2xl font-bold mb-2 text-purple-900 dark:text-purple-100"><a href="/collection/{token.contractId}/token/{token.tokenId}"><TokenName name={token.metadata.name}></TokenName></a></div>
                    <div class="mb-2">
                        {token.metadata?.description??''}
                    </div>
                    <div class="grid-cols-2 gap-x-4 gap-y-2 mb-2 inline-grid">
                        <div class="font-bold">Token ID:</div>
                        <div>{token.tokenId} {#if collection}/ {collection.totalSupply}{/if}</div>
                        <div class="font-bold">Collection:</div>
                        <div><a href="/collection/{token.contractId}">{collectionName}</a></div>
                        {#if token.rank}
                            <div class="font-bold">Ranking:</div>
                            <div>{token.rank}</div>
                        {/if}
                        <div class="font-bold">Owned by:</div>
                        <div>
                            {#if token.isBurned}
                                <span style="font-size: 1.2rem; font-weight: bold; color: red; text-transform: uppercase;">
                                    <i class="fas fa-fire"></i> Burned
                                </span>
                            {:else}
                                <a href="/portfolio/{token.owner}">{formattedOwner}</a>
                            {/if}
                        </div>
                        {#if token.approved && token.approved != zeroAddress}
                            <div class="font-bold">Approved Spender:</div>
                            <div><button on:click={() => goto(`/portfolio/${token.approved}`,{invalidateAll:true})}>{formattedApproved}</button></div>
                        {/if}
                        <div class="font-bold">Mint Round:</div>
                        <div><a href="https://voi.observer/explorer/block/{token.mintRound}/transactions" target="_blank">{token.mintRound}</a></div>
                        {#if royaltyPercentage > 0}
                            <div class="font-bold">Royalties:</div>
                            <div>{royaltyPercentage / 100}%</div>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="side back bg-gray-200 dark:bg-gray-900 relative flex flex-col p-1 h-full">
                    <div class='p-1 flex flex-col flex-grow h-full'>
                        <div class="flex flex-col mb-1 text-sm">
                            <div class="text-sm font-bold"><TokenName name={token.metadata.name}></TokenName></div>
                            <div class="flex justify-between">
                                <div>Collection</div>
                                <a href="/collection/{token.contractId}" class=" text-gray-600 dark:text-gray-300">{collectionName}</a>
                            </div>
                            <div class="flex justify-between">
                                <div>Owner</div>
                                <a href="/portfolio/{token.owner}" on:click|stopPropagation class=" text-gray-600 dark:text-gray-300">{formattedOwner}</a>
                            </div>
                            {#if token.approved && token.approved != zeroAddress}
                                <div class="flex justify-between">
                                    <div>Approved</div>
                                    <a href="/portfolio/{token.approved}" on:click|stopPropagation class=" text-gray-600 dark:text-gray-300">{formattedApproved}</a>
                                </div>
                            {/if}
                            {#if token.rank}
                                <div class="flex justify-between">
                                    <div>Ranking</div>
                                    <div>{token.rank}</div>
                                </div>
                            {/if}
                            {#if royaltyPercentage > 0}
                                <div class="flex justify-between">
                                    <div>Royalties</div>
                                    <div>{royaltyPercentage / 100}%</div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            {/if}
            {#if isTokenOwner || isTokenApproved}
                <div class="justify-self-end flex flex-row space-x-2 {format === 'small' ? 'space-y-0 md:space-x-1 bg-black' : 'm-1 md:space-y-2 md:space-x-0 min-w-48 md:flex-col'}">
                    <button on:click={sendToken} class="flex flex-row items-center px-4 py-2 bg-blue-500 text-white shadow hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-50 transition duration-150 ease-in-out w-full" class:rounded={format !== 'small'}>
                        <i class="fas fa-paper-plane mr-2"></i>
                        Transfer
                    </button>
                    {#if isTokenOwner}
                        <button on:click={approveToken} class="flex flex-row items-center px-4 py-2 bg-blue-500 text-white shadow hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-50 transition duration-150 ease-in-out w-full" class:rounded={format !== 'small'}>
                            <i class="fas fa-coins mr-2"></i>
                            {#if token.approved != zeroAddress}
                                Change
                            {:else}
                                Set
                            {/if}
                            Approval
                        </button>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
    {#if format !== 'small'}
        <div class="flex flex-wrap w-full justify-center md:justify-start">
            {#each tokenProps as prop}
                <div class="p-2 m-1 text-md rounded-xl max-w-56 text-nowrap overflow-ellipsis overflow-hidden" style="color: {prop.fgcolor}; background-color: {prop.bgcolor}">
                    <span class="font-bold">{prop.trait_type}:</span> {prop.value}
                </div>
            {/each}
        </div>
    {/if}
</div>
<SendTokenModal bind:showModal={showSendTokenModal} bind:type={sendTokenModalType} token={token} onAfterSend={onAfterSend} fromAddr={$selectedWallet?.address??''} />
<style>
    a {
        color: #6c63ff;
        text-decoration: underline;
    }
    a:hover {
        color: #9994f2;
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

</style>