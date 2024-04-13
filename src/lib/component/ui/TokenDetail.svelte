<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
    import TokenName from '$lib/component/ui/TokenName.svelte';
    import { zeroAddress } from '$lib/data/constants';
    import { selectedWallet } from 'avm-wallet-svelte';
    import { onDestroy } from 'svelte';
	import SendTokenModal from './SendTokenModal.svelte';
	import Select from './Select.svelte';
	import { getTokens } from '$lib/utils/indexer';

    export let token: Token;
    export let collection: Collection | undefined;
    let formattedOwner = '';
    let royaltyPercentage = 0;
    let isTokenOwner = false;
    $: showSendTokenModal = false;

    const unsub = selectedWallet.subscribe((value) => {
        if (value?.address && token.owner === value.address) {
            isTokenOwner = true;
        }
    });

    onDestroy(() => {
        unsub();
    });

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

    $: {
        formattedOwner = token.ownerNFD ? token.ownerNFD as string : token.owner.length > 16
                ? `${token.owner.slice(0, 8)}...${token.owner.slice(-8)}`
                : token.owner;
    }

    let tokenProps: any[] = [];
    // map token.metadata.properties object of the form {"BACKGROUND":"Aquamarine","BODY":"Red","ON BODY":"Scar"}
    // to an array of objects of the form {trait_type: "BACKGROUND", value: "Aquamarine"}
    tokenProps = Object.keys(token.metadata.properties).map((key) => {
        const colors = propColor(token.metadata.properties[key as keyof typeof token.metadata.properties]);
        return { trait_type: key, value: token.metadata.properties[key as keyof typeof token.metadata.properties], fgcolor: colors[1], bgcolor: colors[0]};
    });

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

    let formattedApproved = token.approved ? token.approved.length > 8
        ? `${token.approved.slice(0, 8)}...${token.approved.slice(-8)}`
        : token.approved : '';
        
    const collectionName = collection?.highforgeData?.title ?? token?.metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';

    function sendToken() {
        if (isTokenOwner) {
            showSendTokenModal = true;
        }
    }

    async function sendTokenModalClose(didSend: boolean, addr: string | undefined) {
        // reload token data
        //console.log(token);
        //const t = await getTokens({contractId: token.contractId, tokenId: token.tokenId, invalidate: true});
        //isTokenOwner = ($selectedWallet?.address && t[0].owner === $selectedWallet?.address) ? true : false;
        isTokenOwner = !didSend;
        if (addr) token.owner = addr;
    }
</script>
<div class="shadow-2xl p-3 rounded-xl bg-opacity-10 bg-black dark:bg-white dark:bg-opacity-10 my-2 relative">
    <div class="flex flex-col md:flex-row items-center md:items-start">
        <img src={token.metadata.image} class="max-w-72 object-contain mr-3 rounded-xl"/>
        <div class="flex justify-between w-full">
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
                        <div><a href="/portfolio/{token.approved}">{formattedApproved}</a></div>
                    {/if}
                    <div class="font-bold">Mint Round:</div>
                    <div><a href="https://voi.observer/explorer/block/{token.mintRound}/transactions" target="_blank">{token.mintRound}</a></div>
                    {#if royaltyPercentage > 0}
                        <div class="font-bold">Royalties:</div>
                        <div>{royaltyPercentage / 100}%</div>
                    {/if}
                </div>
            </div>
            {#if isTokenOwner}
                <div class="m-1 justify-self-end">
                    <button on:click={sendToken} class="flex flex-row flex-nowrap items-center px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-50 transition duration-150 ease-in-out w-24">
                        <i class="fas fa-paper-plane mr-2"></i>
                        Send Token
                    </button>
                </div>
            {/if}
        </div>
    </div>
    <div class="flex flex-wrap w-full justify-center md:justify-start">
        {#each tokenProps as prop}
            <div class="p-2 m-1 text-md rounded-xl max-w-56 text-nowrap overflow-ellipsis overflow-hidden" style="color: {prop.fgcolor}; background-color: {prop.bgcolor}">
                <span class="font-bold">{prop.trait_type}:</span> {prop.value}
            </div>
        {/each}
    </div>
</div>
<SendTokenModal bind:showModal={showSendTokenModal} token={token} fromAddr={$selectedWallet?.address??''} onClose={sendTokenModalClose} />
<style>
    a {
        color: #6c63ff;
        text-decoration: underline;
    }
    a:hover {
        color: #9994f2;
    }
</style>