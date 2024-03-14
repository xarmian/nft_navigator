<script lang="ts">
	import { goto } from '$app/navigation';
    import type { Collection } from '$lib/data/types';
    import { getCollections } from '$lib/utils/indexer';
    import { onMount } from 'svelte';
    import { recentSearch } from '../../../stores/collection';
    
    let collections: Collection[] = [];
    let search = '';
    let selected = 0;
    let showRecent = false;
    let filteredCollections: Collection[] = [];
    let recentSearchValue: Collection[] = [];

    onMount(async () => {
        collections = await getCollections({ fetch });

        window.addEventListener('keydown', handleKeydown);
        window.addEventListener('click', handleClickOutside);
    });

    recentSearch.subscribe(value => {
        recentSearchValue = value;
    });

    function handleClickOutside(event: MouseEvent) {
        // @ts-expect-error - event
        if (!event.target.closest('.collectionSearchComponent')) {
            showRecent = false;
        }
    }
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
            selected = Math.min(selected + 1, filteredCollections.length - 1);
        } else if (event.key === 'ArrowUp') {
            selected = Math.max(selected - 1, 0);
        } else if (event.key === 'Enter') {
            const selectedCollection = filteredCollections[selected];
            if (selectedCollection) {
                gotoCollection(selectedCollection.contractId);
            }
        }
    }

    function gotoCollection(contractId: number) {
        const c = collections.find(collection => collection.contractId === contractId);
    
        if (c) {
            goto(`/collection/${contractId}`);
            search = '';
            showRecent = false;
            selected = 0;

            recentSearchValue = [c, ...recentSearchValue.filter(r => r.contractId !== c.contractId)];
            recentSearchValue = recentSearchValue.slice(0, 5);
            recentSearch.set(recentSearchValue);
        }
    }

    function doShowRecent(doshow: boolean) {
        if (recentSearchValue.length > 0) showRecent = doshow;
        if (!doshow) {
            search = '';
            selected = 0;
        }
    }

    $: {
        if (showRecent && search == '') {
            filteredCollections = recentSearchValue;
        } else {
            filteredCollections = (search.length >= 2) ? collections.filter(collection => collection.highforgeData?.title.toUpperCase().includes(search.toUpperCase())) : [];
        }
    }
</script>

<div class="relative collectionSearchComponent">
    <input type="text" on:focus={() => doShowRecent(true)} bind:value={search} placeholder="Search collections..." class="p-2 w-full border rounded-md bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 text-black dark:text-white" />
    {#if filteredCollections.length > 0 || showRecent}
        <ul class="absolute right-0 md:left-0 bg-white dark:bg-gray-800 border rounded-md mt-0.5 w-80 max-h-80 overflow-auto shadow-md z-50">
            {#each filteredCollections as collection, index (collection.contractId)}
                <li class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-black dark:text-white {selected === index ? 'bg-blue-200 dark:bg-blue-700' : ''}">
                    <button on:click={() => gotoCollection(collection.contractId)} class="flex flex-row space-x-2 w-full">
                        <img src={collection.highforgeData?.coverImageURL} class="w-8 h-8 rounded-md mr-2" alt={collection.highforgeData?.title} />
                        <div class="flex-grow inline-flex text-left">
                            {collection.highforgeData?.title}
                        </div>
                        <div class="place-items-end">
                            {collection.contractId}
                        </div>
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>