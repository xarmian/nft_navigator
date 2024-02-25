<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
    import { A } from 'flowbite-svelte';
	import { onMount } from 'svelte';
    //@ts-ignore
    import Device from 'svelte-device-info';

    export let token: Token;
    let isMobile = false;
    let formattedOwner = '';
    let collection = {} as Collection;
    let royaltyPercentage = 0;

    onMount(async () => {
        isMobile = Device.isMobile;
    });

    $: {
        getCollection(token.contractId);

        formattedOwner = token.ownerNFD ? token.ownerNFD as string : token.owner.length > 16
            ? `${token.owner.slice(0, 8)}...${token.owner.slice(-8)}`
            : token.owner;

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
    }

    const getCollection = async (contractId: number) => {
        if (contractId) {
            const url = `https://arc72-idx.voirewards.com/nft-indexer/v1/collections/?contractId=${contractId}`;
            try {
                const data = await fetch(url).then((response) => response.json());
                if (data.collections && data.collections.length > 0) {
                    collection = data.collections[0];
                }
            }
            catch(err) {
                console.error(err);
            }
        }
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
        
    const collectionName = token?.metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
</script>
<div class="flex" class:flex-col={isMobile}>
    <img src={token.metadata.image} class="w-72 h-72 mr-3 rounded-xl"/>
    <div class="text-left">
        <div class="mb-2">
            {token.metadata?.description??''}
        </div>
        <div class="text-2xl font-bold mb-2 text-purple-900 dark:text-purple-100"><A href="/collection/{token.contractId}/token/{token.tokenId}">{token.metadata.name}</A></div>
        <div class="mb-2">
            <div>Token ID: {token.tokenId}
            {#if collection}
                / {collection.totalSupply}
            {/if}
            </div>
            <div>Collection: <A href="/collection/{token.contractId}">{collectionName}</A></div>
            <div>Owned by: <A href="/portfolio/{token.owner}">{formattedOwner}</A></div>
            {#if token.approved && token.approved != 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'}
                <div>Approved Spender: <A href="/portfolio/{token.approved}">{formattedApproved}</A></div>
            {/if}
            <div>Mint Round: <A href="https://voi.observer/explorer/block/{token.mintRound}/transactions" target="_blank">{token.mintRound}</A></div>
            {#if royaltyPercentage > 0}
                <div>Royalties: {royaltyPercentage / 100}%</div>
            {/if}
        </div>
        <div class="flex flex-wrap">
            {#each tokenProps as prop}
                <div style="color: {prop.fgcolor}; background-color: {prop.bgcolor}" class="p-2 m-1 text-md rounded-xl">{prop.trait_type}: {prop.value}</div>
            {/each}
        </div>
    </div>
</div>