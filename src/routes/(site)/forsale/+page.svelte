<script lang="ts">
	import type { PageData } from './$types';
    import { filters, saleSort as sort, viewMode, collectionStore, currencies } from '../../../stores/collection';
    import type { Token } from '$lib/data/types';
    import TokenCard from '$lib/component/ui/TokenCard.svelte';
    import Switch from '$lib/component/ui/Switch.svelte';
    import Select from '$lib/component/ui/Select.svelte';
    import CollectionPreview from '$lib/component/ui/CollectionPreview.svelte';
    
    export let data: PageData;
    let voiGames: object[] = data.voiGames;
    let tokens: Token[] = data.tokens;
    let filterTokens: Token[] = [];
    let textFilter = '';
    let lastSort = { by: '', direction: '' };
    let lastFilter = { text: '', currency: '', voiGames: false };

    let collectionGroups: {
        name: string;
        tokens: Token[];
        floor: number;
        ceiling: number;
        currency: number;
    }[] = [];

    // Memoized filtering function
    function filterAndSortTokens() {
        // Only refilter if filters changed
        if (lastFilter.text !== textFilter || 
            lastFilter.currency !== $filters.currency || 
            lastFilter.voiGames !== $filters.voiGames) {
            
            filterTokens = tokens.filter((t: Token) => {
                return (textFilter == ''
                    || t.metadata?.name?.toLowerCase().includes(textFilter.toLowerCase())
                    || t.traits?.some(trait => trait.toLowerCase().includes(textFilter.toLowerCase())))
                    && ($filters.currency == '*' || t.marketData?.currency === Number($filters.currency));
            });

            if ($filters.voiGames) {
                filterTokens = filterTokens.filter((t: Token) => 
                    voiGames.find((v: any) => v.applicationID === t.contractId)
                );
            }

            // Update last filter state
            lastFilter = {
                text: textFilter,
                currency: $filters.currency,
                voiGames: $filters.voiGames
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
    $: if ($viewMode === 'Collection') {
        const groups = new Map<string, Token[]>();
        
        filterAndSortTokens();
        
        filterTokens.forEach(token => {
            const collection = $collectionStore.find(c => c.contractId === token.contractId);
            const collectionName = (collection?.highforgeData?.title ?? token.metadata?.name?.replace(/[1#]/g, '')) || token.contractId.toString();
            if (!groups.has(collectionName)) {
                groups.set(collectionName, []);
            }
            groups.get(collectionName)?.push(token);
        });

        collectionGroups = Array.from(groups.entries()).map(([name, tokens]) => {
            const prices = tokens
                .filter(t => t.marketData?.price)
                .map(t => t.marketData!.price!);
            
            return {
                name,
                tokens,
                floor: Math.min(...prices),
                ceiling: Math.max(...prices),
                currency: tokens[0]?.marketData?.currency || 0
            };
        });

        if ($sort.by === 'Name') {
            collectionGroups.sort((a, b) => a.name.localeCompare(b.name));
        } else if ($sort.by === 'Price') {
            collectionGroups.sort((a, b) => a.floor - b.floor);
        }

        if ($sort.direction === 'Descending') {
            collectionGroups.reverse();
        }
    } else {
        filterAndSortTokens();
    }

    let currentPage = 1;
    let itemsPerPage = 12;
    let totalPages = 1;

    function handlePageChange(newPage: number, view: 'token' | 'collection' = 'token') {
        if (view === 'token') {
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
</script>

<!-- New layout structure -->
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header section -->
    <div class="mb-8 space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h1 class="text-2xl font-bold">NFTs For Sale</h1>
            
            <!-- Search -->
            <div class="relative w-full sm:w-96">
                <input 
                    type="text" 
                    placeholder="Search by name or traits..." 
                    bind:value={textFilter} 
                    bind:this={inputElement}
                    class="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {#if textFilter}
                    <button 
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        on:click={() => { textFilter = ''; inputElement.focus(); }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                        </svg>
                    </button>
                {/if}
            </div>
        </div>

        <!-- Controls -->
        <div class="flex flex-col sm:flex-row gap-4">
            <div class="flex flex-wrap gap-3 flex-grow">
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
            
            <Switch 
                bind:checked={isCollectionView}
                onChange={handleViewModeChange}
                label="Collection View"
            />
        </div>
    </div>

    <!-- Content section -->
    <div class="min-h-[300px]">
        {#if $viewMode === 'Collection'}
            {#if collectionGroups.length === 0}
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
                                                {group.name ?? group.tokens[0].metadata?.name?.replace(/[1#]/g, '')}
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
                        <TokenCard {token} />
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
</div>