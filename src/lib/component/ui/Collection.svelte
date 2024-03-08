<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
	import { onMount } from 'svelte';
    import { Card } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
    import voiGamesImage from '$lib/assets/voi-games-small.png';
    import { getTokens } from '$lib/utils/indexer';

    export let collection: Collection;
    export let selectedAddress: string = '';
    export let styleClass = '';
    let tokens: Token[] = [];

    onMount(() => {
        getTokens({ contractId: collection.contractId, owner: selectedAddress, limit: 3 }).then((data: Token[]) => {
            tokens = data;
        });
    });
</script>

<div class="relative cursor-pointer transform hover:scale-110 transition-transform duration-200">
    <a href={`/collection/${collection.contractId}`}>
        {#if tokens && tokens.length >= 1}
            <div class="{styleClass}">
                <div class="flex justify-center -space-x-36 group-hover:-space-x-48 transition-all duration-500">
                    <div class="transform -rotate-12 z-30 max-w-48 max-h-48 object-contain">
                        <Card padding="none" class="rounded-xl">
                            <img src={tokens[0].metadata.image} class="rounded-xl h-60 w-60 object-cover" />
                        </Card>
                    </div>
                    <div class="z-20 max-w-48 max-h-48 object-contain">
                        <Card padding="none" class="rounded-xl">
                            {#if tokens.length >= 2}
                                <img src={tokens[1].metadata.image} class="rounded-xl h-60 w-60 object-cover" />
                            {:else}
                                <div class="w-48 h-48"></div>
                            {/if}
                        </Card>
                    </div>
                    <div class="transform rotate-12 z-10 max-h-48 max-w-48 object-contain">
                        <Card padding="none" class="rounded-xl">
                            {#if tokens.length >= 3}
                                <img src={tokens[2].metadata.image} class="rounded-xl h-60 w-60 object-cover" />
                            {:else}
                                <div class="w-48 h-48"></div>
                            {/if}
                        </Card>
                    </div>
                </div>    
            </div>
            <div class="absolute -top-4 right-0 bg-black bg-opacity-70 text-white p-4 z-40 rounded-md">
                {#if collection.gameData}
                    <div class="voi-games-logo z-10"><img class="h-8 bg-lime-300 opacity-50 rounded-tr-md" src={voiGamesImage} /></div>
                {/if}
                <div class="z-20">
                    <div>{tokens[0].metadata.name.replace(/[1#]/g, '')}</div>
                    <div>ID: {tokens[0].contractId}</div>
                    <div>Tokens: {collection.totalSupply}</div>
                    <div>Unique holders: {collection.uniqueOwners}</div>
                </div>
            </div>
        {/if}
    </a>
</div>

<style>
    img {
        max-width: unset;
    }
    .voi-games-logo {
        position: absolute;
        top:0;
        right:0;
    }
</style>