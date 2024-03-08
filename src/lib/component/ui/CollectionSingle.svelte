<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
    import { onMount } from 'svelte';
    import { Card } from 'flowbite-svelte';
    import voiGamesImage from '$lib/assets/voi-games-small.png';
    import { getTokens } from '$lib/utils/indexer';
    import TokenName from './TokenName.svelte';
	import { goto } from '$app/navigation';

    export let collection: Collection;
    export let selectedAddress: string = '';
    const token = collection.firstToken;

    const metadata = JSON.parse(token.metadata);

    let flipped = false;

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

    const data = [
        {
            "icon": "fas fa-id-card",
            "name": "ID",
            "value": collection.contractId
        },
        {
            "icon": "fas fa-cubes",
            "name": "Tokens",
            "value": collection.totalSupply
        },
        {
            "icon": "fas fa-user",
            "name": "Unique Holders",
            "value": collection.uniqueOwners
        }
    ];

</script>

<div class="card-container cursor-pointer m-1" on:mouseenter={() => setTimeout(() => flipped = true,100)} on:mouseleave={() => setTimeout(() => flipped = false,100)}>
    <div class="card">
        {#if token}
            {#if flipped}
                <a class="side back bg-gray-100 dark:bg-gray-900 p-4 rounded-xl" transition:flip={{}} href='/collection/{collection.contractId}'>
                    {#if collection.gameData}
                        <img class="h-12 inline bg-white dark:bg-gray-200 opacity-100 rounded-3xl absolute bottom-2 right-2" src={voiGamesImage} />
                    {/if}
                    <h2 class="text-2xl font-bold mb-2">{metadata.name.replace(/[1#]/g, '')}</h2>
                    {#each data as item}
                        <div class="flex justify-start space-x-2">
                            <i class={item.icon + ' text-gray-400'}></i>
                            <p class="text-sm">{item.name}: {item.value}</p>
                        </div>
                    {/each}
                </a>
            {:else}
                <div class="side back bg-white dark:bg-black relative" transition:flip={{}} on:click|stopPropagation>
                    <div class="image-container relative rounded-lg overflow-hidden flex justify-center">
                        <img src={metadata.image} alt={metadata.name} title={metadata.name.replace(/[1#]/g, '')} class="max-h-60 max-w-60 object-contain object-center"/>
                        <div class="absolute bottom-1 right-1 bg-black bg-opacity-50 text-white text-sm p-1 rounded">
                            {metadata.name.replace(/[1#]/g, '')}
                        </div>
                    </div>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
.image-container {
    position: relative;
}
.card-container {
    position: relative;
    height: 15rem;
    width: 15rem;
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