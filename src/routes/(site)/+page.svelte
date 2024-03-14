<script lang="ts">
	import type { PageData } from './$types';
    import { filters, collectionSort as sort, userPreferences } from '../../stores/collection';
    import type { Collection, Listing, Token } from '$lib/data/types';
    import Switch from '$lib/component/ui/Switch.svelte';
    import { inview } from 'svelte-inview';
    import Select from '$lib/component/ui/Select.svelte';
	import { onMount } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import MultiCollectionView from '$lib/component/ui/MultiCollectionView.svelte';
    
    export let data: PageData;
    let collections: Collection[] = data.collections;
    let filterCollections: Collection[] = [];
    let displayCount = 0;
    let cardsPerLoad = 0;
    let textFilter = '';
    let isMounted = false;

    onMount(async () => {
        isMounted = true;

        // get viewport height
        const viewHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const viewWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        displayCount = Math.ceil(viewHeight / 352) * Math.floor(viewWidth / 240) + 2;
        cardsPerLoad = displayCount;
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

<MetaTags title="Home | NFT Navigator" />
<div class="flex justify-between flex-col md:flex-row">
    <div class="m-2 flex justify-center md:justify-start">
        <Select options={[{id:'Popularity', name: 'Popularity'},{id: 'Mint', name: 'Mint Date'},{id: 'Name', name: 'Name'},{id: 'Randomize', name: 'Randomize'}]} bind:value={$sort.by} containerClass="m-1"></Select>
        <Select options={[{id: 'Descending', name: 'Descending'},{id: 'Ascending', name: 'Ascending'}]} bind:value={$sort.direction} containerClass="m-1"></Select>
    </div>
    <div class="justify-center md:justify-end flex flex-row place-items-center space-x-3 mb-2">
        <div class="relative">
            <!--<input type="text" placeholder="Search" bind:value={textFilter} bind:this={inputElement} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600 w-full pr-8"/>-->
            {#if textFilter}
                <button class="absolute inset-y-0 right-0 pr-3 flex items-center" on:click={() => { textFilter = ''; inputElement.focus(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            {/if}
        </div>
        <div class='flex flex-row'>
            <Switch bind:checked={$filters.voiGames} label="Voi Games"></Switch>
            <Switch bind:checked={$userPreferences.cleanGridView}>
                <i class="fas fa-th"></i>
            </Switch>
        </div>
    </div>
</div>
<div class="pb-16">
    <div class="flex flex-col justify-center">
        {#if isMounted}
            <MultiCollectionView viewType={$userPreferences.cleanGridView ? 'grid' : 'row'} collections={filterCollections.slice(0, displayCount)}></MultiCollectionView>
        {/if}
    </div>
    {#if filterCollections.length > displayCount}
        <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
        <div class="h-64">&nbsp;</div>
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