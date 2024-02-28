<script lang="ts">
	import type { PageData } from './$types';
    import type { Collection, Token } from '$lib/data/types';
    import CollectionComponent from '$lib/component/ui/Collection.svelte';
    
    export let data: PageData;
    let collections: Collection[] = data.collections;
    let displayCount = 12;

    function showMore() {
        displayCount += 12;
    }
</script>

<div>
    <div class="flex flex-wrap justify-center">
        {#each collections.slice(0, displayCount) as collection (collection.contractId)}
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