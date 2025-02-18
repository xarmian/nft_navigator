<script lang="ts">
	import { goto } from '$app/navigation';
    import type { Collection } from '$lib/data/types';
    import { getCollections } from '$lib/utils/indexer';
    import { onDestroy, onMount } from 'svelte';
    //import { recentSearch, userPreferences } from '../../../stores/collection';
    import { getEnvoiAddresses, searchEnvoi, type EnvoiSearchResult } from '$lib/utils/envoi';
    import { getAddressesForNFD } from '$lib/utils/nfd';
    import { page } from '$app/stores';
    import { writable } from 'svelte/store';
	import { getImageUrl } from '$lib/utils/functions';

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

    // Update the store type
    const recentSearch = writable<RecentSearchItem[]>([]);

    onMount(async () => {
        collections = await getCollections({ fetch });

        windowDefined = typeof window !== 'undefined';
        if (windowDefined) {
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('click', handleClickOutside);
        }
    });

    const unsubP = page.subscribe(value => {
        if (value.url.pathname.includes('/analytics')) {
            viewing = 'analytics';
        }
        else if (value.url.pathname.includes('/lounge')) {
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
                return { type: 'collection' as const, data: item };
            }
            if ('address' in item && 'name' in item) {
                return { type: 'wallet' as const, data: item };
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
	});

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.collectionSearchComponent')) {
            isOpen = false;
            isExpanded = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        const maxIndex = Math.max(filteredCollections.length - 1, filteredWallets.length - 1);
        if (event.key === 'ArrowDown') {
            selected = Math.min(selected + 1, maxIndex);
        } else if (event.key === 'ArrowUp') {
            selected = Math.max(selected - 1, 0);
        } else if (event.key === 'Enter') {
            if (filteredCollections.length > 0) {
                const selectedCollection = filteredCollections[selected];
                if (selectedCollection) {
                    gotoCollection(selectedCollection.contractId);
                }
            } else if (filteredWallets.length > 0) {
                gotoPortfolio(filteredWallets[selected]);
            }
        }
    }

    function gotoCollection(contractId: number) {
        const c = collections.find(collection => collection.contractId === contractId);
    
        if (c) {
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

            const newItem: RecentSearchItem = { type: 'collection', data: c };
            recentSearchValue = [newItem, ...recentSearchValue.filter(r => 
                !(r.type === 'collection' && (r.data as Collection).contractId === c.contractId)
            )];
            recentSearchValue = recentSearchValue.slice(0, 5);
            recentSearch.set(recentSearchValue);
        }
    }

    function gotoPortfolio(wallet: EnvoiSearchResult) {
        goto(`/portfolio/${wallet.address}`);
        search = '';
        showRecent = false;
        selected = 0;
        filteredWallets = [];

        const newItem: RecentSearchItem = { type: 'wallet', data: wallet };
        recentSearchValue = [newItem, ...recentSearchValue.filter(r => 
            !(r.type === 'wallet' && (r.data as EnvoiSearchResult).address === wallet.address)
        )];
        recentSearchValue = recentSearchValue.slice(0, 5);
        recentSearch.set(recentSearchValue);
    }

    function doShowRecent(doshow: boolean) {
        if (recentSearchValue.length > 0) showRecent = doshow;
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

    $: {
        if (search === '') {
            filteredWallets = [];
            filteredCollections = [];
            if (isExpanded) {
                showRecent = true;
            }
        } else {
            showRecent = false;
            filteredCollections = (search.length >= 2) ? collections.filter(collection => collection.highforgeData?.title.toUpperCase().includes(search.toUpperCase()) || collection.contractId.toString().includes(search)) : [];

            // do an NFD search
            if (search.length == 58) {
                filteredWallets = [ { address: search, name: search, metadata: {} } ];
            }
            else if (search.length >= 2) {
                searchEnvoi(search).then((data) => {
                    filteredWallets = data;
                });
            }
            else {
                filteredWallets = [];
            }
        }
    }

    function handleInputClick(event: MouseEvent) {
        event.stopPropagation();
        isOpen = true;
        isExpanded = true;
        doShowRecent(true);
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
            on:click={toggleSearch}
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
                    on:click={handleInputClick}
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
                <!-- Close button -->
                {#if isExpanded}
                    <button 
                        on:click={toggleSearch}
                        class="absolute right-2 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none transition-opacity duration-200"
                        aria-label="Close search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                {/if}
            </div>

            <!-- Dropdown Results -->
            {#if isOpen && (filteredCollections.length > 0 || (showRecent && recentSearchValue.length > 0) || filteredWallets.length > 0)}
                <ul 
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
                                        on:click={() => gotoCollection(collection.contractId)} 
                                        class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                    >
                                        <img 
                                            src={getImageUrl(collection.highforgeData?.coverImageURL ?? '',32)} 
                                            class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600" 
                                            alt={collection.highforgeData?.title} 
                                        />
                                        <div class="ml-3 flex-grow place-items-start">
                                            <div class="font-medium text-gray-900 dark:text-white">
                                                {collection.highforgeData?.title}
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
                                        on:click={() => gotoPortfolio(wallet)} 
                                        class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                                    >
                                        {#if wallet.metadata?.avatar}
                                            <img 
                                                src={wallet.metadata.avatar} 
                                                alt={`${wallet.name} avatar`}
                                                class="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600"
                                            />
                                        {:else}
                                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center flex-shrink-0">
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
                                on:click={() => doClearRecent()} 
                                class="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-150 text-left"
                            >
                                Clear Recent Searches
                            </button>
                        </li>
                    {/if}

                    <!-- Search Results Section -->
                    {#if filteredCollections.length > 0 || filteredWallets.length > 0}
                        <div class="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400">Search Results</div>
                        {#each filteredCollections as collection, index}
                            <li class="group">
                                <button 
                                    on:click={() => gotoCollection(collection.contractId)} 
                                    class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 {selected === index ? 'bg-blue-50 dark:bg-blue-900/30' : ''}"
                                >
                                    <img 
                                        src={collection.highforgeData?.coverImageURL} 
                                        class="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-600" 
                                        alt={collection.highforgeData?.title} 
                                    />
                                    <div class="ml-3 flex-grow place-items-start">
                                        <div class="font-medium text-gray-900 dark:text-white">
                                            {collection.highforgeData?.title}
                                        </div>
                                        <div class="text-sm text-gray-500 dark:text-gray-400">
                                            Collection #{collection.contractId}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        {/each}
                        {#each filteredWallets as wallet, index}
                            <li class="group">
                                <button 
                                    on:click={() => gotoPortfolio(wallet)} 
                                    class="flex items-center w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150 {selected === index ? 'bg-blue-50 dark:bg-blue-900/30' : ''}"
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
                    {/if}
                </ul>
            {/if}
        </div>
    </div>
</div>