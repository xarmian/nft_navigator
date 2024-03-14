<script lang="ts">
    import type { Collection } from '$lib/data/types';
    import CollectionSingle from './CollectionSingle.svelte';

    export let collections: Collection[];
    export let viewType: string = 'row';
</script>

<div class="{viewType == 'grid' ? 'flex flex-wrap py-2 mr-0 ml-0 md:mr-4 md:ml-4 w-full justify-center' : ''}">
    {#each collections as collection (collection.contractId)}
        <CollectionSingle {collection} {viewType} />
    {/each}
</div>
