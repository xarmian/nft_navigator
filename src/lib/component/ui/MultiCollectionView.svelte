<script lang="ts">
    import type { Collection } from '$lib/data/types';
    import CollectionSingle from './CollectionSingle.svelte';

    export let collections: Collection[];
    export let viewType: string = 'row';
</script>

<div class="{viewType == 'grid' ? 'flex w-full justify-center' : ''}">
    {#each collections as collection (collection.contractId)}
        <CollectionSingle {collection} {viewType} />
    {/each}
</div>
