<script lang="ts">
    import type { Collection } from '$lib/data/types';
    import CollectionSingle from './CollectionSingle.svelte';
    import { createEventDispatcher } from 'svelte';

    export let collections: Collection[];
    export let viewType: string = 'row';

    const dispatch = createEventDispatcher();

    function handleClick() {
        dispatch('click');
    }
</script>

<div class="{viewType == 'grid' ? 'flex w-full justify-center' : ''}">
    {#each collections as collection (collection.contractId)}
        <div on:click={handleClick}>
            <CollectionSingle {collection} {viewType} />
        </div>
    {/each}
</div>
