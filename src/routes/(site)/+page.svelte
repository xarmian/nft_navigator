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
    import LoadingSpinner from '$lib/component/ui/LoadingSpinner.svelte';
    import NFTGamesAd from '$lib/component/ui/NFTGamesAd.svelte';

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
<div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
    <div class="container mx-auto px-4 py-8">
        <!-- Hero Section -->
        <div class="text-center mb-12">
            <h1 class="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Discover NFTs on Voi Network
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
                Explore unique digital collectibles, discover new artists, and join the vibrant Voi NFT community.
            </p>
        </div>

        <NFTGamesAd />

        <!-- Navigation and Filters -->
        <div class="mb-8">
            <SecondaryNavBar />
        </div>

        <!-- Main Controls -->
        <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <div class="flex space-x-4 w-full md:w-auto">
                <button
                    class="{activeTab === 'all' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'} px-6 py-2.5 rounded-xl shadow-sm transition duration-300 font-medium flex items-center gap-2"
                    on:click={() => { activeTab = 'all'; $filters.mintable = false; }}
                >
                    <i class="fas fa-th"></i>
                    All Collections
                </button>
                <button
                    class="{activeTab === 'mintable' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'} px-6 py-2.5 rounded-xl shadow-sm transition duration-300 font-medium flex items-center gap-2"
                    on:click={() => { activeTab = 'mintable'; $filters.mintable = true; }}
                >
                    <i class="fas fa-fire"></i>
                    Mintable
                </button>
            </div>
            <div class="flex items-center space-x-4 w-full md:w-auto">
                <div class="w-30">
                    <Select options={[{id:'Popularity', name: 'Popularity'},{id: 'Mint', name: 'Mint Date'},{id: 'Name', name: 'Name'},{id: 'Randomize', name: 'Randomize'}]} bind:value={$sort.by} />
                </div>
                <div class="w-30">
                    <Select options={[{id: 'Descending', name: 'Descending'},{id: 'Ascending', name: 'Ascending'}]} bind:value={$sort.direction} />
                </div>
            </div>
        </div>

        <!-- Search Bar -->
        <div class="relative mb-8">
            <div class="relative">
                <input
                    type="text"
                    placeholder="Search collections..."
                    bind:value={textFilter}
                    bind:this={inputElement}
                    class="w-full p-4 pl-12 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-300"
                />
                <i class="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                {#if textFilter}
                    <button
                        class="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        on:click={() => { textFilter = ''; inputElement.focus(); }}
                        aria-label="Clear search"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                {/if}
            </div>
        </div>

        <!-- Empty State -->
        {#if isMounted && filterCollections.length == 0}
            <div class="text-center py-16 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div class="text-gray-500 dark:text-gray-400 mb-4">Nothing to see here. Check back soon.</div>
                <div class="w-full h-64 relative overflow-hidden rounded-lg">
                    <svg width="100%" height="100%" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
                        <!-- Stars with animation -->
                        <g id="stars">
                            {#each Array(20) as _, i}
                                <circle 
                                    cx={Math.random() * 400} 
                                    cy={Math.random() * 200} 
                                    r="1" 
                                    fill="white" 
                                    opacity={Math.random()}
                                >
                                    <animate
                                        attributeName="opacity"
                                        values="0;1;0"
                                        dur={2 + Math.random() * 3 + "s"}
                                        repeatCount="indefinite"
                                    />
                                </circle>
                            {/each}
                        </g>

                        <!-- Spaceship with improved animation -->
                        <g id="spaceship">
                            <animateTransform
                                attributeName="transform"
                                type="translate"
                                from="-50 100"
                                to="450 100"
                                dur="8s"
                                repeatCount="indefinite"
                            />
                            <path d="M200 140 L180 180 L220 180 Z" fill="#808080" />
                            <rect x="190" y="100" width="20" height="50" fill="#A0A0A0" />
                            <circle cx="200" cy="90" r="20" fill="#C0C0C0" />
                            
                            <!-- Flame with animation -->
                            <path id="flame" d="M195 180 Q200 190 205 180 L200 200 Z" fill="orange">
                                <animate
                                    attributeName="opacity"
                                    values="1;0.5;1"
                                    dur="0.3s"
                                    repeatCount="indefinite"
                                />
                            </path>
                        </g>
                    </svg>
                </div>
            </div>
        {/if}

        <!-- Collections Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {#if isMounted}
                {#each filterCollections.slice(0, displayCount) as collection (collection.contractId)}
                    <div in:fade={{ duration: 300, delay: 100 }}>
                        <MultiCollectionView viewType="grid" collections={[collection]} on:click={handleCollectionClick} />
                    </div>
                {/each}
            {/if}
        </div>

        <!-- Loading Overlay -->
        {#if isLoading}
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" transition:fade={{ duration: 200 }}>
                <div in:fly="{{ y: 50, duration: 300 }}" out:fade="{{ duration: 200 }}" class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl">
                    <LoadingSpinner />
                </div>
            </div>
        {/if}

        <!-- Load More Button -->
        {#if filterCollections.length > displayCount}
            <div class="text-center mt-12">
                <button
                    class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition duration-300 flex items-center gap-2 mx-auto"
                    on:click={showMore}
                >
                    <i class="fas fa-plus"></i>
                    Load More Collections
                </button>
            </div>
        {/if}
    </div>
</div>

<style>
    /* Add any additional styles here */
    :global(.dark) {
        color-scheme: dark;
    }
</style>