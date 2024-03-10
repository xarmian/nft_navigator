<script lang="ts">
    import type { Collection } from '$lib/data/types';
    import voiGamesImage from '$lib/assets/voi-games-small.png';

    export let collection: Collection;
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

<div class="card-container cursor-pointer rounded-xl overflow-hidden m-1" >
    <div class="card">
        {#if token}
            <a href="/collection/{collection.contractId}">
                <div class="side back bg-gray-200 dark:bg-gray-900 relative rounded-lg flex flex-col">
                    <div class="image-container relative overflow-hidden flex justify-center bg-gray-10 dark:bg-black">
                        <img src={metadata.image} alt={metadata.name} title={metadata.name.replace(/[1#]/g, '')} class="max-h-60 h-60 max-w-60 object-contain object-center"/>
                    </div>
                    <div class='p-2 flex flex-col flex-grow'>
                        <div class="flex justify-between space-x-1">
                            <div class="text-sm font-bold">{metadata.name.replace(/[1#]/g, '')}</div>
                            <a href="/portfolio/{collection.creator}" on:click|stopPropagation class="text-xs text-gray-600 dark:text-gray-300">{collection.creator.slice(0,6)+'...'+collection.creator.slice(-8)}</a>
                        </div>
                        <div class="content-end flex-grow">
                            {#each data as item}
                                <div class="flex justify-start space-x-2 text-gray-700 dark:text-gray-200">
                                    <i class={item.icon + ' text-gray-600 dark:text-gray-400'}></i>
                                    <p class="text-sm">{item.name}: {item.value}</p>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </a>
        {/if}
    </div>
</div>

<style>
.image-container {
    position: relative;
}
.card-container {
    position: relative;
    height: 22rem;
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
}
</style>