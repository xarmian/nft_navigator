<script lang="ts">
	import type { PageData } from './$types';
    import type { Collection, Token } from '$lib/data/types';
    import { filters, saleSort as sort, viewMode, collectionStore, currencies } from '../../../stores/collection';
    import { mimirListingsStore } from '../../../stores/mimirListings';
    import Select from '$lib/component/ui/Select.svelte';
    import CollectionPreview from '$lib/component/ui/CollectionPreview.svelte';
    import CollectionPreviewModal from '$lib/component/ui/CollectionPreviewModal.svelte';
	import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
    import { onMount } from 'svelte';
    
    export let data: PageData;
    let tokens: Token[] = data.tokens;
    let filterTokens: Token[] = [];
    let textFilter = '';
    let lastSort = { by: '', direction: '' };
    let lastFilter = { text: '', currency: ''};
    let isLoadingMore = false;
    let hasMoreListings = data.hasMore;
    let totalTokenCount = data.totalCount || tokens.length;

    let collectionGroups: {
        name: string;
        tokens: Token[];
        floor: number;
        ceiling: number;
        currency: number;
    }[] = [];

    // Add reactive statement to update token display names for ENVOi tokens
    $: {
        if (tokens) {
            // Iterate through each token and ensure ENVOi names are displayed if available
            tokens.forEach(token => {
                if (token.contractId === 797609 && token.metadata && token.metadata.envoiName) {
                    // Use type assertion to avoid TypeScript errors
                    (token.metadata as any).displayName = token.metadata.envoiName;
                }
            });
        }
    }

    // Load all remaining listings in the background if we don't have them all
    onMount(async () => {
        // Check if we need to load more tokens
        if (hasMoreListings && tokens.length < totalTokenCount) {
            try {
                isLoadingMore = true;
                
                // Keep loading pages until we have all listings
                while (hasMoreListings) {
                    const result = await mimirListingsStore.loadMore(fetch);
                    hasMoreListings = result.hasMore;
                    
                    if (result.tokens.length > tokens.length) {
                        tokens = result.tokens;
                        // Re-filter and sort with new tokens
                        filterAndSortTokens();
                    } else {
                        // No new tokens, break the loop
                        break;
                    }
                }
            } catch (error) {
                console.error('Error loading all listings:', error);
            } finally {
                isLoadingMore = false;
            }
        }
    });

    // Function to load more listings when needed
    async function loadMoreListings() {
        if (isLoadingMore || !hasMoreListings) return;
        
        isLoadingMore = true;
        
        try {
            // If in collection view, try to load all remaining tokens
            if ($viewMode === 'Collection') {
                while (hasMoreListings) {
                    const result = await mimirListingsStore.loadMore(fetch);
                    hasMoreListings = result.hasMore;
                    
                    if (result.tokens.length > tokens.length) {
                        tokens = result.tokens;
                        filterAndSortTokens();
                    } else {
                        break;
                    }
                }
            } else {
                // Just load next page for token view
                const result = await mimirListingsStore.loadMore(fetch);
                hasMoreListings = result.hasMore;
                
                if (result.tokens.length > tokens.length) {
                    tokens = result.tokens;
                    filterAndSortTokens();
                }
            }
        } catch (error) {
            console.error('Error loading more listings:', error);
        } finally {
            isLoadingMore = false;
        }
    }

    // Load more items when user reaches end of pagination
    function checkLoadMore() {
        // If we're on the last page or close to it, load more
        if (currentPage >= totalPages - 1 && hasMoreListings && !isLoadingMore) {
            loadMoreListings();
        }
    }

    // Track page changes and check if more listings need to be loaded
    $: {
        if (currentPage) {
            checkLoadMore();
        }
    }

    // Memoized filtering function
    function filterAndSortTokens() {
        // Only refilter if filters changed
        if (lastFilter.text !== textFilter || 
            lastFilter.currency !== $filters.currency) {
            
            filterTokens = tokens.filter((t: Token) => {
                return (textFilter == ''
                    || t.metadata?.name?.toLowerCase().includes(textFilter.toLowerCase())
                    || t.traits?.some(trait => trait.toLowerCase().includes(textFilter.toLowerCase())))
                    && ($filters.currency == '*' || t.marketData?.currency === Number($filters.currency));
            });

            // Update last filter state
            lastFilter = {
                text: textFilter,
                currency: $filters.currency
            };
        }

        // Only resort if sort changed
        if (lastSort.by !== $sort.by || lastSort.direction !== $sort.direction) {
            if ($sort.by === 'Randomize') {
                filterTokens = [...filterTokens].sort(() => Math.random() - 0.5);
            } else {
                const sortFunctions = {
                    Name: (a: Token, b: Token) => (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''),
                    Price: (a: Token, b: Token) => {
                        if (a.marketData?.price && b.marketData?.price) return a.marketData.price - b.marketData.price;
                        return a.marketData?.price ? -1 : b.marketData?.price ? 1 : 0;
                    },
                    Rank: (a: Token, b: Token) => {
                        if (a.rank && b.rank) return a.rank - b.rank;
                        return a.rank ? -1 : b.rank ? 1 : 0;
                    },
                    List: (a: Token, b: Token) => {
                        if (a.marketData?.createTimestamp && b.marketData?.createTimestamp) 
                            return a.marketData.createTimestamp - b.marketData.createTimestamp;
                        return a.marketData?.createTimestamp ? -1 : b.marketData?.createTimestamp ? 1 : 0;
                    }
                };

                const sortFn = sortFunctions[$sort.by as keyof typeof sortFunctions];
                if (sortFn) {
                    filterTokens = [...filterTokens].sort(sortFn);
                }
            }

            if ($sort.direction === 'Descending') {
                filterTokens = filterTokens.reverse();
            }

            // Update last sort state
            lastSort = {
                by: $sort.by,
                direction: $sort.direction
            };
        }
    }

    // Reactive statement for collection grouping
    $: {
        // Trigger filtering when textFilter changes
        textFilter;
        if ($viewMode === 'Collection') {
            const groups = new Map<string, Token[]>();
            
            filterAndSortTokens();
            
            // Add a loading indicator while we're still fetching tokens
            if (tokens.length < totalTokenCount && $viewMode === 'Collection') {
                // If we're switching to collection view and don't have all tokens,
                // trigger a load of all remaining tokens
                if (!isLoadingMore && hasMoreListings) {
                    loadMoreListings();
                }
            }
            
            filterTokens.forEach(token => {
                const collectionId = token.contractId.toString();
                if (!groups.has(collectionId)) {
                    groups.set(collectionId, []);
                }
                groups.get(collectionId)?.push(token);
            });

            collectionGroups = Array.from(groups.entries()).map(([name, tokens]) => {
                const prices = tokens
                    .filter(t => t.marketData?.price)
                    .map(t => t.marketData!.price!);
                
                return {
                    name,
                    tokens,
                    floor: prices.length > 0 ? Math.min(...prices) : Infinity,
                    ceiling: prices.length > 0 ? Math.max(...prices) : 0,
                    currency: tokens[0]?.marketData?.currency || 0
                };
            });

            if ($sort.by === 'Name') {
                collectionGroups.sort((a, b) => a.name.localeCompare(b.name));
            } else if ($sort.by === 'Price') {
                collectionGroups.sort((a, b) => {
                    if (a.floor === Infinity && b.floor === Infinity) return 0;
                    if (a.floor === Infinity) return 1;
                    if (b.floor === Infinity) return -1;
                    return a.floor - b.floor;
                });
            }

            if ($sort.direction === 'Descending') {
                collectionGroups.reverse();
            }
        } else {
            filterAndSortTokens();
        }
    }

    let currentPage = 1;
    let itemsPerPage = 12;
    let totalPages = 1;

    function handlePageChange(newPage: number, view: 'token' | 'collection' = 'token') {
        if (view === 'token') {
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                // Check if we need to load more items
                checkLoadMore();
            }
        } else {
            if (newPage >= 1 && newPage <= collectionTotalPages) {
                collectionPage = newPage;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    function getPageNumbers(view: 'token' | 'collection' = 'token') {
        const pages = [];
        const showPages = 5;
        const maxPages = view === 'token' ? totalPages : collectionTotalPages;
        const currentPageNum = view === 'token' ? currentPage : collectionPage;
        
        let start = Math.max(1, currentPageNum - Math.floor(showPages / 2));
        let end = Math.min(maxPages, start + showPages - 1);
        
        if (end - start + 1 < showPages) {
            start = Math.max(1, end - showPages + 1);
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        return pages;
    }

    $: totalPages = Math.ceil(filterTokens.length / itemsPerPage);

    let inputElement: HTMLInputElement;

    let isCollectionView = true;

    function handleViewModeChange() {
        $viewMode = isCollectionView ? 'Collection' : 'Token';
    }

    // Add new reactive statement for layout
    $: gridColumns = $viewMode === 'Token' 
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
        : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

    // Add these variables for collection pagination
    let collectionPage = 1;
    let collectionsPerPage = 12;
    let collectionTotalPages = 1;

    // Add this reactive statement to calculate collection total pages
    $: collectionTotalPages = Math.ceil(collectionGroups.length / collectionsPerPage);

    // Add these variables for the preview modal
    let showPreviewModal = false;
    let selectedCollectionTokens: Token[] = [];
    let selectedCollectionName = '';
    let selectedCollection: Collection | undefined = undefined;

    function handlePreviewClick(group: { name: string; tokens: Token[] }, event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        selectedCollectionTokens = group.tokens;
        selectedCollectionName = group.tokens[0].marketData?.collection?.name ?? group.tokens[0].metadata?.name?.replace(/[1#]/g, '') ?? group.tokens[0].contractId.toString();
        selectedCollection = $collectionStore.find(c => c.contractId === group.tokens[0].contractId);
        showPreviewModal = true;
    }
</script>

<CollectionPreviewModal 
    bind:showModal={showPreviewModal}
    tokens={selectedCollectionTokens}
    collectionName={selectedCollectionName}
    collection={selectedCollection}
/>

<!-- Add loading indicator for when more items are being loaded -->
{#if isLoadingMore}
<div class="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-20">
    <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
    <span>Loading more...</span>
</div>
{/if}

<!-- New layout structure -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header section -->
    <div class="mb-8 space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 class="text-2xl font-bold">NFTs For Sale</h1>
        </div>

        <!-- Stats Bar -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {#if tokens.length > 0}
                <!-- Total Tokens -->
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                            <p class="text-2xl font-semibold">{totalTokenCount}</p>
                            {#if tokens.length < totalTokenCount}
                                <p class="text-xs text-gray-500 dark:text-gray-400">Loaded: {tokens.length}</p>
                            {/if}
                        </div>
                        <div class="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Total Collections -->
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Collections</p>
                            <p class="text-2xl font-semibold">{new Set(tokens.map(t => t.contractId)).size}</p>
                        </div>
                        <div class="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Floor Price -->
                {@const floorToken = tokens.reduce((min, t) => 
                    (!min || (t.marketData?.price && t.marketData.price < min.marketData!.price!)) ? t : min, 
                    tokens.find(t => t.marketData?.price)
                )}
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Floor Price</p>
                            <p class="text-2xl font-semibold">
                                {(floorToken?.marketData?.price! / (10 ** 6)).toLocaleString()} VOI
                            </p>
                        </div>
                        <div class="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                            <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    {#if floorToken}
                        <a href="/collection/{floorToken.contractId}/token/{floorToken.tokenId}" class="flex items-center gap-2 mt-2 group">
                            <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                <img 
                                    src={floorToken.metadata?.image} 
                                    alt={floorToken.metadata?.name} 
                                    class="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                            </div>
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-500">
                                    {floorToken.metadata?.name}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {$collectionStore.find(c => c.contractId === floorToken.contractId)?.name ?? floorToken.marketData?.collection?.name ?? 'Unknown Collection'}
                                </p>
                            </div>
                        </a>
                    {/if}
                </div>

                <!-- Highest Price -->
                {@const highestToken = tokens.reduce((max, t) => 
                    (!max || (t.marketData?.price && t.marketData.price > max.marketData!.price!)) ? t : max, 
                    tokens.find(t => t.marketData?.price)
                )}
                <div class="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Highest Price</p>
                            <p class="text-2xl font-semibold">
                                {(highestToken?.marketData?.price! / (10 ** 6)).toLocaleString()} VOI
                            </p>
                        </div>
                        <div class="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                            <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    {#if highestToken}
                        <a href="/collection/{highestToken.contractId}/token/{highestToken.tokenId}" class="flex items-center gap-2 mt-2 group">
                            <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                <img 
                                    src={highestToken.metadata?.image} 
                                    alt={highestToken.metadata?.name} 
                                    class="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                />
                            </div>
                            <div class="min-w-0">
                                <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-500">
                                    {highestToken.metadata?.name}
                                </p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {$collectionStore.find(c => c.contractId === highestToken.contractId)?.name ?? highestToken.marketData?.collection?.name ?? 'Unknown Collection'}
                                </p>
                            </div>
                        </a>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Controls -->
        <div class="flex flex-col gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <!-- Search bar with icon -->
            <div class="relative w-full">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
                    </svg>
                </div>
                <input 
                    type="text" 
                    placeholder="Search by name or traits..." 
                    bind:value={textFilter} 
                    bind:this={inputElement}
                    class="w-full pl-10 pr-10 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {#if textFilter}
                    <button 
                        class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        on:click={() => { textFilter = ''; inputElement.focus(); }}
                        aria-label="Clear search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </button>
                {/if}
            </div>

            <div class="flex flex-col sm:flex-row gap-4">
                <!-- Sort and Filter Controls Group -->
                <div class="flex flex-wrap gap-3 flex-grow">
                    <div class="flex items-center gap-3 flex-wrap">
                        <!-- Sort Controls -->
                        <div class="flex items-center gap-2">
                            <Select 
                                label="Sort by"
                                options={[
                                    {id: 'Name', name: 'Name'}, 
                                    {id: 'Price', name: 'Price'}, 
                                    {id: 'Rank', name: 'Rank'},
                                    {id: 'List', name: 'List Date'},
                                    {id: 'Randomize', name: 'Random'}
                                ]} 
                                bind:value={$sort.by}
                            />
                            <Select 
                                label="Order"
                                options={[
                                    {id: 'Ascending', name: 'Ascending'}, 
                                    {id: 'Descending', name: 'Descending'}
                                ]} 
                                bind:value={$sort.direction}
                            />
                        </div>

                        <!-- Currency Filter -->
                        <div class="items-center hidden">
                            <Select 
                                label="Currency"
                                options={[
                                    {id:"*", name:"Any Token"}, 
                                    ...$currencies.map(c => ({
                                        id: String(c.assetId), 
                                        name: c.symbol || 'Unknown'
                                    }))
                                ]} 
                                bind:value={$filters.currency}
                            />
                        </div>
                    </div>
                </div>

                <!-- View Toggle -->
                <div class="flex items-center justify-end sm:justify-start gap-2 border-t pt-3 sm:border-t-0 sm:pt-0">
                    <span class="text-sm text-gray-600 dark:text-gray-400">View:</span>
                    <div class="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                        <button 
                            class="px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200 
                                   {!isCollectionView ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}"
                            on:click={() => { isCollectionView = false; handleViewModeChange(); }}
                        >
                            <span class="flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                                Tokens
                            </span>
                        </button>
                        <button 
                            class="px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200
                                   {isCollectionView ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}"
                            on:click={() => { isCollectionView = true; handleViewModeChange(); }}
                        >
                            <span class="flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Collections
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Active Filters -->
            {#if textFilter || $filters.currency !== '*'}
                <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Active filters:</span>
                    {#if textFilter}
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            Search: {textFilter}
                        </span>
                    {/if}
                    {#if $filters.currency !== '*'}
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Currency: {$currencies.find(c => c.assetId === Number($filters.currency))?.symbol || 'Unknown'}
                        </span>
                    {/if}
                    <button 
                        class="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        on:click={() => {
                            textFilter = '';
                            $filters.currency = '*';
                        }}
                    >
                        Clear all
                    </button>
                </div>
            {/if}
        </div>
    </div>

    <!-- Content section -->
    <div class="min-h-[300px]">
        {#if $viewMode === 'Collection'}
            {#if isLoadingMore && tokens.length < totalTokenCount}
                <div class="flex flex-col items-center justify-center py-12">
                    <div class="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                    <p class="text-lg text-gray-700 dark:text-gray-300">Loading all listings for collection view...</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Loaded {tokens.length} of {totalTokenCount} tokens</p>
                </div>
            {:else if collectionGroups.length === 0}
                <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                    <svg class="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p class="text-lg">No collections found with the current filters</p>
                </div>
            {:else}
                <div class="grid {gridColumns} gap-6">
                    {#each collectionGroups.slice((collectionPage - 1) * collectionsPerPage, collectionPage * collectionsPerPage) as group}
                        <a 
                            href="/collection/{group.tokens[0].contractId}/forsale"
                            class="block group"
                        >
                            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100 dark:border-gray-700">
                                <div class="p-4">
                                    <div class="flex gap-10">
                                        <div class="flex-shrink-0">
                                            <CollectionPreview tokens={group.tokens} />
                                        </div>
                                        <div class="flex-grow min-w-0">
                                            <h2 class="text-lg font-semibold truncate mb-1">
                                                {#if group.tokens[0].contractId === 797609}
                                                    enVoi Names
                                                {:else}
                                                    {group.tokens[0].marketData?.collection?.name ?? group.tokens[0].metadata?.name?.replace(/[1#]/g, '')}
                                                {/if}
                                            </h2>
                                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                                                {group.tokens.length} items
                                            </p>
                                            {#if group.floor !== Infinity}
                                                <div class="space-y-1 text-sm">
                                                    <div class="flex justify-between">
                                                        <span class="text-gray-600 dark:text-gray-400">Floor:</span>
                                                        <span class="font-medium">
                                                            {(group.floor / (10 ** 6)).toLocaleString()} 
                                                            {$currencies.find(c => c.assetId === group.currency)?.symbol ?? 'VOI'}
                                                        </span>
                                                    </div>
                                                    <div class="flex justify-between">
                                                        <span class="text-gray-600 dark:text-gray-400">Ceiling:</span>
                                                        <span class="font-medium text-right">
                                                            {(group.ceiling / (10 ** 6)).toLocaleString()} 
                                                            {$currencies.find(c => c.assetId === group.currency)?.symbol ?? 'VOI'}
                                                        </span>
                                                    </div>
                                                </div>
                                            {/if}
                                            <div class="mt-4">
                                                <button 
                                                    class="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:bg-blue-900/50 dark:hover:bg-blue-900 rounded-md transition-colors duration-200"
                                                    on:click={(e) => handlePreviewClick(group, e)}
                                                >
                                                    Preview Items
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </a>
                    {/each}
                </div>

                {#if collectionTotalPages > 1}
                    <div class="flex justify-center mt-8 gap-2">
                        <button 
                            class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                            disabled={collectionPage === 1}
                            on:click={() => handlePageChange(collectionPage - 1, 'collection')}
                        >
                            Previous
                        </button>
                        
                        {#each getPageNumbers('collection') as pageNum}
                            <button 
                                class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 
                                       {collectionPage === pageNum ? 'bg-blue-500 text-white' : ''}"
                                on:click={() => handlePageChange(pageNum, 'collection')}
                            >
                                {pageNum}
                            </button>
                        {/each}
                        
                        <button 
                            class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                            disabled={collectionPage === collectionTotalPages}
                            on:click={() => handlePageChange(collectionPage + 1, 'collection')}
                        >
                            Next
                        </button>
                    </div>
                {/if}
            {/if}
        {:else}
            {#if filterTokens.length === 0}
                <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                    <svg class="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <p class="text-lg">No tokens found with the current filters</p>
                </div>
            {:else}
                <div class="grid {gridColumns} gap-6">
                    {#each filterTokens.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) as token (String(token.contractId) + '_' + String(token.tokenId))}
                        <TokenDetail {token} collection={$collectionStore.find(c => c.contractId === token.contractId)} />
                    {/each}
                </div>

                {#if totalPages > 1}
                    <div class="flex justify-center mt-8 gap-2">
                        <button 
                            class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                            disabled={currentPage === 1}
                            on:click={() => handlePageChange(currentPage - 1, 'token')}
                        >
                            Previous
                        </button>
                        
                        {#each getPageNumbers('token') as pageNum}
                            <button 
                                class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 
                                       {currentPage === pageNum ? 'bg-blue-500 text-white' : ''}"
                                on:click={() => handlePageChange(pageNum, 'token')}
                            >
                                {pageNum}
                            </button>
                        {/each}
                        
                        <button 
                            class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                            disabled={currentPage === totalPages}
                            on:click={() => handlePageChange(currentPage + 1, 'token')}
                        >
                            Next
                        </button>
                    </div>
                {/if}
            {/if}
        {/if}
    </div>

    <!-- Loading indicator for pagination -->
    {#if isLoadingMore}
    <div class="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-20">
        <div class="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
        <span>Loading more...</span>
    </div>
    {/if}
</div>