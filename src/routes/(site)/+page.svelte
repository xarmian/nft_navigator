<script lang="ts">
	import type { PageData } from './$types';
	import { MetaTags } from 'svelte-meta-tags';
	import { fade, fly } from 'svelte/transition';
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Collection, Token } from '$lib/data/types';
	import { recentSearch } from '../../stores/collection';
	import { searchEnvoi, type EnvoiSearchResult, getEnvoiNames } from '$lib/utils/envoi';
    import NFTGamesAd from '$lib/component/ui/NFTGamesAd.svelte';
    import MultiCollectionView from '$lib/component/ui/MultiCollectionView.svelte';
	import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
	import { getImageUrl } from '$lib/utils/functions';
    import CreatorCard from '$lib/component/ui/CreatorCard.svelte';
    // Add import for mimir utilities if needed
    import { getCollections } from '$lib/utils/mimir';

    export let data: PageData;
	let searchText = '';
	let isSearchOpen = false;
	let selected = 0;
	let collections: Collection[] = data.collections;
	let filteredCollections: Collection[] = [];
	let filteredWallets: EnvoiSearchResult[] = [];
	let componentElement: HTMLElement;
    let featuredCollections: Collection[] = collections.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 4);
    let mintCount = data.mintCount;
    let recentMintTokens: Token[] = data.recentMintTokens;

    // Add debounce variables for search
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastSearch = '';
    let currentController: AbortController | null = null;

    interface FeaturedCreator {
        address: string;
        name: string;
        metadata: {
            avatar?: string;
            description?: string;
            url?: string;
            'com.twitter'?: string;
        };
        collections: Collection[];
    }

    let featuredCreators: FeaturedCreator[] = [];
    let isLoadingCreators = true;

    async function loadFeaturedCreators() {
        try {
            // Get unique creators from collections
            const uniqueCreators = new Map<string, FeaturedCreator>();
            collections.forEach(collection => {
                if (!uniqueCreators.has(collection.creator)) {
                    uniqueCreators.set(collection.creator, {
                        address: collection.creator,
                        name: collection.creatorName || collection.creator,
                        metadata: {},
                        collections: []
                    });
                }
                uniqueCreators.get(collection.creator)!.collections.push(collection);
            });

            // Convert to array and sort by number of collections
            const allCreators = Array.from(uniqueCreators.values())
                .sort((a, b) => b.collections.length - a.collections.length);

            // Randomly select 4 creators from the top 12 (to ensure we get popular creators but still have variety)
            const topCreators = allCreators.slice(0, 12);
            const shuffled = [...topCreators].sort(() => Math.random() - 0.5);
            const selectedCreators = shuffled.slice(0, 4);

            // Get Envoi metadata for all creators
            const creatorAddresses = selectedCreators.map(c => c.address);
            const envoiResults = await getEnvoiNames(creatorAddresses);

            // Merge Envoi metadata with creator objects
            featuredCreators = selectedCreators.map(creator => {
                const envoiData = envoiResults.find(n => n.address === creator.address);
                if (envoiData) {
                    creator.name = envoiData.name;
                    creator.metadata = envoiData.metadata || {};
                }
                return creator;
            });
        } catch (error) {
            console.error('Error processing featured creators:', error);
            featuredCreators = [];
        } finally {
            isLoadingCreators = false;
        }
    }

	onMount(async () => {
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('click', handleClickOutside);
            await loadFeaturedCreators();
        }
	});

	onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleKeydown);
            window.removeEventListener('click', handleClickOutside);
        }
        
        // Clear any pending timeout when component is destroyed
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Abort any pending request
        if (currentController) {
            currentController.abort();
        }
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.search-component')) {
			isSearchOpen = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isSearchOpen) return;

		const totalItems = filteredCollections.length + filteredWallets.length;
		if (totalItems === 0) return;

		if (event.key === 'ArrowDown') {
			selected = (selected + 1) % totalItems;
			event.preventDefault();
			scrollToSelected();
		} else if (event.key === 'ArrowUp') {
			selected = (selected - 1 + totalItems) % totalItems;
			event.preventDefault();
			scrollToSelected();
		} else if (event.key === 'Enter') {
			if (selected < filteredCollections.length) {
				gotoCollection(filteredCollections[selected].contractId);
			} else {
				const walletIndex = selected - filteredCollections.length;
				gotoPortfolio(filteredWallets[walletIndex].address);
			}
		} else if (event.key === 'Escape') {
			isSearchOpen = false;
		}
	}

	// Add function to scroll the selected item into view
	function scrollToSelected() {
		// Use setTimeout to ensure the DOM has updated with the new selected item
		setTimeout(() => {
			const resultsContainer = document.querySelector('.search-results-container');
			if (!resultsContainer) return;
			
			let selectedElement: Element | null = null;
			
			if (selected < filteredCollections.length) {
				// It's a collection
				selectedElement = resultsContainer.querySelector(`.collections-list button:nth-of-type(${selected + 1})`);
			} else {
				// It's a wallet
				const walletIndex = selected - filteredCollections.length;
				selectedElement = resultsContainer.querySelector(`.wallets-list button:nth-of-type(${walletIndex + 1})`);
			}
			
			if (selectedElement) {
				// Scroll the element into view
				selectedElement.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest'
				});
			}
		}, 0);
	}

	function handleSearchClick() {
		isSearchOpen = true;
	}

	function gotoCollection(contractId: number) {
		const collection = collections.find(c => c.contractId === contractId);
		if (collection) {
			goto(`/collection/${contractId}`);
			searchText = '';
			isSearchOpen = false;
			selected = 0;

			// Update recent searches
			recentSearch.update(searches => {
				const newSearches = [collection, ...searches.filter(s => s.contractId !== collection.contractId)];
				return newSearches.slice(0, 5);
			});
		}
	}

	function gotoPortfolio(wallet: string) {
		goto(`/portfolio/${wallet}`);
		searchText = '';
		isSearchOpen = false;
		selected = 0;
		filteredWallets = [];
	}

    // Reactive search
	function performSearch(query: string) {
        // Clear any existing timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // If search is empty, clear results immediately
        if (query.length < 2) {
            filteredCollections = [];
            filteredWallets = [];
            return;
        }
        
        // Store the current search query
        lastSearch = query;
        
        // Set a timeout to perform the actual search
        searchTimeout = setTimeout(() => {
            // Only perform search if this is still the latest query
            if (query === lastSearch) {
                // Search collections
                filteredCollections = collections.filter(collection => 
                    collection.name?.toLowerCase().includes(query.toLowerCase()) 
                    || collection.contractId.toString().toLowerCase().includes(query.toLowerCase())
                    || collection.highforgeData?.description?.toLowerCase().includes(query.toLowerCase())
                    || collection.metadata?.toLowerCase()?.includes(query.toLowerCase())
                );

                // Search wallets
                if (query.length === 58) {
                    filteredWallets = [{ address: query, name: query, metadata: {} }];
                } else {
                    // Cancel any previous request
                    if (currentController) {
                        currentController.abort();
                    }
                    
                    // Create a new controller for this request
                    currentController = new AbortController();
                    
                    // Use the imported searchEnvoi
                    searchEnvoi(query).then((data) => {
                        // Only update if this is still the latest query
                        if (query === lastSearch) {
                            filteredWallets = data;
                        }
                    }).catch(error => {
                        // Handle errors
                        console.error('Search error:', error);
                        // Don't update filteredWallets if there was an error
                    });
                }
            }
        }, 300); // 300ms debounce delay
    }
    
    // Call performSearch whenever searchText changes
    $: performSearch(searchText);
</script>

<MetaTags title="NFT Navigator | Explore NFTs on Voi Network" />

<div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
    <!-- Hero Section -->
    <section class="relative overflow-hidden pt-16 sm:pt-20">
        <div class="container mx-auto px-4">
            <div class="text-center max-w-4xl mx-auto">
                <h1 class="text-5xl sm:text-6xl font-bold mb-6 pb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Your Gateway to Digital Art
                </h1>
                <p class="text-gray-600 dark:text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
                    Discover, collect, and trade unique NFTs on the Voi Network. Join a vibrant community of creators and collectors.
                </p>
            </div>
        </div>
    </section>

    <!-- Search Section -->
    <section class="py-6 container mx-auto px-4">
        <div class="max-w-4xl mx-auto">
            <div class="relative">
                <div class="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl transform -rotate-1"></div>
                <div class="relative bg-white dark:bg-gray-800 rounded-2xl px-2 py-8 sm:px-8 shadow-xl">
                    <h2 class="text-2xl font-semibold mb-6 text-gray-900 dark:text-white text-center">Search Anything</h2>
                    <div class="relative search-component" bind:this={componentElement}>
                        <input
                            type="text"
                            placeholder="Search collections, enVoi names, or wallet addresses..."
                            bind:value={searchText}
                            on:click={handleSearchClick}
                            on:input={() => { isSearchOpen = true; }}
                            class="w-full p-4 pl-12 pr-12 text-lg border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-300"
                        />
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg class="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        {#if searchText}
                            <button
                                class="absolute inset-y-0 right-0 pr-4 flex items-center"
                                on:click={() => { searchText = ''; }}
                                aria-label="Clear search"
                            >
                                <svg class="h-6 w-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        {/if}
                    </div>
                    {#if isSearchOpen && (filteredCollections.length > 0 || filteredWallets.length > 0)}
                        <div class="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50 search-results-container">
                            {#if filteredCollections.length > 0}
                                <div class="p-2">
                                    <div class="text-sm font-medium text-gray-500 dark:text-gray-400 px-3 py-2">Collections</div>
                                    <div class="collections-list">
                                        {#each filteredCollections as collection, index (collection.contractId)}
                                            <button
                                                class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center space-x-3 {selected === index ? 'bg-blue-50 dark:bg-blue-900/50' : ''}"
                                                on:click={() => gotoCollection(collection.contractId)}
                                            >
                                                <img src={getImageUrl(collection.imageUrl ?? '',32)} class="w-10 h-10 rounded-lg" alt={collection.name} />
                                                <div class="flex-grow w-3/4">
                                                    <div class="flex justify-between">
                                                        <div class="font-medium text-gray-900 dark:text-white">{collection.name}</div>
                                                        <div class="text-sm text-gray-500 dark:text-gray-400">Collection #{collection.contractId}</div>
                                                    </div>
                                                    {#if collection.highforgeData?.description || collection.metadata}
                                                        <div class="hidden md:block text-sm text-gray-500 dark:text-gray-400 truncate">
                                                            {#if collection.highforgeData?.description}
                                                                {collection.highforgeData.description}
                                                            {:else if collection.metadata}
                                                                {collection.metadata}
                                                            {/if}
                                                        </div>
                                                    {/if}
                                                </div>
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                            {#if filteredWallets.length > 0}
                                <div class="p-2 {filteredCollections.length > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}">
                                    <div class="text-sm font-medium text-gray-500 dark:text-gray-400 px-3 py-2">Wallets</div>
                                    <div class="wallets-list">
                                        {#each filteredWallets as wallet, index (wallet.address)}
                                            <button
                                                class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center space-x-3 {selected === (filteredCollections.length + index) ? 'bg-blue-50 dark:bg-blue-900/50' : ''}"
                                                on:click={() => gotoPortfolio(wallet.address)}
                                            >
                                                <div class="w-10 h-10 rounded-lg overflow-hidden">
                                                    {#if wallet.metadata?.avatar}
                                                        <img src={wallet.metadata.avatar} alt={wallet.name} class="w-full h-full object-cover" />
                                                    {:else}
                                                        <div class="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
                                                            {wallet.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                    {/if}
                                                </div>
                                                <div class="flex-grow">
                                                    <div class="font-medium text-gray-900 dark:text-white">{wallet.name}</div>
                                                    <div class="text-sm text-gray-500 dark:text-gray-400">{wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}</div>
                                                </div>
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}
                    <div class="mt-4 flex-wrap gap-2 justify-center hidden">
                        <span class="text-sm text-gray-500 dark:text-gray-400">Popular searches:</span>
                        <button class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" on:click={() => searchText = 'pixel'}>pixel</button>
                        <button class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" on:click={() => searchText = 'game'}>game</button>
                        <button class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" on:click={() => searchText = 'art'}>art</button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Statistics Section -->
    <section class="py-12 bg-gradient-to-r from-blue-600/5 to-purple-600/5 dark:from-blue-900/20 dark:to-purple-900/20 hidden">
        <div class="container mx-auto px-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <!-- Total Collections -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                    <div class="bg-blue-100 dark:bg-blue-900 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                        <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Total Collections</h3>
                    <p class="text-3xl font-bold text-blue-600 dark:text-blue-400">{collections.length}</p>
                </div>

                <!-- Total Creators -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                    <div class="bg-purple-100 dark:bg-purple-900 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                        <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Total Creators</h3>
                    <p class="text-3xl font-bold text-purple-600 dark:text-purple-400">{new Set(collections.map(c => c.creator)).size}</p>
                </div>

                <!-- New Mints (24h) -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                    <div class="bg-green-100 dark:bg-green-900 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                        <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">New Mints (24h)</h3>
                    <p class="text-3xl font-bold text-green-600 dark:text-green-400">{mintCount}</p>
                </div>
            </div>
        </div>
    </section>

    <!-- NFTGamesAd -->
    <!--<section class="py-8 container mx-auto px-4">
        <NFTGamesAd />
    </section>-->

    <!-- Featured Creators -->
    <section class="py-16 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 dark:from-purple-900/30 dark:to-indigo-900/30">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Featured Creators</h2>
                <p class="text-gray-600 dark:text-gray-300 text-lg">
                    Meet the talented artists and developers shaping the Voi Network NFT ecosystem
                </p>
            </div>
            {#if isLoadingCreators}
                <div class="flex justify-center items-center py-12">
                    <div class="flex gap-2">
                        {#each Array(3) as _, i}
                            <div class="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style="animation-delay: {i * 200}ms"></div>
                        {/each}
                    </div>
                </div>
            {:else}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {#each featuredCreators as creator}
                        <CreatorCard {creator} />
                    {/each}
                </div>
            {/if}
        </div>
    </section>

    <!-- Featured Collections -->
    <section class="py-16 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-900/30 dark:to-purple-900/30">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Featured Collections</h2>
                <p class="text-gray-600 dark:text-gray-300 text-lg">
                    Discover the most popular and trending NFT collections on Voi Network
                </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {#each featuredCollections as collection (collection.contractId)}
                    <div class="transform hover:scale-105 transition-transform duration-200">
                        <MultiCollectionView viewType="grid" collections={[collection]} />
                    </div>
                {/each}
            </div>
            <div class="text-center mt-12">
                <a href="/collection" class="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl">
                    View All Collections
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </a>
            </div>
        </div>
    </section>

    <!-- Features Grid -->
    <section class="py-16 container mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <!-- Collections Feature -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                <div class="bg-blue-100 dark:bg-blue-900 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                    <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Browse Collections</h3>
                <p class="text-gray-600 dark:text-gray-300 mb-6">Explore a diverse range of NFT collections from talented artists and creators on the Voi Network.</p>
                <a href="/collection" class="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center">
                    View Collections
                    <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </a>
            </div>

            <!-- Analytics Feature -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                <div class="bg-purple-100 dark:bg-purple-900 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                    <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Market Analytics</h3>
                <p class="text-gray-600 dark:text-gray-300 mb-6">Track market trends, collection performance, and trading activity with our comprehensive analytics tools.</p>
                <a href="/analytics" class="text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 dark:hover:text-purple-300 inline-flex items-center">
                    View Analytics
                    <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </a>
            </div>

            <!-- Portfolio Feature -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                <div class="bg-green-100 dark:bg-green-900 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                    <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Your Portfolio</h3>
                <p class="text-gray-600 dark:text-gray-300 mb-6">Track your NFT holdings, monitor their value, and manage your digital art collection in one place.</p>
                <a href="/portfolio" class="text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-300 inline-flex items-center">
                    View Portfolio
                    <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                </a>
            </div>
        </div>
    </section>

    <!-- Recent Mints Section -->
    <section class="py-16 bg-gradient-to-r from-blue-600/5 to-purple-600/5 dark:from-blue-900/20 dark:to-purple-900/20">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Recent Mints</h2>
                <p class="text-gray-600 dark:text-gray-300 text-lg">
                    Latest NFTs minted across all collections
                </p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 place-items-center">
                {#each recentMintTokens as token}
                    <TokenDetail token={token} collection={collections.find(c => c.contractId === token.contractId)} shape="square" />
                {/each}
            </div>
        </div>
    </section>

    <!-- Essential Resources Section -->
    <section class="py-16 bg-white dark:bg-gray-800">
        <div class="container mx-auto px-4">
            <div class="text-center mb-12">
                <h2 class="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Essential Resources</h2>
                <p class="text-gray-600 dark:text-gray-300 text-lg">
                    Everything you need to get started with Voi Network
                </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <!-- Getting Started Card -->
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                    <div class="bg-blue-500 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Getting Started</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-6">New to Voi? Learn how to set up your wallet and start your journey into NFTs.</p>
                    <a href="https://ecosystem.voi.network/pages/getting-started/users" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center">
                        Set Up Your Wallet
                        <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </a>
                </div>

                <!-- Voi Fountain Card -->
                <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-gray-700 dark:to-gray-600 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                    <div class="bg-purple-500 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Voi Fountain</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-6">Get free Voi tokens to start your journey. Perfect for new users wanting to explore the network.</p>
                    <a href="https://fountain.voirewards.com" target="_blank" rel="noopener noreferrer" class="text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 dark:hover:text-purple-300 inline-flex items-center">
                        Get Free Voi
                        <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </a>
                </div>

                <!-- Voi Rewards Card -->
                <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-700 dark:to-gray-600 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-200">
                    <div class="bg-green-500 rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-6">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Voi Rewards</h3>
                    <p class="text-gray-600 dark:text-gray-300 mb-6">Learn about running nodes and earning rewards. Access comprehensive resources for node operators.</p>
                    <a href="https://voirewards.com" target="_blank" rel="noopener noreferrer" class="text-green-600 dark:text-green-400 font-medium hover:text-green-700 dark:hover:text-green-300 inline-flex items-center">
                        Explore Node Running
                        <svg class="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20">
        <div class="container mx-auto px-4">
            <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 text-center">
                <h2 class="text-3xl sm:text-4xl font-bold text-white mb-6">Ready to Start Your NFT Journey?</h2>
                <p class="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                    Join Voi Network's vibrant NFT community today. Discover unique digital art, connect with creators, and build your collection.
                </p>
                <div class="flex flex-col sm:flex-row gap-4 justify-center">
                    <a href="/collection" class="inline-flex items-center justify-center px-8 py-4 text-lg font-medium bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all duration-200 shadow-lg hover:shadow-xl">
                        Browse Collections
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    </section>
</div>

<style>
    /* Add any additional styles here */
    :global(.dark) {
        color-scheme: dark;
    }
</style>
