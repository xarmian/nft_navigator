<script lang="ts">
  import PortfolioCollections from './PortfolioCollections.svelte';

	import type { PageData } from '../$types';
    import type { Token, Collection } from '$lib/data/types';
    import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
	import { A } from 'flowbite-svelte';
    import { onMount, onDestroy, type EventDispatcher } from 'svelte';
    import { selectedWallet } from 'avm-wallet-svelte';
	import { goto, invalidateAll } from '$app/navigation';
    import { toast } from '@zerodevx/svelte-toast';
    import { copy } from 'svelte-copy';
    // @ts-ignore
    import Device from 'svelte-device-info';
    import { getWalletBalance, getCurrency } from '$lib/utils/currency';
	import TransactionTable from '$lib/component/ui/TransactionTable.svelte';
    import { getImageUrl } from '$lib/utils/functions';
	import SendTokenModal from '$lib/component/ui/SendTokenModal.svelte';
    import PortfolioAnalytics from '$lib/component/ui/PortfolioAnalytics.svelte';
    import PortfolioSettings from '$lib/component/ui/PortfolioSettings.svelte';
    import { page } from '$app/stores';

    export let data: PageData;
    $: walletId = data.props.walletId;
    $: walletEnvoi = data.props.walletEnvoi;
    $: tab = data.props.tab;

    $: tokens = data.props.tokens;
    $: approvals = data.props.approvals;
    $: collections = data.props.collections;
    $: createdCollections = data.props.createdCollections || [];
    $: isCreator = data.props.isCreator || false;
    let isMobile: boolean | null = null;
    let headerTokens: Token[] = [];
    let portfolioSort = 'mint';
    let displayCount = 10;
    $: multiselectMode = false;
    let didLongPress = false;
    $: selectedTokens = [] as Token[];
    $: showSendTokenModal = false;
    let searchQuery = '';
    let showListedOnly = false;
    let sortDirection: 'asc' | 'desc' = 'asc';
    let containerRef: HTMLElement;
    let isLoading = true;
    // New variable to track if we are in collection view
    $: isCollectionView = portfolioSort === 'collection_view';
    // Map to store NFTs grouped by collection
    $: collectionGroups = new Map<string, Token[]>();
    
    // Settings variables
    let hidePortfolioValue = false;
    let hideActivity = false;
    let notifyOffers = true;
    let notifyPriceChanges = true;
    let notifyNewDrops = true;

    // New variable to track current tab
    let currentTab: 'gallery' | 'activity' | 'analytics' | 'settings' | 'collections' = data.props.tab as 'gallery' | 'activity' | 'analytics' | 'settings' | 'collections';
console.log(currentTab);
    $: {
        if (tokens) {
            headerTokens = tokens.slice();
            headerTokens = headerTokens.sort(() => Math.random() - 0.5).slice(0, 1);

            // sort tokens based on portfolioSort
            /*if (portfolioSort == 'name') {
                tokens = tokens.sort((a, b) => a.metadata?.name.localeCompare(b.metadata?.name));
            } else if (portfolioSort == 'mint') {
                tokens = tokens.sort((a, b) => a.mintRound - b.mintRound);
            }*/
        }
    }
    
    let voiBalance: number;

    onMount(async () => {
        isMobile = Device.isMobile;
        // Set loading to false after a short delay to prevent flash
        setTimeout(() => {
            isLoading = false;
        }, 500);
    });

    $: {
        if (walletId) {
            getWalletBalance(walletId,0).then((balance) => {
                voiBalance = balance;
            });
        }
    }

    $: formattedWallet = (walletId) ? (walletId.length > 8
        ? `${walletId.slice(0, (isMobile ? 4 : 6))}...${walletId.slice((isMobile ? -4 : -6))}`
        : walletId) : '';

    // Filter and sort tokens based on user preferences
    $: filteredTokens = tokens.filter(token => {
        if (!token) return false;
        
        // Filter by search query
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            token.metadata?.name?.toLowerCase().includes(searchLower) ||
            token.metadata?.collection?.name?.toLowerCase().includes(searchLower) ||
            // Search by token number if name contains a number
            (token.metadata?.name && /\d+/.test(searchQuery) && token.metadata.name.includes(searchQuery)) ||
            // Search by traits/properties
            Object.entries(token.metadata?.properties || {}).some(([key, value]) => 
                key.toLowerCase().includes(searchLower) ||
                (typeof value === 'string' && value.toLowerCase().includes(searchLower))
            );

        // Filter by listed status if enabled
        const matchesListed = !showListedOnly || token.marketData;

        return matchesSearch && matchesListed;
    }).sort((a, b) => {
        let comparison = 0;
        if (portfolioSort === 'name') {
            comparison = (a.metadata?.name || '').localeCompare(b.metadata?.name || '');
        } else if (portfolioSort === 'collection') {
            comparison = (a.metadata?.collection?.name || '').localeCompare(b.metadata?.collection?.name || '');
        } else if (portfolioSort === 'collection_view') {
            // For collection view, first sort by collection name
            comparison = (a.metadata?.collection?.name || '').localeCompare(b.metadata?.collection?.name || '');
            // If same collection, sort by name within the collection
            if (comparison === 0) {
                comparison = (a.metadata?.name || '').localeCompare(b.metadata?.name || '');
            }
        } else {
            comparison = a.mintRound - b.mintRound;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Group tokens by collection for collection view
    $: {
        if (isCollectionView && filteredTokens.length > 0) {
            collectionGroups.clear();
            filteredTokens.forEach(token => {
                // Use contractId for grouping instead of collection name
                const contractId = token.contractId || 'unknown';
                if (!collectionGroups.has(contractId.toString())) {
                    collectionGroups.set(contractId.toString(), []);
                }
                collectionGroups.get(contractId.toString())?.push(token);
            });
        }
    }

    let sortOptions = [
        { id: 'mint', name: 'Mint Date' },
        { id: 'name', name: 'Name' },
        { id: 'collection', name: 'Collection (Sort)' },
        { id: 'collection_view', name: 'Collection View' }
    ];

    function showMore() {
        displayCount += 10;
    }

    function handleLongPress(event: MouseEvent | TouchEvent) {
        console.log('long press?');
        let longPressDuration = 1000;
        let pressTimer: null | NodeJS.Timeout = null;
        didLongPress = false;

        pressTimer = setTimeout(() => {
            console.log('longpress.');
            multiselectMode = !multiselectMode; // Toggle multiselectMode
            didLongPress = true;
            cancelPress();
        }, longPressDuration);

        const cancelPress = () => {
            // Clear the timeout if the press is released early
            console.log('cancelpress.');
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }

            // remove event listeners
            if (event.target) {
                event.target.removeEventListener('mouseup', cancelPress);
                event.target.removeEventListener('mouseleave', cancelPress);
                event.target.removeEventListener('touchend', cancelPress);
                event.target.removeEventListener('touchcancel', cancelPress);
            }
        };

        if (event.target) {
            // Attach event listeners
            event.target.addEventListener('mouseup', cancelPress);
            event.target.addEventListener('mouseleave', cancelPress);
            event.target.addEventListener('touchend', cancelPress);
            event.target.addEventListener('touchcancel', cancelPress);
        }

    }

    function checkStopPropagation(event: MouseEvent) {
        if (multiselectMode || didLongPress) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }

    function toggleSelectedTokens(token: Token) {
        if (selectedTokens.includes(token)) {
            selectedTokens = selectedTokens.filter(t => t !== token);
        } else {
            selectedTokens = [...selectedTokens, token];
        }
    }

    function clearMultiSelectMode(token?: Token) {
        multiselectMode = false;
        selectedTokens = [];
        if (token) {
            invalidateAll();
        }
    }

    // Add this near the top of the script section
    $: shareUrl = `https://nftnavigator.xyz/portfolio/${walletId}`;
    $: shareText = `Check out this sweet NFT portfolio on Voi Network! #Voiagers #VoiNFTs`;

    $: {
        if (containerRef) {
            containerRef.style.setProperty('--token-area-width', `${containerRef.querySelector('.token-area')?.clientWidth ?? 100}px`);
        }
    }

    // Fix shortName variable for linter
    let shortName = '';

    // Add this near the other helper functions
    function collectionMatchesSearch(collection: Collection | undefined): boolean {
        if (!searchQuery) return true;
        if (!collection) return false;
        const searchLower = searchQuery.toLowerCase();
        return collection.highforgeData?.title?.toLowerCase().includes(searchLower) ||
               `Collection #${collection.contractId}`.toLowerCase().includes(searchLower);
    }

</script>
<div>
    {#if isLoading}
        <div class="w-full bg-gradient-to-r from-blue-900/50 to-purple-900/50 dark:from-blue-950/50 dark:to-purple-950/50 animate-pulse">
            <div class="max-w-7xl mx-auto px-4 py-6 md:py-8">
                <div class="flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-start">
                    <!-- Profile Image Placeholder -->
                    <div class="relative shrink-0">
                        <div class="h-20 w-20 md:h-32 md:w-32 rounded-xl overflow-hidden ring-4 ring-white/20 shadow-xl bg-gradient-to-br from-blue-400/30 to-purple-500/30 animate-pulse"></div>
                    </div>

                    <!-- Profile Info Placeholder -->
                    <div class="flex-1 text-center md:text-left">
                        <div class="flex flex-col md:flex-row justify-between w-full gap-4">
                            <div>
                                <div class="h-8 w-48 bg-white/20 rounded animate-pulse mb-2 mx-auto md:mx-0"></div>
                                <div class="h-6 w-32 bg-white/20 rounded animate-pulse mb-3 mx-auto md:mx-0"></div>
                            </div>
                            
                            <div class="flex flex-col items-center md:items-end gap-2">
                                <!-- VOI Balance Card Placeholder -->
                                <div class="flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg w-40">
                                    <div class="mr-3 h-8 w-8 md:h-10 md:w-10 rounded-full bg-white/20 animate-pulse"></div>
                                    <div>
                                        <div class="h-5 w-20 bg-white/20 rounded animate-pulse mb-1"></div>
                                        <div class="h-3 w-16 bg-white/20 rounded animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Social/Contact Info Placeholder -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                            <div class="h-10 bg-white/10 rounded-lg animate-pulse"></div>
                            <div class="h-10 bg-white/10 rounded-lg animate-pulse"></div>
                            <div class="h-10 bg-white/10 rounded-lg animate-pulse"></div>
                            <div class="h-10 bg-white/10 rounded-lg animate-pulse"></div>
                        </div>
                    </div>
                </div>

                <!-- External Links & Stats Placeholder -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mt-4 md:mt-6">
                    <div class="h-16 bg-white/10 rounded-lg animate-pulse"></div>
                    <div class="h-16 bg-white/10 rounded-lg animate-pulse"></div>
                    <div class="h-16 bg-white/10 rounded-lg animate-pulse"></div>
                    <div class="h-16 bg-white/10 rounded-lg animate-pulse"></div>
                </div>
            </div>
        </div>
        
        <!-- Tab Navigation Placeholder -->
        <div class="bg-white dark:bg-gray-900">
            <div class="max-w-7xl mx-auto py-4">
                <div class="border-b border-gray-200 dark:border-gray-700">
                    <nav class="flex space-x-8 px-4" aria-label="Portfolio sections">
                        <div class="py-4 px-6 border-b-2 border-blue-500 text-blue-600 dark:text-blue-400 font-medium text-sm">
                            <div class="h-5 w-20 bg-blue-200 dark:bg-blue-700 rounded animate-pulse"></div>
                        </div>
                        <div class="py-4 px-6 border-b-2 border-transparent text-gray-500 font-medium text-sm">
                            <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>
                        <div class="py-4 px-6 border-b-2 border-transparent text-gray-500 font-medium text-sm">
                            <div class="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>
                    </nav>
                </div>

                <!-- Gallery Tab Content Placeholder -->
                <div class="py-6">
                    <div class="px-4">
                        <!-- Search & Filter Controls Placeholder -->
                        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-8">
                            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div class="w-full md:w-auto flex-grow">
                                    <div class="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                </div>
                                <div class="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
                                    <div class="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                    <div class="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                                    <div class="h-10 w-32 bg-blue-200 dark:bg-blue-700 rounded-lg animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- NFT Grid Placeholder -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {#each Array(10) as _, i}
                                <div class="rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm animate-pulse">
                                    <div class="aspect-square bg-gray-300 dark:bg-gray-700"></div>
                                    <div class="p-3">
                                        <div class="h-5 w-3/4 bg-gray-300 dark:bg-gray-700 rounded mb-2"></div>
                                        <div class="h-4 w-1/2 bg-gray-300 dark:bg-gray-700 rounded"></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {:else if walletId}
        <div class="w-full bg-gradient-to-r from-blue-900/90 to-purple-900/90 dark:from-blue-950 dark:to-purple-950">
            <div class="max-w-7xl mx-auto px-4 py-6 md:py-8">
                <div class="flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-start">
                    <!-- Profile Image Section -->
                    <div class="relative shrink-0">
                        {#if walletEnvoi?.metadata?.avatar}
                            <div class="h-20 w-20 md:h-32 md:w-32 rounded-xl overflow-hidden ring-4 ring-white/20 shadow-xl">
                                <img src={walletEnvoi.metadata.avatar} alt={walletEnvoi.metadata.name??formattedWallet} 
                                     class="h-full w-full object-cover" />
                            </div>
                        {:else}
                            <div class="h-20 w-20 md:h-32 md:w-32 rounded-xl overflow-hidden ring-4 ring-white/20 shadow-xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                                <i class="fas fa-user-astronaut text-3xl md:text-4xl text-white"></i>
                            </div>
                        {/if}
                    </div>

                    <!-- Profile Info Section -->
                    <div class="flex-1 text-white text-center md:text-left">
                        <div class="flex flex-col md:flex-row justify-between w-full gap-4">
                            <div>
                                <h1 class="text-xl md:text-3xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
                                    {walletEnvoi?.name ?? ''}
                                    {#if $selectedWallet?.address === walletId}
                                        <span class="text-xs bg-green-500 text-white px-2 py-1 rounded-full">Your Wallet</span>
                                    {/if}
                                    {#if isCreator}
                                        <span class="text-xs bg-purple-500 text-white px-2 py-1 rounded-full flex items-center">
                                            <i class="fas fa-palette mr-1"></i> Creator
                                        </span>
                                    {/if}
                                </h1>
                                <div class="text-base md:text-lg opacity-90 flex items-center justify-center md:justify-start gap-2 mb-3">
                                    <span class="font-mono">{formattedWallet}</span>
                                    <button use:copy={walletId} 
                                           class="text-white/70 hover:text-white transition-all duration-200 active:scale-125"
                                           on:copy={() => {
                                               toast.push({
                                                   msg: `<div class="flex items-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Address copied to clipboard</div>`,
                                                   theme: {
                                                       '--toastBackground': '#48BB78',
                                                       '--toastBarBackground': '#2F855A'
                                                   }
                                               });
                                           }}
                                           aria-label="Copy wallet address">
                                        <i class="fas fa-copy"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="flex flex-col items-center md:items-end gap-2">
                                <!-- VOI Balance Card -->
                                {#if voiBalance != undefined}
                                    <div class="flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg">
                                        <div class="mr-3 h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-blue-500 to-green-400 flex items-center justify-center">
                                            <span class="font-bold text-sm md:text-base">VOI</span>
                                        </div>
                                        <div>
                                            <div class="text-base md:text-lg font-bold">{(voiBalance / Math.pow(10,6)).toLocaleString()}</div>
                                            <div class="text-xs text-white/70">VOI Balance</div>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Social/Contact Info -->
                        {#if walletEnvoi?.metadata}
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                                {#if walletEnvoi.metadata.url}
                                    <a href={walletEnvoi.metadata.url} target="_blank" rel="noopener noreferrer" 
                                        class="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition truncate">
                                        <i class="fas fa-globe"></i>
                                        <span class="truncate text-sm">{walletEnvoi.metadata.url}</span>
                                    </a>
                                {/if}
                                {#if walletEnvoi.metadata.location}
                                    <div class="flex items-center space-x-2 px-3 py-2 bg-white/10 rounded-lg truncate">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <span class="truncate text-sm">{walletEnvoi.metadata.location}</span>
                                    </div>
                                {/if}
                                {#if walletEnvoi.metadata['com.twitter']}
                                    <a href="https://x.com/{walletEnvoi.metadata['com.twitter'].replace('https://x.com/', '')}" target="_blank" 
                                        class="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition truncate">
                                        <i class="fab fa-x-twitter"></i>
                                        <span class="truncate text-sm">@{walletEnvoi.metadata['com.twitter'].replace('https://x.com/', '')}</span>
                                    </a>
                                {/if}
                                {#if walletEnvoi.metadata['com.github']}
                                    <a href="https://github.com/{walletEnvoi.metadata['com.github'].replace('https://github.com/', '')}" target="_blank" 
                                        class="flex items-center space-x-2 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg transition truncate">
                                        <i class="fab fa-github"></i>
                                        <span class="truncate text-sm">{walletEnvoi.metadata['com.github'].replace('https://github.com/', '')}</span>
                                    </a>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- External Links & Stats -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 mt-4 md:mt-6">
                    <a href="https://explorer.voi.network/explorer/account/{walletId}" 
                       target="_blank" 
                       class="flex flex-col items-center px-3 md:px-4 py-2 md:py-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-lg transition-colors duration-200">
                        <div class="text-white flex items-center mb-1 text-sm md:text-base">
                            <i class="fas fa-search mr-2"></i>
                            <span>Voi Explorer</span>
                        </div>
                        <span class="text-white/70 text-xs">View Details</span>
                    </a>
                    <a href="https://voirewards.com/wallet/{walletId}" 
                       target="_blank" 
                       class="flex flex-col items-center px-3 md:px-4 py-2 md:py-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-lg transition-colors duration-200">
                        <div class="text-white flex items-center mb-1 text-sm md:text-base">
                            <i class="fas fa-chart-line mr-2"></i>
                            <span>Voirewards</span>
                        </div>
                        <span class="text-white/70 text-xs">Analytics</span>
                    </a>
                    {#if isCreator}
                    <button 
                       on:click={() => {
                           goto(`/creator/${walletId}`);
                       }}
                       class="flex flex-col items-center px-3 md:px-4 py-2 md:py-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-lg transition-colors duration-200">
                        <div class="text-white flex items-center mb-1 text-sm md:text-base">
                            <i class="fas fa-palette mr-2"></i>
                            <span>{createdCollections.length}</span>
                        </div>
                        <span class="text-white/70 text-xs">Created</span>
                    </button>
                    {/if}
                    <div class="flex flex-col items-center px-3 md:px-4 py-2 md:py-3 bg-white/10 backdrop-blur-sm rounded-lg">
                        <div class="text-white flex items-center mb-1 text-sm md:text-base">
                            <i class="fas fa-layer-group mr-2"></i>
                            <span>{new Set(tokens.map(t => t.contractId)).size}</span>
                        </div>
                        <span class="text-white/70 text-xs">Collections</span>
                    </div>
                    <div class="flex flex-col items-center px-3 md:px-4 py-2 md:py-3 bg-white/10 backdrop-blur-sm rounded-lg">
                        <div class="text-white flex items-center mb-1 text-sm md:text-base">
                            <i class="fas fa-image mr-2"></i>
                            <span>{tokens.length}</span>
                        </div>
                        <span class="text-white/70 text-xs">Total NFTs</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-white dark:bg-gray-900">
            <div class="max-w-7xl mx-auto py-4">
                <!-- Tab Navigation -->
                <div class="border-b border-gray-200 dark:border-gray-700">
                    <nav class="flex space-x-8 px-4" aria-label="Portfolio sections">
                        <button 
                            class="py-4 px-1 border-b-2 font-medium text-sm {currentTab === 'analytics' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
                            aria-current={currentTab === 'analytics' ? 'page' : undefined}
                            on:click={() => {
                                currentTab = 'analytics';
                                goto(`/portfolio/${walletId}/analytics`, { replaceState: true });
                            }}>
                            <i class="fas fa-chart-pie mr-2"></i>
                            Analytics
                        </button>
                        <button 
                            class="py-4 px-1 border-b-2 font-medium text-sm {currentTab === 'collections' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
                            aria-current={currentTab === 'collections' ? 'page' : undefined}
                            on:click={() => {
                                currentTab = 'collections';
                                goto(`/portfolio/${walletId}/collections`, { replaceState: true });
                            }}>
                            <i class="fas fa-layer-group mr-2"></i>
                            Collections
                        </button>
                        <button 
                            class="py-4 px-1 border-b-2 font-medium text-sm {currentTab === 'gallery' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
                            aria-current={currentTab === 'gallery' ? 'page' : undefined}
                            on:click={() => {
                                currentTab = 'gallery';
                                goto(`/portfolio/${walletId}/gallery`, { replaceState: true });
                            }}>
                            <i class="fas fa-images mr-2"></i>
                            Gallery
                        </button>
                        <button 
                            class="py-4 px-1 border-b-2 font-medium text-sm {currentTab === 'activity' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
                            aria-current={currentTab === 'activity' ? 'page' : undefined}
                            on:click={() => {
                                currentTab = 'activity';
                                goto(`/portfolio/${walletId}/activity`, { replaceState: true });
                            }}>
                            <i class="fas fa-chart-line mr-2"></i>
                            Activity
                        </button>
                        <button 
                            class="hidden py-4 px-1 border-b-2 font-medium text-sm {currentTab === 'settings' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
                            aria-current={currentTab === 'settings' ? 'page' : undefined}
                            on:click={() => {
                                currentTab = 'settings';
                                goto(`/portfolio/${walletId}/settings`, { replaceState: true });
                            }}>
                            <i class="fas fa-cog mr-2"></i>
                            Settings
                        </button>
                    </nav>
                </div>

                <!-- Tab Content -->
                <div class="py-6">
                    <!-- Collections Tab -->
                    <div class="space-y-6" class:hidden={currentTab !== 'collections'}>
                        <PortfolioCollections tokens={tokens} collections={collections} walletId={walletId} />
                    </div>
                    
                    <!-- Gallery Tab -->
                    <div class="space-y-6" class:hidden={currentTab !== 'gallery'}>
                        <div class="flex flex-col" bind:this={containerRef}>
                            <div class="px-4">
                                <!-- Search & Filter Controls -->
                                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-8">
                                    <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div class="w-full md:w-auto flex-grow">
                                            <div class="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Search by name, collection, or traits..."
                                                    class="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                    bind:value={searchQuery}
                                                />
                                                <i class="fas fa-search absolute left-3 top-3.5 text-gray-400"></i>
                                            </div>
                                        </div>
                                        <div class="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
                                            <div class="flex items-center gap-2">
                                                <select
                                                    bind:value={portfolioSort}
                                                    class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                                >
                                                    {#each sortOptions as option}
                                                        <option value={option.id}>{option.name}</option>
                                                    {/each}
                                                </select>
                                                <button
                                                    on:click={() => sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}
                                                    class="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                                                    title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                                                    aria-label={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                                                >
                                                    <i class="fas fa-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
                                                </button>
                                            </div>
                                            <button
                                                on:click={() => multiselectMode = !multiselectMode}
                                                class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors duration-200"
                                            >
                                                <i class="fas fa-check-square mr-2"></i>
                                                {multiselectMode ? 'Exit Select Mode' : 'Select Multiple'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Collection View -->
                                {#if isCollectionView}
                                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                                        {#each [...collectionGroups.entries()] as [contractId, collectionTokens]}
                                            {@const collection = collections.find(c => c.contractId === Number(contractId))}
                                            <div class="w-full rounded-xl overflow-hidden shadow-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-lg">
                                                <div class="relative">
                                                    <div class="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>
                                                    <div class="h-32 w-full bg-gradient-to-r from-blue-500/30 to-purple-500/30 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center overflow-hidden">
                                                        {#if collection?.highforgeData?.coverImageURL}
                                                            <img src={getImageUrl(collection.highforgeData.coverImageURL || '', 320)} 
                                                                 alt={collection?.highforgeData?.title || 'Collection Cover'}
                                                                 class="w-full h-full object-cover opacity-80">
                                                        {/if}
                                                    </div>
                                                    <div class="absolute bottom-0 left-0 right-0 p-3 flex justify-between items-end">
                                                        <a href={`/collection/${contractId}`} class="text-lg font-bold text-white flex items-center group">
                                                            <span class="group-hover:underline">{collection ? collection.highforgeData?.title : 'Unknown Collection'}</span>
                                                        </a>
                                                        <span class="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{collectionTokens.length}</span>
                                                    </div>
                                                </div>
                                                
                                                <div class="p-3">
                                                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-3">
                                                        {#each collectionTokens.slice(0, 10) as token, i}
                                                            {#if token.owner === walletId}
                                                                <div
                                                                    tabindex="0"
                                                                    role="button"
                                                                    class="aspect-square rounded-md overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 relative"
                                                                    on:click={() => toggleSelectedTokens(token)}
                                                                    on:keydown={(e) => e.key === 'Enter' && toggleSelectedTokens(token)}>
                                                                    <img 
                                                                        src={getImageUrl(token.metadata?.image || '', 120)} 
                                                                        alt={token.metadata?.name || `Token #${token.tokenId}`}
                                                                        class="w-full h-full object-cover" />
                                                                    {#if multiselectMode && selectedTokens.some(t => t.tokenId === token.tokenId && t.contractId === token.contractId)}
                                                                        <div class="absolute inset-0 bg-blue-500/30 flex items-center justify-center">
                                                                            <div class="bg-white rounded-full p-1">
                                                                                <i class="fas fa-check text-blue-500"></i>
                                                                            </div>
                                                                        </div>
                                                                    {/if}
                                                                </div>
                                                            {/if}
                                                        {/each}
                                                        {#if collectionTokens.length > 10}
                                                            <div class="aspect-square rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                                <span class="text-gray-500 dark:text-gray-300 font-bold">+{collectionTokens.length - 10}</span>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                    
                                                    <div class="flex justify-between items-center">
                                                        <a href={`/collection/${contractId}`} 
                                                           class="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                                            View collection details
                                                        </a>
                                                        {#if collectionTokens.length > 10}
                                                            <button 
                                                                class="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                                                on:click={() => {
                                                                    portfolioSort = 'collection';
                                                                    searchQuery = collection?.highforgeData?.title || '';
                                                                }}>
                                                                View all
                                                            </button>
                                                        {/if}
                                                    </div>
                                                </div>
                                            </div>
                                        {/each}
                                    </div>
                                <!-- Standard View -->
                                {:else}
                                    <div class="flex flex-col">
                                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                            {#each filteredTokens.slice(0, displayCount) as token, i}
                                                {#if token.owner === walletId}
                                                    <div class="rounded-xl hover:shadow-md transition-all"
                                                        tabindex="0"
                                                        role="button"
                                                        on:mousedown={handleLongPress} 
                                                        on:touchstart={handleLongPress} 
                                                        on:click={() => toggleSelectedTokens(token)} 
                                                        on:keydown={(e) => e.key === 'Enter' && toggleSelectedTokens(token)}
                                                        on:click|stopPropagation={checkStopPropagation}>
                                                        
                                                        <div class="relative">
                                                            <TokenDetail collection={collections.find(c => c.contractId === token.contractId)} bind:token={token} showOwnerIcon={false} showMenuIcon={!multiselectMode} />
                                                            {#if multiselectMode}
                                                                <div class="absolute top-2 left-2 h-6 w-6">
                                                                    <input type="checkbox" 
                                                                        class="h-6 w-6 rounded-md border-2 border-white accent-blue-500" 
                                                                        on:click|stopPropagation={() => toggleSelectedTokens(token)} 
                                                                        checked={selectedTokens.some(t => t.tokenId === token.tokenId && t.contractId === token.contractId)} />
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    </div>
                                                {/if}
                                            {/each}
                                        </div>
                                        
                                        {#if tokens.length === 0}
                                            <div class="flex flex-col items-center justify-center py-12 text-center">
                                                <div class="text-6xl mb-4 text-gray-300 dark:text-gray-700">
                                                    <i class="fas fa-image-slash"></i>
                                                </div>
                                                <div class="text-2xl font-bold mb-2">No tokens found</div>
                                                <div class="text-gray-500 mb-6">Want to get some NFTs in your collection?</div>
                                                <A href="https://nautilus.sh/" target="_blank" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                                                    <i class="fas fa-shopping-cart mr-2"></i>
                                                    Check out Nautilus Marketplace
                                                </A>
                                            </div>
                                        {/if}
                                        
                                        {#if filteredTokens.length > displayCount}
                                            <div class="w-full flex justify-center mt-8">
                                                <button 
                                                    class="px-6 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                                    on:click={() => displayCount += 10}>
                                                    Load more NFTs
                                                </button>
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Activity Tab -->
                    <div class:hidden={currentTab !== 'activity'}>
                        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-5xl mx-auto">
                            <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                                <h2 class="text-2xl font-bold">Transaction History</h2>
                            </div>
                            
                            <!-- Transaction Table -->
                            <div class="overflow-hidden">
                                <TransactionTable owner={walletId} />
                            </div>
                        </div>
                    </div>

                    <!-- Analytics Tab -->
                    <div class:hidden={currentTab !== 'analytics'}>
                        <PortfolioAnalytics {tokens} {collections} {walletId} />
                    </div>

                    <!-- Settings Tab -->
                    <div class:hidden={currentTab !== 'settings'}>
                        <PortfolioSettings 
                            {walletId}
                            {hidePortfolioValue}
                            {hideActivity}
                            {notifyOffers}
                            {notifyPriceChanges}
                            {notifyNewDrops}
                            {sortOptions}
                            bind:portfolioSort
                            bind:isCollectionView
                            bind:showListedOnly
                            bind:shortName
                        />
                    </div>
                </div>
            </div>
        </div>
        {#if multiselectMode}
            <div class="fixed bottom-0 right-0 p-4 flex space-x-2 z-10">
                <button class="bg-blue-500 text-white rounded-lg p-2" on:click={() => clearMultiSelectMode()}>
                    Cancel
                </button>
                <div class="bg-blue-500 text-white rounded-lg p-2">
                    <button on:click={() => selectedTokens = []}>
                        Clear Selection
                    </button>
                    |
                    <button on:click={() => selectedTokens = tokens.filter(t => t.owner === walletId)}>
                        All
                    </button>
                </div>
                <button class="bg-blue-500 text-white rounded-lg p-2" on:click={() => showSendTokenModal = true}>Send ({selectedTokens.length})</button>
            </div>
            {#if showSendTokenModal}
                <SendTokenModal bind:showModal={showSendTokenModal} tokens={selectedTokens} fromAddr={walletId} onClose={() => showSendTokenModal = false} onAfterSend={() => clearMultiSelectMode()} />
            {/if}
        {/if}
    {:else}
        <div class="flex flex-col items-center justify-center mt-20">
            <div class="text-2xl font-bold mb-4">Connect your wallet to view your NFT portfolio</div>
            <div class="relative">
                <i class="fas fa-arrow-up text-4xl text-blue-500 absolute -top-16 -right-40 transform rotate-45"></i>
                <div class="text-lg text-gray-600">Click the "Connect Wallet" button in the upper right corner</div>
            </div>
        </div>
    {/if}
</div>
<style>
</style>