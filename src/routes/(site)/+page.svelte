<script lang="ts">
	import type { PageData } from './$types';
    import { filters, collectionSort as sort, userPreferences } from '../../stores/collection';
    import type { Collection, Listing, Token } from '$lib/data/types';
    import Switch from '$lib/component/ui/Switch.svelte';
    import { inview } from 'svelte-inview';
    import Select from '$lib/component/ui/Select.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { MetaTags } from 'svelte-meta-tags';
	import MultiCollectionView from '$lib/component/ui/MultiCollectionView.svelte';
    import SecondaryNavBar from '$lib/component/ui/SecondaryNavBar.svelte';
    import { fade, fly } from 'svelte/transition';
    import LoadingSpinner from '$lib/component/ui/LoadingSpinner.svelte'; // You'll need to create this component

    export let data: PageData;
    let collections: Collection[] = data.collections;
    let filterCollections: Collection[] = [];
    let displayCount = 0;
    let cardsPerLoad = 0;
    let textFilter = '';
    let isMounted = false;
    let activeTab = 'all';
    let spInteval: ReturnType<typeof setInterval> | null = null;
    let isLoading = false;

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
            if ($filters.mintable) {
                filterCollections = collections.filter((c: Collection) => {
                    if (c.globalState) {
                        const launchStart = Number(c.globalState.find((gs) => gs.key === 'launchStart')?.value);
                        const launchEnd = Number(c.globalState.find((gs) => gs.key === 'launchEnd')?.value);
                        const totalMinted = Number(c.globalState.find((gs) => gs.key === 'totalMinted')?.value);
                        const maxSupply = Number(c.globalState.find((gs) => gs.key === 'maxSupply')?.value);

                        const currentTime = Math.floor(Date.now() / 1000);
                        return (launchStart === 0 || currentTime >= launchStart) && (launchEnd === 0 || currentTime <= launchEnd) && totalMinted < maxSupply;
                    }
                    return false;
                });
            } else {
                filterCollections = collections;
            }

            filterCollections = filterCollections.filter((c: Collection) => {
                try {
                    if (c.highforgeData) {
                        return c.highforgeData.title.toLowerCase().includes(textFilter.toLowerCase());
                    }
                    return JSON.parse(c.firstToken?.metadata??"{}")?.name?.toLowerCase().includes(textFilter.toLowerCase());
                } catch (e) {
                    return {};
                }
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
        isLoading = true;
        setTimeout(() => {
            displayCount += cardsPerLoad;
            isLoading = false;
        }, 500); // Simulate loading delay
    }

    function handleCollectionClick() {
        isLoading = true;
        // Simulate navigation delay
        setTimeout(() => {
            isLoading = false;
        }, 500);
    }

    let inputElement: HTMLInputElement;
</script>

<MetaTags title="Home | NFT Navigator" />
<div class="container mx-auto px-4 py-8">
    <h1 class="text-4xl font-bold my-8 text-center">Discover NFTs on Voi Network</h1>

    <div class="mb-8">
        <SecondaryNavBar />
    </div>

    <div class="flex flex-col md:flex-row justify-between items-center mb-8">
        <div class="flex space-x-4 mb-4 md:mb-0">
            <button
                class="{activeTab === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} px-4 py-2 rounded-full transition duration-300"
                on:click={() => { activeTab = 'all'; $filters.mintable = false; }}
            >
                All Collections
            </button>
            <button
                class="{activeTab === 'mintable' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'} px-4 py-2 rounded-full transition duration-300"
                on:click={() => { activeTab = 'mintable'; $filters.mintable = true; }}
            >
                Mintable
            </button>
        </div>
        <div class="flex items-center space-x-4">
            <Select options={[{id:'Popularity', name: 'Popularity'},{id: 'Mint', name: 'Mint Date'},{id: 'Name', name: 'Name'},{id: 'Randomize', name: 'Randomize'}]} bind:value={$sort.by} containerClass="w-40" />
            <Select options={[{id: 'Descending', name: 'Descending'},{id: 'Ascending', name: 'Ascending'}]} bind:value={$sort.direction} containerClass="w-40" />
        </div>
    </div>

    <div class="relative mb-8">
        <input
        type="text"
        placeholder="Search collections"
        bind:value={textFilter}
        bind:this={inputElement}
        class="w-full p-4 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    />
    {#if textFilter}
        <button
            class="absolute right-4 top-1/2 transform -translate-y-1/2"
            on:click={() => { textFilter = ''; inputElement.focus(); }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-6 w-6 text-gray-500">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        </button>
    {/if}
    {#if isMounted && filterCollections.length == 0}
        <div class="text-center text-gray-500 mb-4 mt-2">Nothing to see here. Check back soon.</div>
        <div class="w-full h-64 bg-gray-900 relative overflow-hidden rounded-lg mb-8">
                <svg width="100%" height="100%" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
                    <!-- Stars -->
                    <g id="stars">
                        <circle cx="30" cy="30" r="1" fill="white" />
                        <circle cx="70" cy="50" r="1" fill="white" />
                        <circle cx="150" cy="20" r="1" fill="white" />
                        <circle cx="200" cy="40" r="1" fill="white" />
                        <circle cx="280" cy="70" r="1" fill="white" />
                        <circle cx="350" cy="30" r="1" fill="white" />
                    </g>

                    <!-- Spaceship -->
                    <g id="spaceship">
                        <animateTransform
                            attributeName="transform"
                            type="translate"
                            from="0 0"
                            to="0 -200"
                            dur="4s"
                            repeatCount="indefinite"
                        />
                        <path d="M200 140 L180 180 L220 180 Z" fill="#808080" />
                        <rect x="190" y="100" width="20" height="50" fill="#A0A0A0" />
                        <circle cx="200" cy="90" r="20" fill="#C0C0C0" />
                        
                        <!-- Flame -->
                        <path id="flame" d="M195 180 Q200 190 205 180 L200 200 Z" fill="orange">
                            <animate
                                attributeName="opacity"
                                values="1;0;1"
                                dur="0.5s"
                                repeatCount="indefinite"
                            />
                        </path>
                    </g>
                </svg>
            </div>
        {/if}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-y-6 gap-x-6">
        {#if isMounted}
            {#each filterCollections.slice(0, displayCount) as collection (collection.contractId)}
                <div transition:fade>
                    <MultiCollectionView viewType="grid" collections={[collection]} on:click={handleCollectionClick} />
                </div>
            {/each}
        {/if}
    </div>

    {#if isLoading}
        <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div in:fly="{{ y: 50, duration: 300 }}" out:fade="{{ duration: 200 }}">
                <LoadingSpinner />
            </div>
        </div>
    {/if}

    {#if filterCollections.length > displayCount}
        <div class="text-center mt-8">
            <button
                class="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition duration-300"
                on:click={showMore}
            >
                Load More
            </button>
        </div>
    {/if}
</div>