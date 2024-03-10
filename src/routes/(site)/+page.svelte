<script lang="ts">
	import type { PageData } from './$types';
    import { filters, collectionSort as sort, userPreferences } from '../../stores/collection';
    import type { Collection, Listing, Token } from '$lib/data/types';
    import CollectionComponent from '$lib/component/ui/Collection.svelte';
    import CollectionSingle from '$lib/component/ui/CollectionSingle.svelte';
    import Switch from '$lib/component/ui/Switch.svelte';
    import { inview } from 'svelte-inview';
    import Select from '$lib/component/ui/Select.svelte';
	import { onMount } from 'svelte';
    // @ts-ignore
    import Device from 'svelte-device-info';
    
    export let data: PageData;
    let collections: Collection[] = data.collections;
    let filterCollections: Collection[] = [];
    let displayCount = 0;
    let cardsPerLoad = 0;
    let textFilter = '';
    let isMobile = false;
    let isMounted = false;

    onMount(async () => {
        isMounted = true;
        isMobile = Device.isMobile;

        // get viewport height
        const viewHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const viewWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        displayCount = Math.ceil(viewHeight / 352) * Math.floor(viewWidth / 240);
        cardsPerLoad = displayCount;
        console.log('displayCount', displayCount);
    });

    $: {
        if (isMounted) {
            if ($filters.voiGames) {
                filterCollections = collections.filter((c: Collection) => c.gameData);
            } else {
                filterCollections = collections;
            }

            filterCollections = filterCollections.filter((c: Collection) => {
                return JSON.parse(c.firstToken?.metadata??"{}")?.name?.toLowerCase().includes(textFilter.toLowerCase());
            });

            // apply sort.by and sort.direction to filterCollections
            if ($sort.by === 'Randomize') {
                filterCollections = filterCollections.sort(() => Math.random() - 0.5);
            }
            else {
                if ($sort.by === 'Name') {
                    filterCollections = filterCollections.sort((a: Collection, b: Collection) => {
                        return JSON.parse(a.firstToken?.metadata??"{}")?.name.localeCompare(JSON.parse(b.firstToken?.metadata??"{}")?.name);
                    });
                } else if ($sort.by === 'Mint') {
                    filterCollections = filterCollections.sort((a: Collection, b: Collection) => {
                        return a.mintRound - b.mintRound;
                    });
                } else if ($sort.by === 'Popularity') {
                    filterCollections = filterCollections.sort((a: Collection, b: Collection) => {
                        return (a.popularity??0) - (b.popularity??0);
                    });
                }

                if ($sort.direction === 'Descending') {
                    filterCollections = filterCollections.reverse();
                }
            }
            // displayCount = ($userPreferences.cleanGridView) ? 24 : 12;
        }
    }

    function showMore() {
        displayCount += cardsPerLoad;
    }

    let inputElement: HTMLInputElement;
</script>

<div class="flex justify-between {isMobile ? 'flex-col' : 'flex-row'}">
    <div class="m-2 flex justify-start">
        <Select options={[{id:'Popularity', name: 'Popularity'},{id: 'Mint', name: 'Mint Date'},{id: 'Name', name: 'Name'},{id: 'Randomize', name: 'Randomize'}]} bind:value={$sort.by} containerClass="m-1"></Select>
        <Select options={[{id: 'Descending', name: 'Descending'},{id: 'Ascending', name: 'Ascending'}]} bind:value={$sort.direction} containerClass="m-1"></Select>
    </div>
    <div class="justify-end">
        <div class="relative self-start m-2 mr-6">
            <input type="text" placeholder="Search" bind:value={textFilter} bind:this={inputElement} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600 w-full pr-8"/>
            {#if textFilter}
                <button class="absolute inset-y-0 right-0 pr-3 flex items-center" on:click={() => { textFilter = ''; inputElement.focus(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            {/if}
        </div>
        <div class='flex flex-row m-2'>
            <Switch bind:checked={$filters.voiGames} label="Voi Games"></Switch>
            <Switch bind:checked={$userPreferences.cleanGridView}>
                <i class="fas fa-th"></i>
            </Switch>
        </div>
    </div>
</div>
<div class="pb-16">
    <div class="flex flex-wrap justify-center">
        {#if isMounted}
            {#each filterCollections.slice(0, displayCount) as collection (collection.contractId)}
                <div class="inline-block">
                    {#if $userPreferences.cleanGridView}
                        <CollectionSingle collection={collection}></CollectionSingle>
                    {:else}
                        <CollectionComponent styleClass='ml-14 mr-14 mt-8 mb-24' collection={collection}></CollectionComponent>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
    {#if filterCollections.length > displayCount}
        <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
    {/if}
</div>
<style>
    .sentinel {
        height: 1px;
        width: 100%;
    }
    @media (max-width: 600px) {

    }
</style>