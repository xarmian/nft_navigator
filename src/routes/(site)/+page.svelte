<script lang="ts">
	import type { PageData } from './$types';
    import { showVoiGamesOnly } from '../../stores/collection';
    import type { Collection, Token } from '$lib/data/types';
    import CollectionComponent from '$lib/component/ui/Collection.svelte';
    import Switch from '$lib/component/ui/Switch.svelte';
    
    export let data: PageData;
    let collections: Collection[] = data.collections;
    let filterCollections: Collection[] = [];
    let displayCount = 12;

    let voiGames: object[] = data.voiGames;

    $: {
        if ($showVoiGamesOnly) {
            filterCollections = collections.filter((c: Collection) => voiGames.find((v: any) => v.applicationID === c.contractId));
        } else {
            filterCollections = collections;
        }
    
    }

    voiGames.forEach((game: any) => {
        let collection = collections.find((c: Collection) => c.contractId === game.applicationID);
        if (collection) {
            collection.gameData = game;
        }
    });

    function showMore() {
        displayCount += 12;
    }
</script>

<div class="m-4 flex justify-end">
    <Switch bind:checked={$showVoiGamesOnly} label="Voi Games"></Switch>
</div>      
<div>
    <div class="flex flex-wrap justify-center">
        {#each filterCollections.slice(0, displayCount) as collection (collection.contractId)}
            <div class="inline-block">
                <CollectionComponent styleClass="ml-16 mr-16 mt-16" collection={collection}></CollectionComponent>
            </div>
        {/each}
    </div>
    {#if collections.length > displayCount}
        <button on:click={showMore} class="show-more">Show More</button>
    {/if}
</div>
<style>
    .show-more {
        display: block;
        margin: 40px auto;
        padding: 10px 20px;
        font-size: 16px;
        color: white;
        background-color: #007BFF;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    .show-more:hover {
        background-color: #0056b3;
    }
</style>