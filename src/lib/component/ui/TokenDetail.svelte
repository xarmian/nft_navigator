<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
    import TokenName from '$lib/component/ui/TokenName.svelte';
	import { populateTokenRanking } from '$lib/utils/indexer';
    import { zeroAddress } from '$lib/data/constants';

    export let token: Token;
    let formattedOwner = '';
    let collection: Collection;
    let royaltyPercentage = 0;

    $: {
        if (!collection) {
            getCollection(token.contractId);

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

        formattedOwner = token.ownerNFD ? token.ownerNFD as string : token.owner.length > 16
                ? `${token.owner.slice(0, 8)}...${token.owner.slice(-8)}`
                : token.owner;

    }

    const getCollection = async (contractId: number) => {
        if (contractId) {
            const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/collections/?contractId=${contractId}`;
            try {
                const data = await fetch(url).then((response) => response.json());
                if (data.collections && data.collections.length > 0) {
                    collection = data.collections[0];
                }
            }
            catch(err) {
                console.error(err);
            }

            // get ranking data for the token
            populateTokenRanking(token.contractId,[token],fetch).then((tokens) => {
                token = tokens[0];
            });
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
<div class="flex flex-col md:flex-row items-start">
    <img src={token.metadata.image} class="max-w-72 object-contain mr-3 rounded-xl"/>
    <div class="text-left flex-grow">
        <div class="mb-2">
            {token.metadata?.description??''}
        </div>
        <div class="text-2xl font-bold mb-2 text-purple-900 dark:text-purple-100"><a href="/collection/{token.contractId}/token/{token.tokenId}"><TokenName name={token.metadata.name}></TokenName></a></div>
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
            <div><a href="/portfolio/{token.owner}">{formattedOwner}</a></div>
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
</div>
<div class="flex flex-wrap w-full">
    {#each tokenProps as prop}
        <div class="p-2 m-1 text-md rounded-xl max-w-56 text-nowrap overflow-ellipsis overflow-hidden" style="color: {prop.fgcolor}; background-color: {prop.bgcolor}">
            <span class="font-bold">{prop.trait_type}:</span> {prop.value}
        </div>
    {/each}
</div>
