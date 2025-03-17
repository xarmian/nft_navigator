<script lang="ts">
	import type { PageData } from '../$types';
    import type { Token, Collection, Metadata } from '$lib/data/types';
	import Switch from '$lib/component/ui/Switch.svelte';
    import { inview } from 'svelte-inview';
    import Select from '$lib/component/ui/Select.svelte';
    import SalesTable from '$lib/component/ui/SalesTable.svelte';
    import HoldersList from '$lib/component/ui/HoldersList.svelte';
	import NautilusButton from '$lib/component/ui/NautilusButton.svelte';
    import HighforgeButton from '$lib/component/ui/HighforgeButton.svelte';
	import NftGamesButton from '$lib/component/ui/NFTGamesButton.svelte';
    import { getImageUrl, handleScroll } from '$lib/utils/functions';
	import { goto } from '$app/navigation';
	import PixelPursuitButton from '$lib/component/ui/PixelPursuitButton.svelte';
	import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
	import LoungeButton from '$lib/component/ui/LoungeButton.svelte';
	import Share from '$lib/component/ui/Share.svelte';
    import { onMount, onDestroy } from 'svelte';
    import { tokenCache } from '$lib/stores/tokenCache';
    import { algodIndexer } from '$lib/utils/algod';
    import { getEnvoiNames } from '$lib/utils/envoi';
    import { selectedWallet } from "avm-wallet-svelte";
	import LoungeView from '$lib/component/ui/LoungeView.svelte';

    //const forsale = $page.url.searchParams.get('forsale');

    export let data: PageData;
    $: contractId = data.contractId;
    let subpage = data.subpage;
    $: tokens = data.tokens as Token[];
    let collectionName = data.collectionName.trim();
    $: collection = data.collection as Collection;
    let filteredTokens = [] as Token[];
    let displayCount = 10;
    $: filters = data.filters;
    let searchText = '';
    $: displayTab = subpage === 'forsale' ? 'forsale' : subpage === '' ? 'tokens' : subpage;
    $: categories = data.categories;
    $: forSaleCollection = displayTab === 'forsale';
    let bannerOpacity = 1;
    let wallet: any = null;
    let userTokens: Token[] = [];
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

    // Fetch creator's Envoi metadata when collection changes
    $: {
        if (collection?.creator && collection.creatorName?.endsWith('.voi')) {
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
    });

    // Calculate counts for tabs
    $: forSaleCount = tokens?.filter(t => t.marketData && !t.marketData.sale && !t.marketData.delete)?.length ?? 0;
    $: totalTokens = tokens?.length ?? 0;
    $: burnedTokens = tokens?.filter(t => t.isBurned)?.length ?? 0;
    $: uniqueCollectors = new Set(tokens?.map(t => t.owner)).size;
    $: userTokenCount = (wallet && tokens) ? tokens?.filter(t => t.owner === wallet.address)?.length ?? 0 : 0;

    $: tabs = [ 
        {id: 'tokens', name: 'All Tokens', count: totalTokens, sortable: true}, 
        {id: 'forsale', name: 'For Sale', count: forSaleCount, sortable: true},
        {id: 'mine', name: 'Mine', count: userTokenCount, sortable: true},
        {id: 'ranking', name: 'Ranking', sortable: true},
        {id: 'transactions', name: 'Transactions', sortable: true},
        {id: 'collectors', name: 'Collectors', count: uniqueCollectors, sortable: true}, 
        {id: 'burned', name: 'Burned Tokens', count: burnedTokens, sortable: true},
        {id: 'lounge', name: 'Chat', sortable: true}
    ];

    // Add scroll handler
    onMount(() => {
        const handleScroll = () => {
            const scrollY = window.scrollY;
            const fadeStartPoint = 0;
            const fadeEndPoint = 300;
            bannerOpacity = Math.max(0, 1 - (scrollY - fadeStartPoint) / (fadeEndPoint - fadeStartPoint));
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    });

    // Initialize the token cache when tokens change
    $: {
        if (tokens && tokens.length > 0) {
            tokenCache.setTokens(contractId.toString(), tokens);
            // Apply initial visibility based on current tab
            tokenCache.updateVisibility(contractId.toString(), searchText, displayTab, filters);
        }
    }

    // Update visibility when search text, tab, or filters change
    $: {
        if (tokens && tokens.length > 0 && $tokenCache[contractId.toString()]) {
            tokenCache.updateVisibility(contractId.toString(), searchText, displayTab, filters);
        }
    }

    // Get tokens from the cache and apply sorting
    $: {
        const cached = $tokenCache[contractId.toString()];
        if (cached) {
            let visibleTokens = cached.tokens;
            
            // First apply visibility filter
            visibleTokens = visibleTokens.filter(t => t.visible);
            
            // Then apply tab-specific filters
            if (displayTab === 'forsale') {
                visibleTokens = visibleTokens.filter(t => t.marketData && !t.marketData.sale && !t.marketData.delete);
            } else if (displayTab === 'mine' && wallet) {
                visibleTokens = visibleTokens.filter(t => t.owner === wallet.address);
            } else if (displayTab === 'burned') {
                visibleTokens = visibleTokens.filter(t => t.isBurned);
            }
            
            // Apply sorting based on current tab and direction
            if (tabs.find(t => t.id === displayTab)?.sortable) {
                visibleTokens.sort((a: Token, b: Token) => {
                    if (displayTab === 'ranking') {
                        if (a.rank === undefined) return 1;
                        if (b.rank === undefined) return -1;
                        return sortDirection === 'asc' ? (a?.rank??0) - (b?.rank??0) : (b?.rank??0) - (a?.rank??0);
                    }
                    else if (displayTab === 'forsale') {
                        const aPrice = a.marketData?.price ?? Number.MAX_VALUE;
                        const bPrice = b.marketData?.price ?? Number.MAX_VALUE;
                        return sortDirection === 'asc' ? aPrice - bPrice : bPrice - aPrice;
                    } else {
                        const aName = Number(a.tokenId) || 0;
                        const bName = Number(b.tokenId) || 0;
                        return sortDirection === 'asc' ? aName - bName : bName - aName;
                    }
                });
            }
            
            filteredTokens = visibleTokens;
        }
    }

    onDestroy(() => {
        // Clear this collection's cache when the component is destroyed
        tokenCache.clearCollection(contractId.toString());
    });

    // Update displayTab reactivity to handle subpage changes
    $: {
        const newTab = subpage === 'forsale' ? 'forsale' : subpage === '' ? 'tokens' : subpage;
        if (displayTab !== newTab) {
            displayTab = newTab;
            // Reset display count when changing tabs
            displayCount = 10;
        }
    }

    async function onSubpageChange(newPage: string | number) {
        // Update the subpage immediately
        subpage = newPage === 'tokens' ? '' : newPage.toString();
        displayTab = newPage.toString();
        
        // Reset display count
        displayCount = 10;

        // Navigate to new URL
        if (newPage === 'tokens') {
            await goto(`/collection/${contractId}`);
        } else {
            await goto(`/collection/${contractId}/${newPage}`);
        }
    }
    
    function showMore() {
        displayCount += 10;
    }

    let inputElement: HTMLInputElement;

    async function handleTabSort(tabId: string) {
        const tab = tabs.find(t => t.id === tabId);
        if (tab?.sortable && displayTab === tabId) {
            tabSortDirections[tabId] = tabSortDirections[tabId] === 'asc' ? 'desc' : 'asc';
        } else {
            await onSubpageChange(tabId);
        }
    }

    // Function to get mint date from round
    async function getMintDate() {
        if (collection?.mintRound) {
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

    // Call getMintDate when collection changes
    $: {
        if (collection?.mintRound) {
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
</script>

{#if collection}
<div class="banner_container min-h-[400px] md:h-60 justify-between overflow-hidden relative flex flex-row text-white" style="opacity: {bannerOpacity}; transition: opacity 0.3s ease-out;">
    {#if tokens[0] && tokens[0].metadata?.image}
        <img src="{getImageUrl(data.collection?.highforgeData?.coverImageURL ?? tokens[0].metadata?.image,480)}" alt="Collection Banner" class="banner_img object-cover" />
        <img src="{getImageUrl(data.collection?.highforgeData?.coverImageURL ?? tokens[0].metadata?.image,480)}" alt="Collection Banner" class="banner_img2 w-1/2 object-cover" />
    {/if}
    <div class="mask_dark flex justify-center h-full absolute w-full content-center">
        <div class="collection_detail w-1/2 flex justify-center content-center md:space-x-10 pr-2">
            <div class="flex h-full place-items-center space-between flex-col space-y-1 w-full sm:w-3/4 md:flex-grow">
                    <div class="p-0 sm:p-4 overflow-auto mb-auto">
                        {#if collectionDescription}
                            <div class="text-4xl font-bold md:text-left text-center">{data.collection?.highforgeData?.title??collectionName}</div>
                            <div class="text-md md:text-left text-center">{collectionDescription}</div>
                        {/if}
                        <!-- Add creator's Envoi metadata if available -->
                        {#if collection?.creatorName?.endsWith('.voi') && creatorEnvoiMetadata}
                            <div class="flex flex-col space-y-2 mt-4">
                                {#if creatorEnvoiMetadata.url}
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-globe text-gray-300"></i>
                                        <a href={creatorEnvoiMetadata.url} target="_blank" rel="noopener noreferrer" 
                                           class="text-blue-400 hover:text-blue-300 text-sm">{creatorEnvoiMetadata.url}</a>
                                    </div>
                                {/if}
                                {#if creatorEnvoiMetadata.location}
                                    <div class="flex items-center space-x-2">
                                        <i class="fas fa-map-marker-alt text-gray-300"></i>
                                        <span class="text-gray-300 text-sm">{creatorEnvoiMetadata.location}</span>
                                    </div>
                                {/if}
                                {#if creatorEnvoiMetadata['com.twitter']}
                                    <div class="flex items-center space-x-2">
                                        <i class="fab fa-x-twitter text-gray-300"></i>
                                        <a href="https://twitter.com/{creatorEnvoiMetadata['com.twitter']}" target="_blank" 
                                           class="text-blue-400 hover:text-blue-300 text-sm">@{creatorEnvoiMetadata['com.twitter']}</a>
                                    </div>
                                {/if}
                                {#if creatorEnvoiMetadata['com.github']}
                                    <div class="flex items-center space-x-2">
                                        <i class="fab fa-github text-gray-300"></i>
                                        <a href="https://github.com/{creatorEnvoiMetadata['com.github']}" target="_blank" 
                                           class="text-blue-400 hover:text-blue-300 text-sm">{creatorEnvoiMetadata['com.github']}</a>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                <!-- Integrated buttons section for desktop -->
                <div class="hidden md:flex flex-row gap-2 mb-4 px-4">
                    <LoungeButton contractid={contractId} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer text-black hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200 space-x-2"/>
                    <NautilusButton contractid={contractId} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200"/>
                    <HighforgeButton contractid={contractId} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200"/>
                        <PixelPursuitButton contractid={contractId} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 text-black dark:text-black px-2 py-1.5 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200"/>
                </div>
                <div class="flex flex-row pl-4 mt-auto w-full pt-4 bg-black bg-opacity-50 rounded-t-xl">
                    <div class="flex flex-row justify-between w-full mx-4 flex-wrap gap-y-2">
                        {#if isMinting}
                            <div class="w-full mb-3">
                                <div class="flex justify-between items-center text-sm mb-1.5">
                                    <span class="font-medium">Mint Progress</span>
                                    <span class="text-blue-300">{totalMinted} / {maxSupply} ({mintProgress}%)</span>
                                </div>
                                <div class="w-full bg-gray-700 bg-opacity-50 rounded-full h-2">
                                    <div class="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 relative" style="width: {mintProgress}%">
                                        <div class="absolute -right-1 -top-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                                    </div>
                                </div>
                                {#if launchEnd > 0}
                                    <div class="text-xs text-gray-400 mt-1 text-right">
                                        Mint Ends: {new Date(launchEnd * 1000).toLocaleString()}
                                    </div>
                                {/if}
                            </div>
                        {/if}
                        <div class="w-1/3 md:w-auto text-center md:text-left">
                            <div class="text-sm">Floor</div>
                            <div class="text-lg text-blue-300 cursor-pointer hover:text-blue-200 transition-colors" 
                                on:click={() => {
                                    tabSortDirections.forsale = 'asc';
                                    onSubpageChange('forsale');
                                }}>
                                {data.floor}
                            </div>
                        </div>
                        <div class="w-1/3 md:w-auto text-center md:text-left">
                            <div class="text-sm">Ceiling</div>
                            <div class="text-lg text-blue-300 cursor-pointer hover:text-blue-200 transition-colors" 
                                on:click={() => {
                                    tabSortDirections.forsale = 'desc';
                                    onSubpageChange('forsale');
                                }}>
                                {data.ceiling}
                            </div>
                        </div>
                        <div class="tooltip w-1/3 md:w-auto text-center md:text-left">
                            <div class="text-sm">Tokens</div>
                            <div class="text-lg text-blue-300 cursor-pointer hover:text-blue-200 transition-colors" 
                                on:click={() => onSubpageChange('tokens')}>
                                {collection?.totalSupply ? (collection.totalSupply - (collection.burnedSupply || 0)) : '-'}
                            </div>
                            <div class="tooltiptext flex flex-col space-y-1 w-auto whitespace-nowrap p-2 bg-slate-700">
                                <div>Original Supply: {collection?.totalSupply ?? '-'}</div>
                                <div>Tokens Burned: {collection?.burnedSupply ?? '0'}</div>
                                <div>Tokens Remaining: {collection?.totalSupply ? (collection.totalSupply - (collection.burnedSupply || 0)) : '-'}</div>
                            </div>
                        </div>
                        <div class="w-1/3 md:w-auto text-center md:text-left">
                            <div class="text-sm">Collectors</div>
                            <div class="text-lg text-blue-300 cursor-pointer hover:text-blue-200 transition-colors" 
                                on:click={() => onSubpageChange('collectors')}>
                                {collection?.uniqueOwners}
                            </div>
                        </div>
                        <div class="w-1/3 md:w-auto text-center md:text-left">
                            <div class="text-sm">Minted</div>
                            <div class="text-lg text-blue-300">
                                <div class="tooltip cursor-pointer" on:click={() => collection?.mintRound && openExplorer(collection.mintRound)}>
                                    {mintDate ?? '-'}
                                    {#if mintDateTime}
                                        <div class="tooltiptext w-[400px] p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
                                            <div class="text-base font-semibold mb-3 text-white border-b border-gray-700 pb-2">Collection Details</div>
                                            
                                            <!-- Collection Creation -->
                                            <div class="mb-4">
                                                <div class="text-xs text-gray-400 mb-1">Collection Created</div>
                                                <div class="flex items-center gap-2 text-sm text-gray-200">
                                                    <i class="fas fa-calendar text-blue-400"></i>
                                                    <span>{mintDateTime}</span>
                                                </div>
                                                <div class="flex items-center gap-2 text-sm text-gray-200 mt-1">
                                                    <i class="fas fa-cube text-blue-400"></i>
                                                    <span>Block #{collection?.mintRound}</span>
                                                </div>
                                            </div>

                                            <!-- Mint Phases -->
                                            <div class="space-y-3">
                                                {#if wlLaunchStart}
                                                    <div>
                                                        <div class="text-xs text-gray-400 mb-1">Whitelist Launch Phase</div>
                                                        <div class="bg-gray-900 rounded p-2">
                                                            <div class="flex justify-between items-center text-sm">
                                                                <div class="flex items-center gap-2 text-gray-200">
                                                                    <i class="fas fa-clock text-purple-400"></i>
                                                                    <span>{formatDateTime(wlLaunchStart)}</span>
                                                                </div>
                                                                {#if wlPrice}
                                                                    <div class="flex items-center gap-2 text-gray-200">
                                                                        <i class="fas fa-tag text-purple-400"></i>
                                                                        <span>{wlPrice.toLocaleString()} VOI</span>
                                                                    </div>
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    </div>
                                                {/if}

                                                {#if launchStart}
                                                    <div>
                                                        <div class="text-xs text-gray-400 mb-1">Public Launch Phase</div>
                                                        <div class="bg-gray-900 rounded p-2">
                                                            <div class="flex justify-between items-center text-sm">
                                                                <div class="flex items-center gap-2 text-gray-200">
                                                                    <i class="fas fa-clock text-green-400"></i>
                                                                    <span>{formatDateTime(launchStart)}</span>
                                                                </div>
                                                                {#if publicPrice}
                                                                    <div class="flex items-center gap-2 text-gray-200">
                                                                        <i class="fas fa-tag text-green-400"></i>
                                                                        <span>{publicPrice.toLocaleString()} VOI</span>
                                                                    </div>
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    </div>
                                                {/if}
                                            </div>

                                            <div class="text-[10px] text-blue-400 mt-3 text-center">Click to view creation block in explorer</div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="w-1/3 md:w-auto text-center md:text-left">
                            <div class="text-sm">Creator</div>
                            <div class="text-lg text-blue-300 hover:text-blue-200"><a href='/portfolio/{collection?.creator}'>{collection?.creatorName ?? collection?.creator.substring(0,8) + '...'}</a></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Mobile buttons container -->
<div class="flex md:hidden justify-between gap-2 p-4 bg-black bg-opacity-50">
    <LoungeButton contractid={contractId} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 px-2 py-2 rounded-md cursor-pointer text-black min-w-0"/>
    <NautilusButton contractid={contractId} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 px-2 py-2 rounded-md cursor-pointer min-w-0"/>
    <HighforgeButton contractid={contractId} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 px-2 py-2 rounded-md cursor-pointer min-w-0"/>
    <PixelPursuitButton contractid={contractId} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 text-black dark:text-black px-2 py-2 rounded-md cursor-pointer min-w-0"/>
</div>
<div class="flex flex-col md:flex-row pb-16 relative z-0">
    <!-- Mobile Dropdown and Sort -->
    <div class="md:hidden px-4 py-2 space-y-2">
        <div class="flex gap-2">
            <select
                class="flex-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
                value={displayTab}
                on:change={(e) => {
                    const target = e.target as HTMLSelectElement;
                    if (target) {
                        onSubpageChange(target.value);
                    }
                }}
            >
                {#each tabs as tab}
                    <option value={tab.id}>
                        {tab.name}{tab.count !== undefined ? ` (${tab.count})` : ''}
                    </option>
                {/each}
            </select>
            {#if tabs.find(t => t.id === displayTab)?.sortable}
                <button
                    class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 flex items-center justify-center min-w-[44px]"
                    on:click={() => handleTabSort(displayTab)}
                    aria-label="Toggle sort order"
                >
                    {sortDirection === 'asc' ? '↑' : '↓'}
                </button>
            {/if}
        </div>
    </div>

    <div class="p-4 w-full md:w-auto">
        <div class="relative self-start">
            <input type="text" placeholder="Search tokens..." bind:value={searchText} bind:this={inputElement} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600 w-full pr-10"/>
            {#if searchText}
                <button class="absolute inset-y-0 right-0 pr-3 flex items-center w-10" on:click={() => { searchText = ''; inputElement.focus(); }}
                    aria-label="Clear Search">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            {/if}
        </div>
        <div class="hidden md:block">
            {#each Object.entries(categories) as [category, traits]}
                <div class="mt-2 mb-2">
                    <label class="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2 cursor-pointer flex items-center gap-2" 
                        for={category} 
                        on:click={() => handleTabSort(category)}>
                        {category}
                    </label>
                    <div class="relative">
                        <select bind:value={filters[category]} class="block appearance-none w-48 bg-white border border-gray-300 dark:border-gray-500 text-gray-700 dark:bg-gray-600 dark:text-gray-200 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500" id={category}>
                            <option value="">All</option>
                            {#if traits}
                                {#each Object.entries(traits) as [trait, count]}
                                    <option value={trait}>{trait+' ('+count+')'}</option>
                                {/each}
                            {/if}
                        </select>
                    </div>
                </div>
            {/each}
        </div>
    </div>

    <div class="w-full md:mt-3">
        <!-- Desktop Tabs -->
        <div class="hidden md:flex justify-start gap-2">
            {#each tabs as tab}
                <button
                    class="rounded-lg transition-colors flex flex-col items-center p-1.5 min-w-[80px]
                        {displayTab === tab.id 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}"
                    on:click={() => handleTabSort(tab.id)}
                >
                    <div class="flex items-center gap-1.5">
                        <!-- Icons for each tab -->
                        {#if tab.id === 'tokens'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        {:else if tab.id === 'forsale'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        {:else if tab.id === 'ranking'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        {:else if tab.id === 'transactions'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        {:else if tab.id === 'collectors'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        {:else if tab.id === 'burned'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                            </svg>
                        {:else if tab.id === 'mine'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        {:else if tab.id === 'lounge'}
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 18v-3a2 2 0 012-2h12a2 2 0 012 2v3" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 15V8a2 2 0 012-2h12a2 2 0 012 2v7" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 8h12" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 11h12" />
                            </svg>
                        {/if}
                        {#if tab.sortable && displayTab === tab.id}
                            <span class="text-xs font-bold">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                        {/if}
                    </div>
                    <div class="flex items-center gap-1 mt-0.5">
                        <span class="text-xs">{tab.name}</span>
                        {#if tab.count !== undefined}
                            <span class="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-xs font-normal {displayTab === tab.id ? 'bg-opacity-25 text-white' : ''}">{tab.count}</span>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
        <div class="flex flex-wrap flex-grow justify-center md:justify-start mt-3 md:mt-0">
            {#if displayTab === 'tokens' || displayTab === 'forsale' || displayTab === 'burned' || displayTab === 'ranking' || displayTab === 'mine'}
                {#each filteredTokens.slice(0, displayCount) as token (token.tokenId)}
                    <div class="p-1 relative">
                        <TokenDetail {collection} token={token} format="small" />
                    </div>
                {/each}
                {#if filteredTokens.length > displayCount}
                    <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
                {/if}
            {:else if displayTab === 'transactions'}
                <div class="w-full">
                    <SalesTable collectionId={Number(contractId)} sortDirection={sortDirection} tokenId={!isNaN(Number(searchText)) && displayTab === 'transactions' ? searchText : ''} />
                </div>
            {:else if displayTab === 'collectors'}
                <div class="w-full">
                    <HoldersList tokens={tokens} sortDirection={sortDirection} searchText={searchText} />
                </div>
            {:else if displayTab === 'lounge'}
                <div class="w-full">
                    <LoungeView collectionId={Number(contractId)} sortDirection={sortDirection} searchText={searchText} />
                </div>
            {/if}
        </div>
    </div>
</div>
{:else}
    <div class="w-full flex justify-center items-center h-screen">
        <div class="text-xl font-bold">Unable to locate collection: {contractId}</div>
    </div>
{/if}

<style>
    /*.show-more {
        display: block;
        margin: 0px auto 40px auto;
        padding: 10px 20px;
        font-size: 16px;
        color: white;
        background-color: #007BFF;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    .show-more:hover {
        background-color: #0056b3;
    }*/
    .sentinel {
        height: 1px;
        width: 100%;
    }
    .mask_dark {
        background: radial-gradient(circle at center, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.9), rgba(0,0,0,0), rgba(0,0,0,1) 100%);
    }
    .banner_img {
        width: calc(50%);
    }
    .collection_detail {
        width: 50%;
    }
    .tooltip {
        position: relative;
        display: inline-block;
    }

    .tooltip .tooltiptext {
        visibility: hidden;
        border-radius: 6px;
        position: absolute;
        z-index: 100;
        bottom: 125%;
        left: 50%;
        margin-left: -60px;
        opacity: 0;
        transition: opacity 0.3s;
    }

    .tooltip:hover .tooltiptext {
        visibility: visible;
        opacity: 1;
    }
    @media (max-width: 768px) {
        .mask_dark {
            background: linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.9));
        }
        .banner_img {
            filter: blur(2px);
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .banner_img2 {
            display: none;
        }
        .banner_container {
            height: auto;
        }
        .collection_detail {
            width: 100%;
            padding: 1rem;
            padding-bottom: 0;
        }
        .tooltip .tooltiptext {
            left: 0;
            margin-left: 0;
            width: 100%;
        }
    }
</style>