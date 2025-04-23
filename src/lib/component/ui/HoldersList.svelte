<script lang="ts">
    import { copy } from 'svelte-copy';
    import { toast } from '@zerodevx/svelte-toast';
	import { onMount } from 'svelte';
	import { getNFD } from '$lib/utils/nfd';
    // Corrected import path
    import { getCollectors } from '$lib/utils/mimir'; 

    // --- Component Props --- 
    export let collectionId: string | number;
    export let showDownloadCSV = true;
    export let sortDirection: 'asc' | 'desc' = 'desc'; // Sort by token count
    export let searchText: string = '';
    export let rawCollectors: any[] = [];
    export let pageSize: number = 20;

    // --- Internal State --- 
    type Collector = {
        address: string; // Mimir uses 'owner', we map it to 'address'
        count: number; // Mimir uses 'tokenCount', we map it to 'count'
        nfd?: string;
        avatar?: string; // Ensure this accepts undefined
        visible: boolean;
    };

    let allCollectors: Collector[] = []; // Holds all fetched collectors
    let displayList: Collector[] = []; // Holds the filtered and sorted list for display
    let visibleCollectors: Collector[] = []; // Holds only the currently visible collectors
    
    let isLoading = false;
    let isLoadingMore = false;
    let initialLoadComplete = false;
    let error: string | null = null;

    // Pagination state
    let currentPage = 1;
    let hasMoreToLoad = false;

    // --- Data Fetching & Processing --- 
    async function fetchAndProcessCollectors() {
        if (isLoading) return;

        isLoading = true;
        initialLoadComplete = false;
        error = null;
        console.log(`Fetching all collectors for ${collectionId}...`);

        try {
            // Fetch raw collector data (owner, tokenCount)
            console.log(`Received ${rawCollectors.length} raw collectors`);

            // Map API response { owner, tokenCount } to our internal Collector type { address, count }
            allCollectors = rawCollectors.map((c: { owner: string; tokenCount: number; }) => ({ 
                address: c.owner, 
                count: c.tokenCount,
                visible: true // Default visibility, filter applied later
            }));
            
            // Apply initial filter and sort
            applyFilterAndSort();
            
            // Fetch NFDs for the first page of collectors
            if (visibleCollectors.length > 0) {
                await fetchNFDsForCollectors(visibleCollectors);
            }
            
            initialLoadComplete = true;
        } catch (err) {
            console.error("Error fetching collectors:", err);
            error = "Failed to load collector data.";
            allCollectors = []; // Clear data on error
            displayList = [];
            visibleCollectors = [];
            initialLoadComplete = true; // Mark load as complete even on error to show message
        } finally {
            isLoading = false;
        }
    }

    // --- NFD Fetching --- 
    async function fetchNFDsForCollectors(collectorsToUpdate: Collector[]) {
        const addresses = collectorsToUpdate
            .filter(c => !c.nfd) // Only fetch for collectors that don't already have NFD
            .map(c => c.address);
            
        if (addresses.length === 0) return;

        try {
            console.log(`Fetching NFD for ${addresses.length} addresses`);
            const nfds = await getNFD(addresses);
            
            if (!nfds || nfds.length === 0) {
                console.log('No NFDs returned from API');
                return;
            }
            
            const nfdMap = new Map(nfds.map(n => [n.key, { name: n.replacementValue, avatar: n.avatar }]));

            // Update all collectors with NFD data
            collectorsToUpdate.forEach(collector => {
                const nfdData = nfdMap.get(collector.address);
                if (nfdData) {
                    collector.nfd = nfdData.name;
                    collector.avatar = nfdData.avatar ?? undefined; // Map null to undefined
                }
            });
            
            console.log(`Updated NFD for ${nfdMap.size} collectors`);
        } catch (error) {
            console.error("Error fetching NFD names:", error);
            // Continue even if NFD fails
        }
    }

    // --- Filtering & Sorting --- 
    function applyFilterAndSort() {
        // Reset pagination on filter/sort change
        currentPage = 1;
        
        // Filter and sort all collectors
        displayList = allCollectors
            .map(c => ({ 
                ...c, 
                // Ensure visibility is always boolean
                visible: !searchText || 
                         c.address.toLowerCase().includes(searchText.toLowerCase()) || 
                         (!!c.nfd && c.nfd.toLowerCase().includes(searchText.toLowerCase()))
            }))
            .filter(c => c.visible) // Keep only visible items in displayList
            .sort((a, b) => sortDirection === 'asc' ? a.count - b.count : b.count - a.count);
        
        // Update visible collectors based on current page
        updateVisibleCollectors();
        
        console.log(`${displayList.length} collectors match filters, showing ${visibleCollectors.length}`);
    }
    
    // Update which collectors are visible based on current page
    function updateVisibleCollectors() {
        const startIdx = 0;
        const endIdx = currentPage * pageSize;
        visibleCollectors = displayList.slice(startIdx, endIdx);
        hasMoreToLoad = endIdx < displayList.length;
    }
    
    // Load more collectors
    async function loadMore() {
        if (isLoadingMore || !hasMoreToLoad) return;
        
        isLoadingMore = true;
        try {
            currentPage++;
            const previousLength = visibleCollectors.length;
            
            updateVisibleCollectors();
            
            // Get only the newly added collectors to fetch their NFDs
            const newCollectors = visibleCollectors.slice(previousLength);
            if (newCollectors.length > 0) {
                await fetchNFDsForCollectors(newCollectors);
            }
            
        } catch (err) {
            console.error("Error loading more collectors:", err);
            // Revert page increment on error
            currentPage--;
            updateVisibleCollectors();
        } finally {
            isLoadingMore = false;
        }
    }
    
    // Re-apply filter/sort when searchText or sortDirection changes
    // $: if (initialLoadComplete && (searchText !== undefined || sortDirection !== undefined)) applyFilterAndSort();

    // Reactive count for the header
    $: visibleCount = displayList.length;

    // --- UI Actions --- 
    function handleCopy(address: string) {
        toast.push(`Address copied: ${address.substring(0,8)}...${address.substring(address.length-4)}`);
    }

    // --- CSV Download --- 
    function downloadCSV() {
        if (displayList.length === 0) return;
        
        const headers = ['Address', 'NFD', 'TokenCount'];
        const rows: any[] = [];
        
        // Download only the currently visible (filtered/sorted) list
        displayList.forEach(collector => {
            rows.push([
                collector.address,
                collector.nfd ?? '', 
                collector.count
            ]);
        });

        let csvContent = headers.join(',') + '\n' + rows.map((e: any[]) => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const contractId = collectionId || 'collection';
        link.setAttribute('download', `collectors_${contractId}_${currentDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- Lifecycle --- 
    onMount(() => {
        console.log(`HoldersList mounted for collection ${collectionId}.`);
        fetchAndProcessCollectors(); // Fetch all collectors on mount
    });
</script>

<div class="w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div class="text-lg font-medium text-gray-700 dark:text-gray-200">
            {#if isLoading && !initialLoadComplete}
                <span class="inline-flex items-center">
                    <svg class="animate-spin mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Loading Collectors...
                </span>
            {:else}
                {visibleCount} Collectors {#if visibleCount > 0}(Showing {visibleCollectors.length}){/if}
            {/if}
        </div>
        
        {#if showDownloadCSV && displayList.length > 0}
            <button 
                on:click={downloadCSV} 
                class="inline-flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow-sm transition-colors dark:bg-green-600 dark:hover:bg-green-700"
                title="Download currently visible collector data"
            >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download CSV
            </button>
        {/if}
    </div>

    <!-- Error Message -->
    {#if error && !isLoading}
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Error:</strong> {error}
        </div>
    {/if}

    <!-- Main Content Area -->
    {#if isLoading && !initialLoadComplete}
        <!-- Initial Loading Spinner -->
        <div class="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <svg class="w-16 h-16 mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <p class="text-lg font-medium">Loading Collectors</p>
        </div>
    {:else if displayList.length === 0 && initialLoadComplete}
        <!-- No Holders Found State -->
        <div class="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            <p class="text-lg font-medium">No Collectors Found</p>
            <p class="mt-2 text-sm">
                {#if error}
                    Could not load data for this collection.
                {:else if searchText}
                    No collectors match your search criteria.
                {:else}
                    This collection currently has no collectors.
                {/if}
            </p>
        </div>
    {:else if initialLoadComplete}
        <!-- Collectors List -->
        <div class="space-y-3">
            {#each visibleCollectors as collector (collector.address)}
                <!-- Collector Item -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 flex items-center p-4 space-x-4">
                    <!-- Avatar -->
                    <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                        {#if collector.avatar}
                            <img src={collector.avatar} alt="Avatar" class="w-full h-full object-cover" />
                        {:else}
                            <div class="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            </div>
                        {/if}
                    </div>
                    <!-- Name & Address -->
                    <div class="flex-grow min-w-0">
                        <div class="flex items-center">
                             <a href="/portfolio/{collector.address}" class="font-medium text-blue-600 dark:text-blue-400 hover:underline truncate" title={collector.nfd || collector.address}>
                                {collector.nfd || `${collector.address.slice(0, 8)}...${collector.address.slice(-6)}`}
                            </a>
                            <button use:copy={collector.address} 
                                on:click={() => handleCopy(collector.address)}
                                class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                                aria-label="Copy address"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                        </div>
                        {#if collector.nfd}
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={collector.address}>{collector.address.slice(0, 12)}...{collector.address.slice(-8)}</div>
                        {/if}
                    </div>
                     <!-- Token Count Badge -->
                    <div class="flex-shrink-0 flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-medium rounded-full px-3 py-1 text-sm">
                        {collector.count} {collector.count === 1 ? 'token' : 'tokens'}
                    </div>
                </div>
                <!-- End Collector Item -->
            {/each}
        </div>
        
        <!-- Load More Button -->
        {#if hasMoreToLoad}
            <div class="mt-6 flex justify-center">
                <button 
                    on:click={loadMore}
                    class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg shadow-sm transition-colors dark:bg-blue-600 dark:hover:bg-blue-700 flex items-center"
                    disabled={isLoadingMore}
                >
                    {#if isLoadingMore}
                        <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                    {:else}
                        Load More
                    {/if}
                </button>
            </div>
        {/if}
    {/if}
</div>
