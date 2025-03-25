<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
    import { getImageUrl } from '$lib/utils/functions';
    import TokenDetail from '$lib/component/ui/TokenDetail.svelte';

    export let tokens: Token[] = [];
    export let collections: Collection[] = [];
    export let walletId: string = '';
    $: searchQuery = '';
    
    // Add state for expanded collections and pagination
    let expandedCollections = new Set<string>();
    let itemsPerPage = 8; // 2 rows of 6 on desktop
    let currentPages = new Map<string, number>();
    
    // Add touch handling for mobile carousel
    let touchStartX = 0;
    let touchEndX = 0;
    let currentSlide = new Map<string, number>();
    
    function handleTouchStart(contractId: number, event: TouchEvent) {
        touchStartX = event.touches[0].clientX;
    }
    
    function handleTouchMove(contractId: number, event: TouchEvent) {
        touchEndX = event.touches[0].clientX;
    }
    
    function handleTouchEnd(contractId: number) {
        const contractIdStr = String(contractId);
        const slideWidth = 100; // 100% of container width
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 50) { // Minimum swipe distance
            const current = currentSlide.get(contractIdStr) || 0;
            const totalSlides = getCollectionTokens(contractId).length;
            
            if (diff > 0 && current < totalSlides - 1) {
                // Swipe left
                currentSlide.set(contractIdStr, current + 1);
            } else if (diff < 0 && current > 0) {
                // Swipe right
                currentSlide.set(contractIdStr, current - 1);
            }
            currentSlide = currentSlide; // trigger reactivity
        }
    }

    function collectionMatchesSearch(collection: Collection | undefined): boolean {
        if (!searchQuery) return true;
        if (!collection) return false;
        const searchLower = searchQuery.toLowerCase();
        return collection.highforgeData?.title?.toLowerCase().includes(searchLower) ||
               `Collection #${collection.contractId}`.toLowerCase().includes(searchLower);
    }

    function toggleCollection(contractId: number) {
        const contractIdStr = String(contractId);
        if (expandedCollections.has(contractIdStr)) {
            // If clicking the currently expanded collection, collapse it
            expandedCollections.delete(contractIdStr);
            currentPages.delete(contractIdStr);
        } else {
            // If expanding a new collection, clear any other expanded collections first
            expandedCollections.clear();
            currentPages.clear();
            expandedCollections.add(contractIdStr);
            currentPages.set(contractIdStr, 1);
        }
        expandedCollections = expandedCollections; // trigger reactivity
    }

    function nextPage(contractId: number) {
        const contractIdStr = String(contractId);
        const currentPage = currentPages.get(contractIdStr) || 1;
        currentPages.set(contractIdStr, currentPage + 1);
        currentPages = currentPages; // trigger reactivity
    }

    function prevPage(contractId: number) {
        const contractIdStr = String(contractId);
        const currentPage = currentPages.get(contractIdStr) || 1;
        if (currentPage > 1) {
            currentPages.set(contractIdStr, currentPage - 1);
            currentPages = currentPages; // trigger reactivity
        }
    }

    function getCollectionTokens(contractId: number): Token[] {
        return tokens.filter(t => t.contractId === contractId && t.owner === walletId);
    }

    function getTotalPages(contractId: number): number {
        const collectionTokens = getCollectionTokens(contractId);
        return Math.ceil(collectionTokens.length / itemsPerPage);
    }

    function getPaginatedTokens(contractId: number): Token[] {
        const contractIdStr = String(contractId);
        const currentPage = currentPages.get(contractIdStr) || 1;
        const collectionTokens = getCollectionTokens(contractId);
        const startIndex = (currentPage - 1) * itemsPerPage;
        return collectionTokens.slice(startIndex, startIndex + itemsPerPage);
    }

    function getCurrentSlide(contractId: number): number {
        return currentSlide.get(String(contractId)) || 0;
    }

    // Get the currently expanded collection
    $: expandedCollection = collections.find(c => expandedCollections.has(String(c.contractId)));
</script>

<div class="px-4">
    <!-- Collection Stats Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Total Collections</p>
                    <h3 class="text-2xl font-bold mt-1">{new Set(tokens.map((t: Token) => t.contractId)).size}</h3>
                </div>
                <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <i class="fas fa-layer-group text-blue-600 dark:text-blue-400"></i>
                </div>
            </div>
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Total NFTs</p>
                    <h3 class="text-2xl font-bold mt-1">{tokens.length}</h3>
                </div>
                <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <i class="fas fa-images text-purple-600 dark:text-purple-400"></i>
                </div>
            </div>
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Avg. NFTs per Collection</p>
                    <h3 class="text-2xl font-bold mt-1">
                        {Math.round(tokens.length / new Set(tokens.map((t: Token) => t.contractId)).size)}
                    </h3>
                </div>
                <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <i class="fas fa-calculator text-green-600 dark:text-green-400"></i>
                </div>
            </div>
        </div>
    </div>

    <!-- Collection List -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 class="text-xl font-bold">Your Collections</h2>
                <div class="w-full md:w-64">
                    <div class="relative">
                        <input
                            type="text"
                            placeholder="Search collections..."
                            bind:value={searchQuery}
                            class="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                        <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Collection Grid -->
        <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-auto grid-flow-dense">
                {#each Array.from(new Set(tokens.map((t) => t.contractId)))
                    .map((contractId) => {
                        const collection = collections.find(c => c.contractId === contractId);
                        const collectionTokens = tokens.filter((t) => t.contractId === contractId && t.owner === walletId);
                        return { collection, tokens: collectionTokens };
                    })
                    .sort((a, b) => b.tokens.length - a.tokens.length) as item}
                    {@const collection = item.collection}
                    {@const tokens = item.tokens}
                    {#if collection}
                        <!-- Collection Card -->
                        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                                class:hidden={!collectionMatchesSearch(collection)}>
                            <!-- Collection Header -->
                            <div class="relative h-32">
                                <div class="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30 dark:from-blue-900/30 dark:to-purple-900/30">
                                    {#if collection.highforgeData?.coverImageURL}
                                        <img src={getImageUrl(collection.highforgeData.coverImageURL, 320)} 
                                                alt={collection.highforgeData?.title || 'Collection Cover'}
                                                class="w-full h-full object-cover opacity-80">
                                    {/if}
                                </div>
                                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <div class="absolute bottom-0 left-0 right-0 p-4">
                                    <h3 class="text-lg font-bold truncate text-white">
                                        {collection.highforgeData?.title || `Collection #${collection.contractId}`}
                                    </h3>
                                </div>
                            </div>

                            <!-- Collection Stats -->
                            <div class="p-4">
                                <div class="grid grid-cols-3 gap-4 mb-4">
                                    <div class="text-center">
                                        <p class="text-sm text-gray-500 dark:text-gray-400">Owned</p>
                                        <p class="text-lg font-bold">{tokens.length}</p>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-sm text-gray-500 dark:text-gray-400">Total Supply</p>
                                        <p class="text-lg font-bold">{collection.totalSupply - collection.burnedSupply}</p>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-sm text-gray-500 dark:text-gray-400">Ownership</p>
                                        <p class="text-lg font-bold">
                                            {Math.round((tokens.length / (collection.totalSupply - collection.burnedSupply)) * 100)}%
                                        </p>
                                    </div>
                                </div>

                                <!-- NFT Preview Grid -->
                                <div class="grid grid-cols-4 gap-2 mb-4">
                                    {#each tokens.slice(0, 4) as token}
                                        <div class="aspect-square rounded-md overflow-hidden">
                                            <img src={getImageUrl(token.metadata?.image || '', 100)} 
                                                    alt={token.metadata?.name || `Token #${token.tokenId}`}
                                                    class="w-full h-full object-cover" />
                                        </div>
                                    {/each}
                                </div>

                                <!-- Action Buttons -->
                                <div class="flex justify-center gap-2">
                                    <a href={`/collection/${collection.contractId}`}
                                    class="flex-1 text-center py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors">
                                        View Collection
                                    </a>
                                    <button 
                                        on:click={() => toggleCollection(collection.contractId)}
                                        class="flex-1 text-center py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 text-purple-700 dark:text-purple-300 rounded-lg transition-colors flex items-center justify-center gap-2">
                                        <i class="fas {expandedCollections.has(String(collection.contractId)) ? 'fa-chevron-up' : 'fa-chevron-down'}"></i>
                                        <span>{expandedCollections.has(String(collection.contractId)) ? 'Hide NFTs' : 'Show NFTs'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Expanded Collection Content -->
                        {#if expandedCollections.has(String(collection.contractId))}
                            <div class="col-span-full row-span-auto transition-all duration-300 ease-in-out">
                                <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                    <div class="p-6 border-b border-gray-200 dark:border-gray-700">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-4">
                                                {#if collection.highforgeData?.coverImageURL}
                                                    <img src={getImageUrl(collection.highforgeData.coverImageURL, 100)} 
                                                         alt={collection.highforgeData?.title || 'Collection Cover'}
                                                         class="w-16 h-16 rounded-lg object-cover">
                                                {/if}
                                                <div>
                                                    <h3 class="text-xl font-bold">
                                                        {collection.highforgeData?.title || `Collection #${collection.contractId}`}
                                                    </h3>
                                                    <p class="text-sm text-gray-500 dark:text-gray-400">
                                                        {getCollectionTokens(collection.contractId).length} NFTs owned
                                                    </p>
                                                </div>
                                            </div>
                                            <button 
                                                on:click={() => toggleCollection(collection.contractId)}
                                                aria-label="Collapse collection"
                                                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                                                <i class="fas fa-times text-gray-500 dark:text-gray-400"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="p-6">
                                        <!-- Desktop Grid -->
                                        <div class="hidden md:block">
                                            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                                                {#each getPaginatedTokens(collection.contractId) as token}
                                                    <TokenDetail {token} {collection} showOwnerIcon={false} />
                                                {/each}
                                            </div>
                                            
                                            <!-- Desktop Pagination -->
                                            {#if getTotalPages(collection.contractId) > 1}
                                                <div class="flex justify-center items-center gap-4 mt-4">
                                                    <button 
                                                        class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        on:click={() => prevPage(collection.contractId)}
                                                        aria-label="Previous page"
                                                        disabled={currentPages.get(String(collection.contractId)) === 1}>
                                                        <i class="fas fa-chevron-left"></i>
                                                    </button>
                                                    <span class="text-sm text-gray-600 dark:text-gray-300">
                                                        Page {currentPages.get(String(collection.contractId))} of {getTotalPages(collection.contractId)}
                                                    </span>
                                                    <button 
                                                        class="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        on:click={() => nextPage(collection.contractId)}
                                                        aria-label="Next page"
                                                        disabled={currentPages.get(String(collection.contractId)) === getTotalPages(collection.contractId)}>
                                                        <i class="fas fa-chevron-right"></i>
                                                    </button>
                                                </div>
                                            {/if}
                                        </div>

                                        <!-- Mobile Carousel -->
                                        <div class="md:hidden">
                                            <div class="relative overflow-hidden"
                                                 on:touchstart={(e) => handleTouchStart(collection.contractId, e)}
                                                 on:touchmove={(e) => handleTouchMove(collection.contractId, e)}
                                                 on:touchend={() => handleTouchEnd(collection.contractId)}>
                                                <div class="flex transition-transform duration-300 ease-out"
                                                     style="transform: translateX(-{getCurrentSlide(collection.contractId) * 100}%)">
                                                    {#each getCollectionTokens(collection.contractId) as token}
                                                        <div class="w-full flex-shrink-0">
                                                            <TokenDetail {token} {collection} showOwnerIcon={false} />
                                                        </div>
                                                    {/each}
                                                </div>
                                            </div>
                                            
                                            <!-- Mobile Pagination Dots -->
                                            <div class="flex justify-center items-center gap-2 mt-4">
                                                {#each Array(getCollectionTokens(collection.contractId).length) as _, i}
                                                    <button class="w-2 h-2 rounded-full transition-colors duration-200"
                                                            class:bg-blue-500={getCurrentSlide(collection.contractId) === i}
                                                            class:bg-gray-300={getCurrentSlide(collection.contractId) !== i}
                                                            on:click={() => {
                                                                currentSlide.set(String(collection.contractId), i);
                                                                currentSlide = currentSlide;
                                                            }}
                                                            aria-label="Go to slide {i + 1}">
                                                    </button>
                                                {/each}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    {/if}
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    /* Add smooth transition for the expanded content */
    .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 300ms;
    }
</style>