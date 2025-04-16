<script lang="ts">
	import { goto } from '$app/navigation';
    import type { Collection } from '$lib/data/types';
    import { onDestroy, onMount } from 'svelte';
    import { getEnvoiAddresses, searchEnvoi, type EnvoiSearchResult } from '$lib/utils/envoi';
    import { getAddressesForNFD } from '$lib/utils/nfd';
    import { page } from '$app/stores';
    import { writable } from 'svelte/store';
	import { getImageUrl } from '$lib/utils/functions';
    import { mimirCollectionsStore } from '../../../stores/mimirCollections';

    interface RecentSearchItem {
        type: 'collection' | 'wallet';
        data: Collection | EnvoiSearchResult;
    }

    export let expandDirection: 'left' | 'right' = 'left';

    let collections: Collection[] = [];
    let search = '';
    let selected = 0;
    let showRecent = false;
    let filteredCollections: Collection[] = [];
    let recentSearchValue: RecentSearchItem[] = [];
	let windowDefined = false;
    let filteredWallets: EnvoiSearchResult[] = [];
    let isOpen = false;
    export let isExpanded = false;
    let viewing: 'analytics' | 'lounge' | null = null;
    let searchInputRef: HTMLInputElement;
    let isSearching = false;
    let hasMoreResults = false;
    let totalResults = 0;
    let resultsContainer: HTMLElement; // Reference to the results container for scrolling
    let previousSearch = ''; // Track the previous search query
    let showNoResults = false; // Track when we should show a "no results" message
    
    // Debounce implementation for search
    let searchTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastSearch = '';

    // Update the store type
    const recentSearch = writable<RecentSearchItem[]>([]);

    // Add this with your other variables
    let currentController: AbortController | null = null;

    // Svelte action to handle scroll
    function scrollHandler(node: HTMLElement) {
        const handleScroll = () => {
            const threshold = 100; // 100px from bottom
            if (node.scrollHeight - node.scrollTop - node.clientHeight < threshold) {
                loadMoreResults();
            }
        };
        
        node.addEventListener('scroll', handleScroll);
        
        return {
            destroy() {
                node.removeEventListener('scroll', handleScroll);
            }
        };
    }

    onMount(async () => {
        windowDefined = typeof window !== 'undefined';
        if (windowDefined) {
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('click', handleClickOutside);
        }
    });

    const unsubP = page.subscribe(value => {
        if (value.url.pathname.includes('/analytics') && !value.url.pathname.includes('/portfolio')) {
            viewing = 'analytics';
        }
        else if (value.url.pathname.includes('/lounge') && !value.url.pathname.includes('/collection')) {
            viewing = 'lounge';
        }
        else {
            viewing = null;
        }
    });

    const unsub = recentSearch.subscribe(value => {
        // Convert legacy format to new format if needed
        recentSearchValue = value.map(item => {
            if ('contractId' in item && 'highforgeData' in item) {
                return { type: 'collection' as const, data: item as unknown as Collection };
            }
            if ('address' in item && 'name' in item) {
                return { type: 'wallet' as const, data: item as unknown as EnvoiSearchResult };
            }
            return item;
        });
    });

	onDestroy(() => {
		if (windowDefined) {
            window.removeEventListener('keydown', handleKeydown);
            window.removeEventListener('click', handleClickOutside);
        }
        unsub();
        unsubP();
        
        // Clear any pending timeout when component is destroyed
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
	});

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.collectionSearchComponent')) {
            isOpen = false;
            isExpanded = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        // Only handle navigation keys if search is expanded and open
        if (!isExpanded || !isOpen) return;
        
        const maxIndex = Math.max(filteredCollections.length + filteredWallets.length - 1, 0);
        
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // Prevent default to stop cursor movement in input
            event.preventDefault();
            
            const previousSelected = selected;
            
            if (event.key === 'ArrowDown') {
                selected = Math.min(selected + 1, maxIndex);
            } else {
                selected = Math.max(selected - 1, 0);
            }
            
            // Only scroll if the selection actually changed
            if (previousSelected !== selected) {
                // Use setTimeout to ensure the DOM has updated with the new selected item
                setTimeout(() => scrollToSelected(), 0);
            }
        } else if (event.key === 'Enter') {
            if (filteredCollections.length > 0 && selected < filteredCollections.length) {
                const selectedCollection = filteredCollections[selected];
                if (selectedCollection) {
                    gotoCollection(selectedCollection.contractId);
                }
            } else if (filteredWallets.length > 0) {
                const adjustedIndex = Math.max(0, selected - filteredCollections.length);
                if (adjustedIndex < filteredWallets.length) {
                    gotoPortfolio(filteredWallets[adjustedIndex]);
                }
            }
        }
    }
    
    // Function to scroll the selected item into view
    function scrollToSelected() {
        if (!resultsContainer) return;
        
        // Find the selected element
        let selectedElement: Element | null = null;
        
        if (selected < filteredCollections.length) {
            // It's a collection
            selectedElement = resultsContainer.querySelector(`.collections-list li:nth-child(${selected + 1})`);
        } else {
            // It's a wallet
            const walletIndex = selected - filteredCollections.length;
            selectedElement = resultsContainer.querySelector(`.wallets-list li:nth-child(${walletIndex + 1})`);
        }
        
        if (selectedElement) {
            // Scroll the element into view
            selectedElement.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    }

    function gotoCollection(contractId: number) {
        console.log("Navigating to collection", contractId);
        
        // For recent search items, we need to get the collection from recentSearchValue
        let c: Collection | undefined = filteredCollections.find(collection => collection.contractId === contractId);
        
        if (!c) {
            console.log("Collection not found in filtered collections, checking recent search");
            // Try to find in recent searches if not in filtered results
            const recentItem = recentSearchValue.find(item => 
                item.type === 'collection' && (item.data as Collection).contractId === contractId
            );
            if (recentItem && recentItem.type === 'collection') {
                c = recentItem.data as Collection;
                console.log("Found in recent search:", c);
            }
        }
    
        if (c) {
            console.log("Navigating to collection with data:", c);
            switch(viewing) {
                case 'analytics':
                    goto(`/analytics/collection/${contractId}`);
                    break;
                case 'lounge':
                    goto(`/lounge/${contractId}`);
                    break;
                default: 
                    goto(`/collection/${contractId}`);
                    break;
            }

            search = '';
            showRecent = false;
            selected = 0;
            isExpanded = false;

            const newItem: RecentSearchItem = { type: 'collection', data: c };
            recentSearchValue = [newItem, ...recentSearchValue.filter(r => 
                !(r.type === 'collection' && (r.data as Collection).contractId === c.contractId)
            )];
            recentSearchValue = recentSearchValue.slice(0, 5);
            recentSearch.set(recentSearchValue);
        } else {
            console.error("Could not find collection with ID:", contractId);
        }
    }

    function gotoPortfolio(wallet: EnvoiSearchResult) {
        console.log("Navigating to portfolio", wallet.address);
        goto(`/portfolio/${wallet.address}`);
        search = '';
        showRecent = false;
        selected = 0;
        filteredWallets = [];
        isExpanded = false;

        const newItem: RecentSearchItem = { type: 'wallet', data: wallet };
        recentSearchValue = [newItem, ...recentSearchValue.filter(r => 
            !(r.type === 'wallet' && (r.data as EnvoiSearchResult).address === wallet.address)
        )];
        recentSearchValue = recentSearchValue.slice(0, 5);
        recentSearch.set(recentSearchValue);
    }

    function doShowRecent(doshow: boolean) {
        console.log("doShowRecent", doshow, recentSearchValue.length);
        if (recentSearchValue.length > 0) {
            showRecent = doshow;
            // Make sure dropdown is visible when showing recent searches
            if (doshow) {
                isOpen = true;
            }
        }
        if (!doshow) {
            search = '';
            selected = 0;
        }
    }

    function doClearRecent() {
        recentSearch.set([]);
        recentSearchValue = [];
        showRecent = false;
    }
    
    // Load more results when scrolling down or clicking "Load more"
    async function loadMoreResults() {
        if (hasMoreResults && !isSearching) {
            isSearching = true;
            
            try {
                const result = await mimirCollectionsStore.loadMore();
                // Append new collections instead of replacing
                filteredCollections = [...filteredCollections, ...result.collections.filter(newItem => 
                    !filteredCollections.some(existing => existing.contractId === newItem.contractId)
                )];
                hasMoreResults = result.hasMore;
                totalResults = result.totalCount;
            } catch (error) {
                console.error('Error loading more results:', error);
            } finally {
                isSearching = false;
            }
        }
    }
    
    // Updated search function using Mimir
    async function performSearch(query: string) {
        // Clear any existing timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        
        // Check if the search query has changed
        const searchChanged = previousSearch !== query;
        previousSearch = query;
        
        // Reset selected index when search changes
        if (searchChanged) {
            selected = 0;
            showNoResults = false;
        }
        
        // If search is empty, clear results immediately
        if (query === '') {
            filteredWallets = [];
            filteredCollections = [];
            showNoResults = false;
            if (isExpanded) {
                showRecent = true;
            }
            return;
        }
        
        // Store the current search query
        lastSearch = query;
        
        // Set a timeout to perform the actual search
        searchTimeout = setTimeout(async () => {
            // Only perform search if this is still the latest query
            if (query === lastSearch) {
                showRecent = false;
                isSearching = true;
                showNoResults = false;
                
                try {
                    // Handle collection searching using Mimir API
                    if (query.length >= 2) {
                        const result = await mimirCollectionsStore.fetchCollections({ 
                            name: query,
                            reset: true,
                            limit: 10 
                        });
                        
                        filteredCollections = result.collections;
                        hasMoreResults = result.hasMore;
                        totalResults = result.totalCount;
                    } else {
                        filteredCollections = [];
                        hasMoreResults = false;
                        totalResults = 0;
                    }
                    
                    // Handle wallet search 
                    if (query.length == 58) {
                        filteredWallets = [{ address: query, name: query, metadata: {} }];
                    }
                    else if (query.length >= 2) {
                        // Cancel any previous request
                        if (currentController) {
                            currentController.abort();
                        }
                        
                        // Create a new controller for this request
                        currentController = new AbortController();
                        
                        // Use the imported searchEnvoi directly
                        searchEnvoi(query).then((data) => {
                            // Only update if this is still the latest query
                            if (query === lastSearch) {
                                filteredWallets = data;
                                // Show no results message if no collections and no wallets found
                                showNoResults = filteredCollections.length === 0 && data.length === 0 && query.length >= 2;
                            }
                        }).catch(error => {
                            if (error.name !== 'AbortError') {
                                console.error('Search error:', error);
                            }
                            // Check for no results even if wallet search fails
                            showNoResults = filteredCollections.length === 0 && filteredWallets.length === 0 && query.length >= 2;
                        });
                    }
                    else {
                        filteredWallets = [];
                    }
                    
                    // After all searches are done, check if we have any results
                    showNoResults = filteredCollections.length === 0 && filteredWallets.length === 0 && query.length >= 2;
                    
                } catch (error) {
                    console.error('Error searching collections:', error);
                    filteredCollections = [];
                    hasMoreResults = false;
                    totalResults = 0;
                    showNoResults = query.length >= 2;
                } finally {
                    isSearching = false;
                }
            }
        }, 300); // 300ms debounce delay
    }
    
    $: performSearch(search);

    // Function to clear search text without collapsing the search box
    function clearSearch() {
        search = '';
        searchInputRef?.focus();
        showRecent = true;
        isOpen = true;
    }

    function handleInputClick() {
        isExpanded = true;
        isOpen = true;
        if (search === '') {
            doShowRecent(true);
        }
    }

    function toggleSearch() {
        isExpanded = !isExpanded;
        if (isExpanded) {
            // Focus the input after expansion
            setTimeout(() => {
                searchInputRef?.focus();
                isOpen = true;
                doShowRecent(true);
            }, 100);
        } else {
            // Reset search when collapsing
            search = '';
            isOpen = false;
        }
    }
</script>

<div class="relative collectionSearchComponent">
    <!-- Container with fixed width to prevent layout shifts -->
    <div class="relative w-10 h-10">
        <!-- Search Icon Button -->
        <button 
            onclick={toggleSearch}
            class="absolute z-10 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-opacity duration-200 ease-in-out {isExpanded ? 'opacity-0' : 'opacity-100'}"
            aria-label="Open search"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </button>

        <!-- Search Input Container -->
        <div 
            class="absolute transition-all duration-300 ease-in-out"
            class:left-0={expandDirection === 'right'}
            class:right-0={expandDirection === 'left'}
            style="
                width: {isExpanded ? 'min(400px, calc(100vw - 32px))' : '40px'}; 
                opacity: {isExpanded ? '1' : '0'}; 
                transform-origin: {expandDirection === 'left' ? 'right' : 'left'};
                transform: scaleX({isExpanded ? '1' : '0'});
            "
        >
            <div class="relative flex items-center w-full">
                <input 
                    bind:this={searchInputRef}
                    type="text" 
                    onclick={(e) => { e.stopPropagation(); handleInputClick(); }}
                    bind:value={search} 
                    placeholder="Search collection, enVoi, address..." 
                    class="p-2 pl-10 w-full h-10 border rounded-full bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 text-black dark:text-white shadow-sm"
                />
                <!-- Search icon in input -->
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    class="absolute left-3 h-5 w-5 text-gray-400" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                
                <!-- Button area -->
                <div class="absolute right-2 flex space-x-1">
                    <!-- Clear button - only shown when there's text -->
                    {#if search.length > 0}
                        <button 
                            onclick={clearSearch}
                            class="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                            aria-label="Clear search"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    {/if}
                    
                    <!-- Close button - always shown when expanded -->
                    {#if isExpanded}
                        <button 
                            onclick={(e) => {
                                console.log('CLOSE button clicked');
                                e.stopPropagation();
                                toggleSearch();
                            }}
                            class="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none"
                            aria-label="Close search"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Dropdown Results -->
            {#if isOpen && ((filteredCollections.length > 0 || (showRecent && recentSearchValue.length > 0) || filteredWallets.length > 0) || isSearching || showNoResults)}
                <ul 
                    bind:this={resultsContainer}
                    use:scrollHandler
                    class="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl mt-2 w-full max-h-80 overflow-auto shadow-lg z-50 divide-y divide-gray-100 dark:divide-gray-700"
                    class:right-0={expandDirection === 'left'}
                    class:left-0={expandDirection === 'right'}
                >
                    <!-- Recent Searches Section -->
                    {#if showRecent && recentSearchValue.length > 0}
                        <div class="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Recent Searches</div>
                        {#each recentSearchValue as item, index}
                            {#if item.type === 'collection'}
                                {@const collection = item.data as Collection}
                                <li class="group">
                                    <button 
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            console.log("Clicked recent collection", collection.contractId);
                                            gotoCollection(collection.contractId);
                                        }}
                                        class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                    >
                                        <img 
                                            src={getImageUrl(collection.imageUrl ?? collection.highforgeData?.coverImageURL ?? '', 32)} 
                                            class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600" 
                                            alt={collection.name || collection.highforgeData?.title} 
                                        />
                                        <div class="ml-3 flex-grow place-items-start">
                                            <div class="font-medium text-gray-900 dark:text-white">
                                                {collection.name || collection.highforgeData?.title}
                                            </div>
                                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                                Collection #{collection.contractId}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            {:else if item.type === 'wallet'}
                                {@const wallet = item.data as EnvoiSearchResult}
                                <li class="group">
                                    <button 
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            console.log("Clicked recent wallet", wallet.address);
                                            gotoPortfolio(wallet);
                                        }}
                                        class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                    >
                                        {#if wallet.metadata?.avatar}
                                            <img 
                                                src={wallet.metadata.avatar} 
                                                alt={`${wallet.name} avatar`}
                                                class="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
                                            />
                                        {:else}
                                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                                <span class="text-white text-lg font-medium">
                                                    {wallet.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        {/if}
                                        <div class="ml-3 flex-grow place-items-start">
                                            <div class="font-medium text-gray-900 dark:text-white">
                                                {wallet.name}
                                            </div>
                                            <div class="text-sm font-mono text-gray-500 dark:text-gray-400 truncate">
                                                {wallet.address}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            {/if}
                        {/each}
                        <li>
                            <button 
                                onclick={() => doClearRecent()} 
                                class="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 text-left"
                            >
                                Clear Recent Searches
                            </button>
                        </li>
                    {/if}

                    <!-- Loading Indicator -->
                    {#if isSearching && search.length >= 2}
                        <div class="px-4 py-6 text-center">
                            <div class="inline-flex items-center justify-center">
                                <div class="w-5 h-5 border-2 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full animate-spin mr-2"></div>
                                <span class="text-gray-600 dark:text-gray-300">Searching...</span>
                            </div>
                        </div>
                    <!-- No Results Message -->
                    {:else if showNoResults && !isSearching && search.length >= 2}
                        <div class="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p>No results found for "{search}"</p>
                        </div>
                    <!-- Search Results Section -->
                    {:else if filteredCollections.length > 0 || filteredWallets.length > 0}
                        <div class="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                            Search Results {#if totalResults > 0}({filteredCollections.length} of {totalResults}){/if}
                        </div>
                        
                        {#if filteredCollections.length > 0}
                            <div class="collections-list divide-y divide-gray-100 dark:divide-gray-700">
                                {#each filteredCollections as collection, index}
                                    <li class="group">
                                        <button 
                                            onclick={() => gotoCollection(collection.contractId)} 
                                            class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 {selected === index ? 'bg-blue-50 dark:bg-blue-900/30' : ''}"
                                        >
                                            <img 
                                                src={getImageUrl(collection.imageUrl ?? collection.highforgeData?.coverImageURL ?? '', 32)} 
                                                class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600" 
                                                alt={collection.name || collection.highforgeData?.title} 
                                                onerror={(e) => {
                                                    (e.target as HTMLImageElement).onerror = null;
                                                    (e.target as HTMLImageElement).src = '/placeholder-collection.png';
                                                }}
                                            />
                                            <div class="ml-3 flex-grow place-items-start">
                                                <div class="font-medium text-gray-900 dark:text-white">
                                                    {collection.name || collection.highforgeData?.title}
                                                </div>
                                                <div class="flex text-sm text-gray-500 dark:text-gray-400 w-full justify-between">
                                                    <span>Collection #{collection.contractId}</span>
                                                    {#if collection.totalSupply}
                                                        <span class="ml-2">{collection.totalSupply} total supply</span>
                                                    {/if}
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                {/each}
                            </div>
                        {/if}
                        
                        {#if filteredWallets.length > 0}
                            <div class="wallets-list divide-y divide-gray-100 dark:divide-gray-700">
                                {#each filteredWallets as wallet, index}
                                    <li class="group">
                                        <button 
                                            onclick={() => gotoPortfolio(wallet)} 
                                            class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 {selected === filteredCollections.length + index ? 'bg-blue-50 dark:bg-blue-900/30' : ''}"
                                        >
                                            {#if wallet.metadata?.avatar}
                                                <img 
                                                    src={wallet.metadata.avatar} 
                                                    alt={`${wallet.name} avatar`}
                                                    class="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
                                                />
                                            {:else}
                                                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                                    <span class="text-white text-lg font-medium">
                                                        {wallet.name.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            {/if}
                                            <div class="ml-3 flex-grow place-items-start">
                                                <div class="font-medium text-gray-900 dark:text-white">
                                                    {wallet.name}
                                                </div>
                                                <div class="text-sm font-mono text-gray-500 dark:text-gray-400 truncate">
                                                    {wallet.address}
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                {/each}
                            </div>
                        {/if}
                        
                        {#if isSearching}
                            <div class="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                                <span class="inline-block animate-pulse">Loading...</span>
                            </div>
                        {:else if hasMoreResults && filteredCollections.length > 0}
                            <button 
                                onclick={(e) => { e.stopPropagation(); loadMoreResults(); }}
                                class="w-full px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150 text-center"
                            >
                                Load More Results
                            </button>
                        {/if}
                    {/if}
                </ul>
            {/if}
        </div>
    </div>
</div>