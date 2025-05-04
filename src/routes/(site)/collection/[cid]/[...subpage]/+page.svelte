<script lang="ts">
	import type { PageData } from '../$types';
    import type { Token, Collection, Metadata, Listing } from '$lib/data/types';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
    import { onMount, onDestroy } from 'svelte';
    import { tokenCache } from '$lib/stores/tokenCache';
    import { algodIndexer } from '$lib/utils/algod';
    import { getEnvoiNames, resolveEnvoiToken } from '$lib/utils/envoi';
    import { selectedWallet } from "avm-wallet-svelte";
    import { getTokensWithPagination } from '$lib/utils/mimir';
    import { getListingsWithPagination } from '$lib/utils/mimir';
    import CollectionHeader from './components/CollectionHeader.svelte';
    import CollectionStats from './components/CollectionStats.svelte';
    import CollectionTabs from './components/CollectionTabs.svelte';
    import { invalidateAll } from '$app/navigation';

    export let data: PageData;
    $: contractId = data.contractId;
    let subpage = data.subpage;
    // Initialize currentView early to avoid reference errors
    let currentView = subpage === 'forsale' ? 'forsale' : subpage === '' ? 'tokens' : subpage;
    let previousView = currentView;
    $: rawCollectors = data.rawCollectors;
    
    $: tokens = data.tokens as Token[];
    $: collection = data.collection as Collection;
    $: listings = data.listings as Listing[];
    let filteredTokens = [] as Token[];
    let displayCount = 10;
    $: filters = data.filters;
    let searchText = '';
    $: displayTab = subpage === 'forsale' ? 'forsale' : subpage === '' ? 'tokens' : subpage;
    $: categories = data.categories;
    let wallet: any = null;
    let tabSortDirections = {
        tokens: 'asc',
        forsale: 'asc',
        ranking: 'asc',
        transactions: 'desc',
        collectors: 'desc',
        burned: 'asc',
        mine: 'asc'
    } as Record<string, 'asc' | 'desc'>;
    $: sortDirection = tabSortDirections[displayTab] || 'asc';
    let mintDate: string | null = null;
    let mintDateTime: string | null = null;

    // Creator Envoi metadata
    let creatorEnvoiMetadata: { url?: string; avatar?: string; location?: string; 'com.twitter'?: string; 'com.github'?: string; } | null = null;

    // Tab data loading management
    const tabDataLoaded = {
        tokens: true, // Loaded on initial page load
        forsale: false,
        mine: false,
        burned: false,
        ranking: true, // Uses the same data as tokens
        transactions: true, // Component handles its own data
        collectors: true, // Component handles its own data
        feed: true, // Component handles its own data
        analytics: true // Component handles its own data
    };

    // Function to safely parse metadata string
    function parseMetadata(metadataStr: string | undefined): Metadata | null {
        if (!metadataStr) return null;
        try {
            return JSON.parse(metadataStr) as Metadata;
        } catch (e) {
            console.error('Error parsing metadata:', e);
            return null;
        }
    }

    // Parse the metadata once for the collection's first token
    $: firstTokenMetadata = collection?.firstToken?.metadata ? parseMetadata(collection.firstToken.metadata) : null;
    $: collectionDescription = data.collection?.highforgeData?.description || firstTokenMetadata?.description || '';

    // Fetch creator's Envoi metadata when collection changes (once)
    $: {
        if (collection?.creator && collection.creatorName?.endsWith('.voi') && !creatorEnvoiMetadata) {
            getEnvoiNames([collection.creator]).then(results => {
                if (results.length > 0) {
                    creatorEnvoiMetadata = results[0].metadata;
                }
            });
        }
    }

    // Subscribe to wallet changes
    selectedWallet.subscribe((value) => {
        wallet = value;
        // Detect wallet changes to trigger re-fetch of Mine tab data if needed
        if (value && currentView === 'mine' && !tabDataLoaded.mine) {
            fetchMineTokens();
        }
    });

    // Variables and reactive declarations
    $: forSaleCount = data.forSaleCount ?? 0;
    $: totalTokens = data.totalTokenCount ?? 0;
    $: burnedTokens = data.burnedTokenCount ?? 0;
    let burnedTokenCount = data.burnedTokenCount ?? 0;
    $: userTokenCount = data.userTokenCount ?? 0;

    // Define views for the view switcher
    $: views = [
        {id: 'tokens', name: 'All Tokens', count: totalTokens, sortable: true},
        {id: 'forsale', name: 'For Sale', count: forSaleCount, sortable: true},
        {id: 'mine', name: 'Mine', count: userTokenCount, sortable: true},
        {id: 'ranking', name: 'Ranking', count: undefined, sortable: true},
        {id: 'transactions', name: 'Transactions', count: undefined, sortable: true},
        {id: 'collectors', name: 'Collectors', count: rawCollectors.length, sortable: true},
        {id: 'burned', name: 'Burned Tokens', count: burnedTokens, sortable: true},
        {id: 'analytics', name: 'Analytics', count: undefined, sortable: false},
        {id: 'feed', name: 'Feed', count: undefined, sortable: true},
    ];

    function setView(viewId: string) {
        // Only proceed if actually changing views
        if (currentView !== viewId) {
            previousView = currentView;
            currentView = viewId;
            onSubpageChange(viewId);
        }
    }

    // Variables for pagination
    let loading = false;
    let tokensNextToken: string | null = data.initialNextToken;
    let listingsNextToken: string | null = data.listingsNextToken;
    $: nextToken = currentView === 'forsale' ? listingsNextToken : tokensNextToken;

    // Initialize the token cache when tokens change - but only once
    $: {
        if (tokens && tokens.length > 0 && !$tokenCache[contractId.toString()]) {
            tokenCache.setTokens(contractId.toString(), tokens);
            tokenCache.updateVisibility(contractId.toString(), searchText, currentView, filters);
        }
    }

    // Watch for filter changes and refresh from API when using server-side filtering
    // Only triggers when filters or search text actually change - not on tab changes
    $: {
        if (tokens && tokens.length > 0 && 
            (searchText !== '' || Object.values(filters).some(v => v !== ''))) {
            loadFilteredTokens(searchText, filters);
        }
    }
    
    // Track state to avoid duplicate requests
    let lastSearch = '';
    let isSearchPending = false;
    
    // Function to fetch tokens with filters directly from API
    async function loadFilteredTokens(searchValue: string, filterValues: Record<string, string>) {
        if (!contractId || loading) return;
        
        // Create a hash of the current search parameters
        const searchHash = `${searchValue}:${JSON.stringify(filterValues)}`;
        
        // Skip if this exact search is already being processed or was just completed
        if (isSearchPending || searchHash === lastSearch) return;
        
        // Mark as pending and save for comparison
        isSearchPending = true;
        lastSearch = searchHash;
        
        loading = true;
        try {
            // Create metadata properties filter from current filters
            const metadataProperties = createMetadataFilters(filterValues);
            
            // Use the getTokensWithPagination function with metadata filtering
            const response = await getTokensWithPagination({
                contractId: contractId.toString(),
                fetch,
                limit: 50,
                nextToken: tokensNextToken || undefined,
                metadataSearch: searchValue || undefined,
                metadataProperties: Object.keys(metadataProperties).length > 0 ? metadataProperties : undefined
            });
            
            if (response.tokens.length > 0) {
                // Replace tokens in the cache with filtered results
                tokenCache.setTokens(contractId.toString(), response.tokens);
                
                // Update nextToken for future pagination
                tokensNextToken = response.nextToken;
            } else {
                // If no matching tokens were found, show empty state
                tokenCache.setTokens(contractId.toString(), []);
                tokensNextToken = null;
            }
        } catch (error) {
            console.error('Error loading filtered tokens:', error);
        } finally {
            loading = false;
            isSearchPending = false;
        }
    }

    // Helper function for sorting tokens
    function sortTokens(tokensToSort: Token[]): Token[] {
        if (!views.find(t => t.id === currentView)?.sortable) {
            return tokensToSort;
        }

        return [...tokensToSort].sort((a: Token, b: Token) => {
            if (currentView === 'ranking') {
                if (a.rank === undefined || a.rank === null) return 1;
                if (b.rank === undefined || b.rank === null) return -1;
                return sortDirection === 'asc' ? a.rank - b.rank : b.rank - a.rank;
            }
            else if (currentView === 'forsale') {
                const aPrice = a.marketData?.price ?? Number.MAX_VALUE;
                const bPrice = b.marketData?.price ?? Number.MAX_VALUE;
                // Handle potential null/undefined prices during sort
                if (aPrice === Number.MAX_VALUE && bPrice === Number.MAX_VALUE) return 0;
                if (aPrice === Number.MAX_VALUE) return 1;
                if (bPrice === Number.MAX_VALUE) return -1;
                return sortDirection === 'asc' ? aPrice - bPrice : bPrice - aPrice;
            } else { // Default sort by tokenId
                const aId = Number(a.tokenId) || 0;
                const bId = Number(b.tokenId) || 0;
                return sortDirection === 'asc' ? aId - bId : bId - aId;
            }
        });
    }

    // Consolidated reactive block to handle all tab views
    $: {
        const cached = $tokenCache[contractId.toString()];
        let tokensToDisplay: Token[] = []; // Initialize default

        if (currentView === 'forsale') {
            // 'forsale' uses the listings array
            const filteredListings = listings.filter(l => l.delete === null && l.price > 0);
            tokensToDisplay = filteredListings.map(l => {
                if (!l.token) return null; 
                return { 
                    ...(l.token as any),
                    marketData: l,
                    contractId: l.collectionId,
                    tokenId: l.tokenId,
                    rank: null
                } as Token;
            }).filter(t => t !== null) as Token[];
            
            // Load forsale data if not already loaded
            if (!tabDataLoaded.forsale && !loading) {
                tabDataLoaded.forsale = true;
                loadForSaleData();
            }
        
        } else if (cached) { // Handle other views that rely on the token cache
            
            if (currentView === 'mine' && wallet) {
                tokensToDisplay = cached.tokens.filter(t => t.owner === wallet.address);
                const userOwnedCount = tokensToDisplay.length;
                views = views.map(tab => tab.id === 'mine' ? {...tab, count: userOwnedCount} : tab);
                
                // Load mine data if not already loaded and wallet exists
                if (!tabDataLoaded.mine && wallet?.address && !loading) {
                    fetchMineTokens();
                }

            } else if (currentView === 'burned') {
                tokensToDisplay = cached.tokens.filter(t => t.isBurned === 'true');
                
                // Load burned data if not already loaded
                if (!tabDataLoaded.burned && !loading) {
                    tabDataLoaded.burned = true;
                    loadBurnedTokens();
                }
            
            } else if (currentView === 'tokens' || currentView === 'ranking') { 
                if (data.tokens && data.tokens.length > 0) {
                    tokensToDisplay = data.tokens;
                    cached.tokens = data.tokens;
                }
            } else if (currentView === 'collectors') {
                // For collectors tab, use the original tokens array directly
                // This ensures we pass the complete tokens array to HoldersList
                tokensToDisplay = data.tokens || [];
            } else {
                // Default for other views (transactions, analytics, feed) is empty grid
                tokensToDisplay = []; 
            }
        } else if (currentView === 'collectors' && data.tokens && data.tokens.length > 0) {
            // If cache is not available but we're on collectors tab with data
            tokensToDisplay = data.tokens;
        } else {
            // No cache AND not 'forsale' or 'collectors' view
            tokensToDisplay = [];
        }
            
        // Apply sorting and assign final result to filteredTokens
        filteredTokens = sortTokens(tokensToDisplay);
    }

    onDestroy(() => {
        // Clear this collection's cache when the component is destroyed
        tokenCache.clearCollection(contractId.toString());
    });

    // Update displayTab reactivity to handle subpage changes
    $: {
        const newTab = subpage === 'forsale' ? 'forsale' : subpage === '' ? 'tokens' : subpage;
        if (currentView !== newTab) {
            previousView = currentView;
            currentView = newTab;
            // Reset display count when changing tabs
            displayCount = 10;
        }
    }

    // Setup navigation listener to handle browser back/forward without full reloads
    onMount(() => {
        if (browser) {
            // Listen for popstate events (back/forward navigation)
            const handlePopState = () => {
                const path = window.location.pathname;
                const segments = path.split('/');
                const newSubpage = segments[segments.length - 1] === contractId.toString() ? '' : segments[segments.length - 1];
                
                // Only update if the subpage actually changed
                if (subpage !== newSubpage) {
                    subpage = newSubpage;
                    currentView = newSubpage === '' ? 'tokens' : newSubpage;
                    displayCount = 10; // Reset display count
                }
            };
            
            window.addEventListener('popstate', handlePopState);
            
            return () => {
                window.removeEventListener('popstate', handlePopState);
            };
        }
    });

    // Replace the onSubpageChange function
    async function onSubpageChange(newPage: string | number) {
        const targetView = newPage === 'tokens' ? '' : newPage.toString();
        
        // Check if the target is the same as the current state
        if (subpage === targetView) {
            return;
        }
        
        // Update the subpage state variable
        subpage = targetView;
        
        // Reset display count
        displayCount = 10;
        
        // Update the URL without triggering a full navigation if in browser
        if (browser) {
            const newUrl = newPage === 'tokens' 
                ? `/collection/${contractId}`
                : `/collection/${contractId}/${newPage}`;
            
            // Use history.pushState to update URL without reload
            window.history.pushState({ id: Date.now() }, '', newUrl);
            
            // Tell SvelteKit the URL changed, but prevent redundant data fetching
            // by manually handling the navigation in our code
            await invalidateAll();
            return;
        }
        
        // Fallback to regular navigation if not in browser (server-side)
        return newPage === 'tokens' 
            ? goto(`/collection/${contractId}`)
            : goto(`/collection/${contractId}/${newPage}`);
    }
    
    function showMore() {
        // Increase the display count first
        displayCount += 10;
        
        // If there are more tokens to fetch, load more
        if (nextToken && !loading) {
            loadMoreTokens();
        }
    }

    async function handleTabSort(tabId: string) {
        const tab = views.find(t => t.id === tabId);
        if (tab?.sortable && currentView === tabId) {
            tabSortDirections[tabId] = tabSortDirections[tabId] === 'asc' ? 'desc' : 'asc';
        } else {
            await onSubpageChange(tabId);
        }
    }

    // Function to get mint date from round - only called once
    async function getMintDate() {
        if (!mintDate && collection?.mintRound) {
            try {
                const roundInfo = await algodIndexer.lookupBlock(collection.mintRound).do();
                const timestamp = roundInfo.timestamp;
                const date = new Date(timestamp * 1000);
                mintDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric'
                });
                mintDateTime = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: true
                });
            } catch (err) {
                console.error('Error fetching mint date:', err);
                mintDate = null;
                mintDateTime = null;
            }
        }
    }

    function openExplorer(round: number) {
        window.open(`https://explorer.voi.network/explorer/block/${round}`, '_blank');
    }

    // Call getMintDate when collection changes - but only once
    $: {
        if (collection?.mintRound && !mintDate) {
            getMintDate();
        }
    }

    // Add these reactive declarations after the other reactive declarations in the script section
    $: totalMinted = collection?.globalState?.find((gs) => gs.key === 'totalMinted')?.value ? Number(collection.globalState.find((gs) => gs.key === 'totalMinted')?.value) : 0;
    $: maxSupply = collection?.globalState?.find((gs) => gs.key === 'maxSupply')?.value ? Number(collection.globalState.find((gs) => gs.key === 'maxSupply')?.value) : 0;
    $: launchStart = collection?.globalState?.find((gs) => gs.key === 'launchStart')?.value ? Number(collection.globalState.find((gs) => gs.key === 'launchStart')?.value) : 0;
    $: launchEnd = collection?.globalState?.find((gs) => gs.key === 'launchEnd')?.value ? Number(collection.globalState.find((gs) => gs.key === 'launchEnd')?.value) : 0;
    $: currentTime = Math.floor(Date.now() / 1000);
    $: isMinting = maxSupply > 0 && totalMinted < maxSupply && (launchStart === 0 || currentTime >= launchStart) && (launchEnd === 0 || currentTime <= launchEnd);
    $: mintProgress = maxSupply > 0 ? (totalMinted / maxSupply * 100).toFixed(1) : '0';

    // Add mint price calculations
    $: publicPrice = collection?.globalState?.find((gs) => gs.key === 'price')?.value ? Number(collection.globalState.find((gs) => gs.key === 'price')?.value) / Math.pow(10, 6) : null;
    $: wlPrice = collection?.globalState?.find((gs) => gs.key === 'wlPrice')?.value ? Number(collection.globalState.find((gs) => gs.key === 'wlPrice')?.value) / Math.pow(10, 6) : null;
    $: currentPrice = currentTime < launchStart && currentTime >= launchStart ? wlPrice : publicPrice;
    $: wlLaunchStart = collection?.globalState?.find((gs) => gs.key === 'wlLaunchStart')?.value ? Number(collection.globalState.find((gs) => gs.key === 'wlLaunchStart')?.value) : 0;

    // Function to format dates consistently
    function formatDateTime(timestamp: number) {
        if (!timestamp) return null;
        return new Date(timestamp * 1000).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
            timeZoneName: 'short'
        });
    }

    // Create a helper function to handle filter values
    function createMetadataFilters(currentFilters: Record<string, string>): Record<string, string> {
        const metadataProperties: Record<string, string> = {};
        
        if (Object.values(currentFilters).some(v => v !== '')) {
            Object.entries(currentFilters).forEach(([key, value]) => {
                if (value !== '') {
                    metadataProperties[key] = String(value);
                }
            });
        }
        
        return metadataProperties;
    }

    // Dedicated function to load For Sale listings
    async function loadForSaleData() {
        if (loading || !contractId) return;
        
        loading = true;
        try {
            const response = await getListingsWithPagination({
                collectionId: contractId.toString(),
                active: true,
                includes: 'token,collection',
                fetch,
                limit: 50,
                nextToken: listingsNextToken || undefined
            });
            
            if (response.listings.length > 0) {
                listings = response.listings;
                listingsNextToken = response.nextToken;
                forSaleCount = response.totalCount;
                views = views.map(v => v.id === 'forsale' ? {...v, count: forSaleCount } : v);
            }
        } catch (error) {
            console.error('Error loading for sale listings:', error);
        } finally {
            loading = false;
        }
    }

    // Dedicated function to load burned tokens
    async function loadBurnedTokens() {
        if (loading || !contractId) return;
        
        loading = true;
        try {
            const response = await getTokensWithPagination({
                contractId: contractId.toString(),
                fetch,
                limit: 50,
                // Using a type-safe way to pass the isBurned filter
                metadataProperties: { "isBurned": "true" }
            });
            
            if (response.tokens.length > 0) {
                // Add tokens to the cache, don't replace existing cached tokens
                tokenCache.addTokens(contractId.toString(), response.tokens);
                burnedTokenCount = response.totalCount;
                views = views.map(tab => tab.id === 'burned' ? {...tab, count: burnedTokenCount} : tab);
            }
        } catch (error) {
            console.error('Error loading burned tokens:', error);
        } finally {
            loading = false;
        }
    }

    async function loadMoreTokens() {
        if (loading || !contractId || nextToken === null) return;
        
        loading = true;
        try {
            // Load more tokens based on the current tab
            if (currentView === 'tokens' || currentView === 'burned' || currentView === 'mine' || currentView === 'ranking') {
                // Create metadata properties filter from current filters
                const metadataProperties = createMetadataFilters(filters);
                
                // Parameters for the API call
                const params: any = {
                    contractId: contractId.toString(),
                    fetch,
                    limit: 50,
                    nextToken: tokensNextToken || undefined,
                    metadataSearch: searchText || undefined,
                    metadataProperties: Object.keys(metadataProperties).length > 0 ? metadataProperties : undefined
                };
                
                // Add owner filter for 'mine' tab
                if (currentView === 'mine' && wallet?.address) {
                    params.owner = wallet.address;
                }
                
                // Add isBurned filter for 'burned' tab using metadataProperties
                if (currentView === 'burned') {
                    params.metadataProperties = {
                        ...params.metadataProperties,
                        "isBurned": "true"
                    };
                }
                
                const response = await getTokensWithPagination(params);
                
                if (response.tokens.length > 0) {
                    // Add tokens to the cache
                    tokenCache.addTokens(contractId.toString(), response.tokens);
                    
                    // Update nextToken for future pagination
                    tokensNextToken = response.nextToken;
                    
                    // Update the tokens array with new ones
                    tokens = [...tokens, ...response.tokens];
                    
                    // Update counts if needed
                    if (currentView === 'mine') {
                        userTokenCount = response.totalCount;
                        views = views.map(tab => tab.id === 'mine' ? {...tab, count: userTokenCount} : tab);
                    } else if (currentView === 'burned') {
                        burnedTokenCount = response.totalCount;
                        views = views.map(tab => tab.id === 'burned' ? {...tab, count: burnedTokenCount} : tab);
                    }
                    
                } else {
                    tokensNextToken = null;
                }
            } else if (currentView === 'forsale') {
                // For the forsale tab, we need to get more listings
                const response = await getListingsWithPagination({
                    collectionId: contractId.toString(),
                    active: true,
                    includes: 'token,collection',
                    fetch,
                    limit: 50,
                    nextToken: listingsNextToken || undefined
                });
                
                if (response.listings.length > 0) {
                    // Add the new listings to our local listings array
                    const newListings = response.listings.filter(l => 
                        !listings.some(existing => existing.transactionId === l.transactionId)
                    );
                    
                    listings = [...listings, ...newListings];
                    
                    // Update nextToken for future pagination
                    listingsNextToken = response.nextToken;
                } else {
                    listingsNextToken = null;
                }
            }
        } catch (error) {
            console.error('Error loading more tokens:', error);
            if (currentView === 'forsale') {
                listingsNextToken = null;
            } else {
                tokensNextToken = null;
            }
        } finally {
            loading = false;
        }
    }

    // Function to resolve Envoi names for tokens - only used when explicitly needed
    async function resolveEnvoiTokens(tokens: any[], pendingTokenIds: string[]): Promise<any[]> {
        if (!tokens || tokens.length === 0) return [];
        
        const tokenIds = tokens.map(token => token.tokenId);
        try {
            const envoiResults = await resolveEnvoiToken(tokenIds);
            
            if (envoiResults.length === 0) {
                return tokens;
            }
            
            // Create a new array with updated tokens
            const updatedTokens = tokens.map(token => {
                if (token.contractId === 797609 && pendingTokenIds.includes(token.tokenId)) {
                    const envoiData = envoiResults.find(result => result.token_id === token.tokenId);
                    if (envoiData && token.metadata) {
                        return {
                            ...token,
                            metadata: {
                                ...token.metadata,
                                name: token.metadata.name || '',
                                envoiName: envoiData.name,
                                envoiMetadata: envoiData.metadata
                            }
                        };
                    }
                }
                return token;
            });
            
            return updatedTokens;
        } catch (error) {
            console.error("Error resolving Envoi names:", error);
            return tokens;
        }
    }

    // Update the setFilter function to use API filtering
    function setFilterAndLoad(trait: string, value: string) {
        filters[trait] = value;
    }

    // Update the setSearchText function to use API filtering
    function setSearchTextAndLoad(value: string) {
        searchText = value;
    }

    function setSortDirection(dir: 'asc' | 'desc') {
        sortDirection = dir;
    }

    let isMobile = false;
    if (typeof window !== 'undefined') {
        isMobile = window.innerWidth < 768;
    }

    // Fetch initial listings only once when the component mounts
    onMount(async () => {
        if (!contractId) return;
        
        // We'll load the initial data here
        if (currentView === 'forsale' && !tabDataLoaded.forsale) {
            tabDataLoaded.forsale = true;
            loadForSaleData();
        }
        
        if (currentView === 'mine' && wallet?.address && !tabDataLoaded.mine) {
            fetchMineTokens();
        }
        
        if (currentView === 'burned' && !tabDataLoaded.burned) {
            tabDataLoaded.burned = true;
            loadBurnedTokens();
        }
    });

    // Dedicated Fetch Logic for 'Mine' Tab - only runs once
    async function fetchMineTokens() {
        if (!wallet?.address || !contractId || loading || tabDataLoaded.mine) return;
        
        tabDataLoaded.mine = true;
        loading = true;
        try {
            const response = await getTokensWithPagination({
                contractId: contractId.toString(),
                owner: wallet.address,
                fetch,
                limit: 50
            });

            if (response.tokens.length > 0) {
                // Add tokens to the cache, don't replace existing cached tokens
                tokenCache.addTokens(contractId.toString(), response.tokens);
                userTokenCount = response.totalCount;
                views = views.map(tab => tab.id === 'mine' ? {...tab, count: userTokenCount} : tab);
            } else {
                userTokenCount = 0;
                views = views.map(tab => tab.id === 'mine' ? {...tab, count: userTokenCount} : tab);
            }
        } catch (error) {
            console.error('Error fetching Mine tokens:', error);
            tabDataLoaded.mine = false; // Allow retry on error
        } finally {
            loading = false;
        }
    }
</script>

{#if collection}
<CollectionHeader
  {collection}
  {collectionDescription}
  {creatorEnvoiMetadata}
/>
<CollectionStats
  isMinting={isMinting}
  totalMinted={totalMinted}
  maxSupply={maxSupply}
  mintProgress={mintProgress}
  launchEnd={launchEnd}
  floor={data.floor}
  ceiling={data.ceiling}
  totalTokenCount={data.totalTokenCount}
  burnedTokenCount={data.burnedTokenCount}
  onSubpageChange={onSubpageChange}
  tabSortDirections={tabSortDirections}
  collection={collection}
  mintDate={mintDate}
  mintDateTime={mintDateTime}
  openExplorer={openExplorer}
  wlLaunchStart={wlLaunchStart}
  wlPrice={wlPrice}
  launchStart={launchStart}
  publicPrice={publicPrice}
  formatDateTime={formatDateTime}
  uniqueCollectors={rawCollectors.length}
/>

<!-- Main content area with modern design -->
<div class="max-w-7xl mx-auto px-1 sm:px-2 lg:px-4 py-6 pb-20">
  <CollectionTabs
    views={views}
    {currentView}
    setView={setView}
    {sortDirection}
    {filteredTokens}
    {displayCount}
    {loading}
    {searchText}
    setSearchText={setSearchTextAndLoad}
    {filters}
    setFilter={setFilterAndLoad}
    setSortDirection={setSortDirection}
    {categories}
    {isMobile}
    {tokens}
    {collection}
    {contractId}
    {rawCollectors}
    onLoadMore={showMore}
  />
</div>

{:else}
    <div class="w-full flex justify-center items-center h-screen">
        <div class="text-xl font-bold">Unable to locate collection: {contractId}</div>
    </div>
{/if}

<style>
</style>