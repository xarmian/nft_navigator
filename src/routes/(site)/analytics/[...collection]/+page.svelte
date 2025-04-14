<script lang="ts">
	import type { PageData } from './$types';
    import Select from '$lib/component/ui/Select.svelte';
	import type { Collection, Sale, Listing, Transfer } from '$lib/data/types';
    import { goto } from '$app/navigation';
	import DatePeriodSelector from '$lib/component/ui/DatePeriodSelector.svelte';
    import SalesTable from '$lib/component/ui/SalesTable.svelte';
    import SalesChart from '$lib/component/ui/SalesChart.svelte';
    import { userPreferences, recentSearch } from '../../../../stores/collection';
    import { onDestroy, onMount } from 'svelte';
    import { indexerBaseURL } from '$lib/utils/indexer';
    import { TabItem, Tabs, Card } from 'flowbite-svelte';
    import { format, subDays, subWeeks, subMonths } from 'date-fns';
	import CollectionSingle from '$lib/component/ui/CollectionSingle.svelte';
    import NautilusButton from '$lib/component/ui/NautilusButton.svelte';
    import HighforgeButton from '$lib/component/ui/HighforgeButton.svelte';
    import LoungeButton from '$lib/component/ui/LoungeButton.svelte';
    import Share from '$lib/component/ui/Share.svelte';
    import type { Token } from '$lib/data/types';
    import HoldersList from '$lib/component/ui/HoldersList.svelte';
    import { getTokens, getTransfers, getCollections } from '$lib/utils/indexer';

    export let data: PageData & {
        tokens?: Token[];
    };

    let collectionOptions = data.collectionOptions;
    $: collection = data.collection;
    let tokens: Token[] = data.tokens ?? [];
    let isLoading = false;
    let isLoadingMarket = false;
    let isLoadingMints = false;
    let marketTokenData: Record<string, Listing> = {};
    let collections: Collection[] = [];
    
    // Minting stats
    let mintCount = 0;
    let mintVolume = 0;
    let mintChange = null as number | null;
    let mintVolumeChange = null as number | null;
    let mints: Transfer[] = [];
    let prevMints: Transfer[] = [];
    let prevMintVolume = 0;
    const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
    let searchText = '';
    // Fetch tokens when collection changes
    $: {
        if (!data.tokens && collection?.contractId) {
            isLoading = true;
            getTokens({ contractId: collection.contractId })
                .then(fetchedTokens => {
                    tokens = fetchedTokens;
                    isLoading = false;
                })
                .catch(error => {
                    console.error('Error fetching tokens:', error);
                    isLoading = false;
                });
        }
    }
    
    type ChartDataPoint = {
        date: string;
        value: number;
        salesCount: number;
        voi: number;
        mintCount: number;
        mintVolume: number;
    };
    
    let chartData: ChartDataPoint[] = [];
    let marketData: { listings: Listing[] } = { listings: [] };

    // Fetch market data when collection changes
    $: {
        if (collection?.contractId) {
            isLoadingMarket = true;
            fetch(`${indexerBaseURL}/mp/listings?collectionId=${collection.contractId}&active=true`)
                .then(response => response.json())
                .then(data => {
                    marketData = data;
                    // Update market token data mapping
                    marketTokenData = Object.fromEntries(
                        data.listings
                            .filter((l: Listing) => !l.sale && !l.delete)
                            .map((l: Listing) => [l.tokenId, l])
                    );
                    isLoadingMarket = false;
                })
                .catch(error => {
                    console.error('Error fetching market data:', error);
                    isLoadingMarket = false;
                });
        }
    }

    // Combine tokens with market data
    $: tokensWithMarket = tokens.map(token => {
        const marketToken = marketTokenData[token.tokenId];
        if (marketToken && token.owner === marketToken.seller) {
            return { ...token, marketData: marketToken };
        }
        return token;
    });
    
    // Collection Stats
    $: uniqueHolders = new Set(tokensWithMarket.filter(t => !t.isBurned).map(t => t.owner)).size;
    $: totalTokens = tokensWithMarket.length;
    $: burnedTokens = tokensWithMarket.filter(t => t.isBurned).length;
    $: activeSupply = totalTokens - burnedTokens;
    $: holderConcentration = activeSupply > 0 ? (uniqueHolders / activeSupply) * 100 : 0;
    
    // Market Stats
    $: activeListings = marketData.listings.filter(l => !l.sale && !l.delete).length;
    $: listingRate = activeSupply > 0 ? (activeListings / activeSupply) * 100 : 0;
    $: floorPrice = marketData.listings
        .filter(l => !l.sale && !l.delete)
        .reduce((min, l) => Math.min(min, (l.price ?? Infinity) / Math.pow(10, 6)), Infinity);
    $: ceilingPrice = marketData.listings
        .filter(l => !l.sale && !l.delete)
        .reduce((max, l) => Math.max(max, (l.price ?? -Infinity) / Math.pow(10, 6)), -Infinity);

    // Metrics
    $: voiVolume = null as number | null;
    $: totalSales = null as number | null;
    $: avgPrice = null as number | null;
    $: volumeChange = null as number | null;
    $: salesChange = null as number | null;
    $: selectedCollectionId = collection?.contractId ?? 0;
    let sales: Sale[] = [];

    // Time range handling
    const now = new Date();
    const defaultStart = subDays(now, 7);
    const defaultEnd = now;

    $: startTime = $userPreferences.analyticsStart ?? defaultStart;
    $: endTime = $userPreferences.analyticsEnd ?? defaultEnd;

    // Quick date range options
    const dateRanges = [
        { label: '24H', value: 1, unit: 'day' },
        { label: '7D', value: 7, unit: 'day' },
        { label: '30D', value: 30, unit: 'day' },
        { label: '90D', value: 90, unit: 'day' }
    ];

    function setDateRange(days: number) {
        const now = new Date();
        $userPreferences.analyticsEnd = now;
        $userPreferences.analyticsStart = subDays(now, days);
    }

    // Add a loading state for sales data
    let isLoadingSales = false;

    // Load data whenever collection or time range changes
    $: {
        if (startTime && endTime) {
            chartData = [];
            resetMetrics();
            if (collection?.contractId) {
                getData(collection.contractId, startTime, endTime);
            } else if (collection === null) {
                getData(undefined, startTime, endTime);
            }
        }
    }

    function resetMetrics() {
        voiVolume = null;
        totalSales = null;
        avgPrice = null;
        volumeChange = null;
        salesChange = null;
        mintCount = 0;
        mintVolume = 0;
        mintChange = null;
        mintVolumeChange = null;
    }

    async function getData(contractId: number | undefined, startTime: Date, endTime: Date) {
        if (!startTime || !endTime) return;
        
        isLoadingSales = true;
        isLoadingMints = contractId !== undefined;
        try {
            // Fetch collections first if in global view
            if (!contractId) {
                collections = await getCollections({ fetch });
            }

            // Fetch current period data
            let salesURL = `${indexerBaseURL}/mp/sales?min-time=${Math.floor(startTime.getTime() / 1000)}`;
            if (contractId) {
                salesURL += `&collectionId=${contractId}`;
            }
            const salesResp = await fetch(salesURL);
            const salesData = await salesResp.json();
            const s: Sale[] = salesData.sales;
            sales = s.reverse();

            // Calculate the start time for previous period
            const prevStartTime = new Date(startTime.getTime() - (endTime.getTime() - startTime.getTime()));
            
            // Fetch mints for both periods in one call
            const mintsData = await getTransfers({ 
                fetch,
                from: ZERO_ADDRESS,
                minTime: Math.floor(prevStartTime.getTime() / 1000),
                maxTime: Math.floor(endTime.getTime() / 1000)
            });

            // Split mints into current and previous periods
            const currentPeriodMints = mintsData.filter(transfer => {
                const transferTime = transfer.timestamp;
                const isInPeriod = transferTime >= startTime.getTime() / 1000 && 
                       transferTime <= endTime.getTime() / 1000;
                if (contractId) {
                    const isCorrectCollection = Number(transfer.contractId) === contractId;
                    return isInPeriod && isCorrectCollection;  // Include all mints in count
                }
                return isInPeriod;
            });

            mints = currentPeriodMints;  // Set mints for chart processing

            // Calculate mint volumes - exclude creator mints from volume calculations
            if (contractId) {
                // For specific collection
                if (collection?.globalState) {
                    const getValue = (key: string): number => {
                        const value = collection.globalState?.find(gs => gs.key === key)?.value;
                        return value ? Number(value) : 0;
                    };

                    const pricing = {
                        wlPrice: getValue('wlPrice'),
                        publicPrice: getValue('price'),
                        launchStart: getValue('launchStart'),
                        wlLaunchStart: getValue('wlLaunchStart')
                    };

                    const calculateMintVolume = (mintsToCalculate: Transfer[]) => {
                        return mintsToCalculate.reduce((acc, mint) => {
                            // Skip volume calculation for creator mints
                            if (mint.to === collection?.creator) return acc;
                            
                            let price = pricing.publicPrice;
                            if (mint.timestamp < pricing.launchStart && mint.timestamp >= pricing.wlLaunchStart) {
                                price = pricing.wlPrice;
                            }
                            return acc + price;
                        }, 0);
                    };

                    mintVolume = calculateMintVolume(currentPeriodMints);
                    prevMintVolume = calculateMintVolume(mintsData.filter(transfer => {
                        const transferTime = transfer.timestamp;
                        const isInPeriod = transferTime >= prevStartTime.getTime() / 1000 && 
                               transferTime < startTime.getTime() / 1000;
                        if (contractId) {
                            const isCorrectCollection = Number(transfer.contractId) === contractId;
                            return isInPeriod && isCorrectCollection;  // Include all mints in count
                        }
                        return isInPeriod;
                    }));
                }
            } else {
                // For all collections
                const collections = await getCollections({ fetch });
                
                const calculateMintVolume = (mintsToCalculate: Transfer[]) => {
                    return mintsToCalculate.reduce((acc, mint) => {
                        const collection = collections.find(c => c.contractId.toString() === mint.contractId.toString());
                        if (!collection?.globalState) return acc;

                        // Skip volume calculation for creator mints
                        if (mint.to === collection.creator) return acc;

                        const getValue = (key: string): number => {
                            const value = collection.globalState?.find(gs => gs.key === key)?.value;
                            return value ? Number(value) : 0;
                        };

                        const pricing = {
                            wlPrice: getValue('wlPrice'),
                            publicPrice: getValue('price'),
                            launchStart: getValue('launchStart'),
                            wlLaunchStart: getValue('wlLaunchStart')
                        };

                        let price = pricing.publicPrice;
                        if (mint.timestamp < pricing.launchStart && mint.timestamp >= pricing.wlLaunchStart) {
                            price = pricing.wlPrice;
                        }

                        return acc + price;
                    }, 0);
                };

                mintVolume = calculateMintVolume(currentPeriodMints);
                prevMintVolume = calculateMintVolume(mintsData.filter(transfer => {
                    const transferTime = transfer.timestamp;
                    const isInPeriod = transferTime >= prevStartTime.getTime() / 1000 && 
                           transferTime < startTime.getTime() / 1000;
                    if (contractId) {
                        const isCorrectCollection = Number(transfer.contractId) === contractId;
                        return isInPeriod && isCorrectCollection;  // Include all mints in count
                    }
                    return isInPeriod;
                }));
            }

            mintCount = currentPeriodMints.length;  // Include all mints in count

            // Calculate metrics
            voiVolume = s.reduce((acc, sale) => 
                sale.currency === 0 ? acc + sale.price : acc, 0);
            totalSales = s.length;
            avgPrice = totalSales > 0 ? (voiVolume) / totalSales / Math.pow(10,6) : 0;

            // Fetch previous period data for comparison
            let prevSalesURL = `${indexerBaseURL}/mp/sales?min-time=${Math.floor(prevStartTime.getTime() / 1000)}&max-time=${Math.floor(startTime.getTime() / 1000)}`;
            if (contractId) {
                prevSalesURL += `&collectionId=${contractId}`;
            }
            const prevSalesResp = await fetch(prevSalesURL);
            const prevSalesData = await prevSalesResp.json();
            const prevSales: Sale[] = prevSalesData.sales;

            // Calculate changes
            const prevVoiVolume = prevSales.reduce((acc, sale) => 
                sale.currency === 0 ? acc + sale.price : acc, 0);
            const prevTotalVolume = prevVoiVolume + prevMintVolume;
            const currentTotalVolume = voiVolume + mintVolume;
            
            volumeChange = prevTotalVolume > 0 
                ? ((currentTotalVolume - prevTotalVolume) / prevTotalVolume) * 100 
                : null;
            salesChange = prevSales.length > 0 
                ? ((totalSales - prevSales.length) / prevSales.length) * 100 
                : null;
            mintChange = prevMints.length > 0
                ? ((mintCount - prevMints.length) / prevMints.length) * 100
                : null;
            mintVolumeChange = prevMintVolume > 0
                ? ((mintVolume - prevMintVolume) / prevMintVolume) * 100
                : null;

            // Chart data processing
            let segment = Math.floor((endTime.getTime() - startTime.getTime()) / 30);
            let chartDataMap = new Map<string, { value: number, voi: number, salesCount: number, mintCount: number, mintVolume: number }>();
            
            // Initialize all time slots with zero values
            for (let i = 0; i < 30; i++) {
                const slotStart = new Date(startTime.getTime() + (i * segment));
                chartDataMap.set(slotStart.toISOString(), { 
                    value: 0, 
                    voi: 0, 
                    salesCount: 0, 
                    mintCount: 0, 
                    mintVolume: 0 
                });
            }

            // Process sales data
            s.forEach(sale => {
                const saleTime = sale.timestamp * 1000;
                if (saleTime >= startTime.getTime() && saleTime <= endTime.getTime()) {
                    const slotIndex = Math.floor((saleTime - startTime.getTime()) / segment);
                    if (slotIndex >= 0 && slotIndex < 30) {
                        const slotDate = new Date(startTime.getTime() + (slotIndex * segment));
                        const existing = chartDataMap.get(slotDate.toISOString()) || { 
                            value: 0, 
                            voi: 0, 
                            salesCount: 0, 
                            mintCount: 0, 
                            mintVolume: 0 
                        };
                        chartDataMap.set(slotDate.toISOString(), {
                            ...existing,
                            value: existing.value + sale.price,
                            voi: existing.voi + (sale.currency === 0 ? sale.price : 0),
                            salesCount: existing.salesCount + 1
                        });
                    }
                }
            });

            // Process mint data
            currentPeriodMints.forEach(mint => {
                const mintTime = mint.timestamp * 1000;
                if (mintTime >= startTime.getTime() && mintTime <= endTime.getTime()) {
                    const slotIndex = Math.floor((mintTime - startTime.getTime()) / segment);
                    if (slotIndex >= 0 && slotIndex < 30) {
                        const slotDate = new Date(startTime.getTime() + (slotIndex * segment));
                        let price = 0;
                        let isCreatorMint = false;

                        if (collection?.globalState) {
                            isCreatorMint = mint.to === collection.creator;
                            const getValue = (key: string): number => {
                                const value = collection.globalState?.find(gs => gs.key === key)?.value;
                                return value ? Number(value) : 0;
                            };
                            const pricing = {
                                wlPrice: getValue('wlPrice'),
                                publicPrice: getValue('price'),
                                launchStart: getValue('launchStart'),
                                wlLaunchStart: getValue('wlLaunchStart')
                            };
                            price = pricing.publicPrice;
                            if (mint.timestamp < pricing.launchStart && mint.timestamp >= pricing.wlLaunchStart) {
                                price = pricing.wlPrice;
                            }
                        } else if (collections.length > 0) {
                            const mintCollection = collections.find((c: Collection) => c.contractId.toString() === mint.contractId.toString());
                            if (mintCollection?.globalState) {
                                isCreatorMint = mint.to === mintCollection.creator;
                                const getValue = (key: string): number => {
                                    const value = mintCollection.globalState?.find((gs: { key: string, value: string }) => gs.key === key)?.value;
                                    return value ? Number(value) : 0;
                                };
                                const pricing = {
                                    wlPrice: getValue('wlPrice'),
                                    publicPrice: getValue('price'),
                                    launchStart: getValue('launchStart'),
                                    wlLaunchStart: getValue('wlLaunchStart')
                                };
                                price = pricing.publicPrice;
                                if (mint.timestamp < pricing.launchStart && mint.timestamp >= pricing.wlLaunchStart) {
                                    price = pricing.wlPrice;
                                }
                            }
                        }

                        const existing = chartDataMap.get(slotDate.toISOString()) || { 
                            value: 0, 
                            voi: 0, 
                            salesCount: 0, 
                            mintCount: 0, 
                            mintVolume: 0 
                        };
                        chartDataMap.set(slotDate.toISOString(), {
                            ...existing,
                            mintCount: existing.mintCount + 1,
                            mintVolume: existing.mintVolume + (isCreatorMint ? 0 : price)  // Only add to volume if not a creator mint
                        });
                    }
                }
            });
            
            // Convert to array and sort by date
            chartData = Array.from(chartDataMap.entries())
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .map(([key, result]) => ({
                    date: key,
                    value: (result.value + result.mintVolume) / Math.pow(10,6),  // Total volume (sales + non-creator mints)
                    salesCount: result.salesCount,
                    voi: result.voi / Math.pow(10,6),  // Sales volume only
                    mintCount: result.mintCount,  // All mints including creator mints
                    mintVolume: result.mintVolume / Math.pow(10,6)  // Mint volume excluding creator mints
                }));

            // Calculate total volumes for metrics
            voiVolume = s.reduce((acc, sale) => acc + (sale.currency === 0 ? sale.price : 0), 0);
            totalSales = s.length;
            avgPrice = totalSales > 0 ? voiVolume / totalSales / Math.pow(10,6) : 0;
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            isLoadingSales = false;
            isLoadingMints = false;
        }
    }

    function resetSelectedCollection() {
        searchText = '';
        selectedCollectionId = 0;
        goto(`/analytics`);
    }

    function gotoCollectionPage(contractId: number) {
        goto(`/collection/${contractId}`);
    }

    function gotoAnalyticsPage(contractId: number) {
        goto(`/analytics/collections/${contractId}`);
    }

    function getChangeColor(value: number | null) {
        if (value === null) return 'text-gray-500';
        return value >= 0 ? 'text-green-500' : 'text-red-500';
    }

    // Add these state variables for tab control
    let chartType: 'bar' | 'line' = 'bar';
    let chartView: 'volume' | 'sales' | 'mints' = 'volume';
    let showMA = false;
    let activeTab: 'overview' | 'transactions' | 'holders' | 'minting' = 'overview';
</script>

<div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="container mx-auto px-4 pt-6 space-y-6">
        <!-- Header Section -->
        <div class="flex flex-col gap-3">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-4">
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                    <div class="w-full sm:w-64">
                        <Select 
                            options={collectionOptions}
                            onchange={(v) => goto(`/analytics/collections/${v}`)} 
                            searchable={true}
                            bind:value={selectedCollectionId} 
                            bind:searchText={searchText}
                        />
                    </div>
                    {#if collection}
                        <div class="flex gap-2 w-full sm:w-auto">
                            <button 
                                class="flex-1 sm:flex-none px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                on:click={() => resetSelectedCollection()}
                            >
                                <i class="fas fa-undo mr-2"></i>
                                Reset
                            </button>
                            <button 
                                class="flex-1 sm:flex-none px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                on:click={() => goto(`/collection/${collection?.contractId}`)}
                            >
                                <i class="fas fa-external-link-alt mr-2"></i>
                                View Collection
                            </button>
                        </div>
                    {/if}
                </div>

                <div class="flex items-center w-full sm:w-auto overflow-x-auto">
                    <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-full sm:w-auto">
                        {#each dateRanges as range}
                            <button 
                                class="flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                                       {startTime && endTime && (endTime.getTime() - startTime.getTime()) === range.value * 24 * 60 * 60 * 1000 
                                         ? 'bg-blue-600 text-white' 
                                         : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                on:click={() => setDateRange(range.value)}
                            >
                                {range.label}
                            </button>
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Collection Info & Stats Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {#if collection}
                    <div class="lg:col-span-3">
                        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 space-y-6 shadow-sm dark:shadow-none">
                            <CollectionSingle collection={collection} viewType='grid' />
                            
                            <!-- External Links -->
                            <div class="flex flex-wrap gap-2">
                                <div class="w-full grid grid-cols-2 gap-2">
                                    <NautilusButton 
                                        contractid={collection.contractId.toString()} 
                                        buttonClass="w-full px-3 sm:px-4 py-2 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 shadow-md dark:shadow-none"
                                    />
                                    <HighforgeButton 
                                        contractid={collection.contractId.toString()} 
                                        buttonClass="w-full px-3 sm:px-4 py-2 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 shadow-md dark:shadow-none"
                                    />
                                </div>
                                <div class="w-full grid grid-cols-2 gap-2">
                                    <LoungeButton 
                                        contractid={collection.contractId.toString()} 
                                        buttonClass="w-full px-3 sm:px-4 py-2 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 shadow-md dark:shadow-none"
                                    />
                                    <Share 
                                        url={`https://voi.nft/collection/${collection.contractId}`} 
                                        text="Share"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
                
                <div class="lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <!-- Market Activity -->
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 col-span-1 sm:col-span-2 shadow-sm dark:shadow-none">
                        <h3 class="text-gray-600 dark:text-gray-400 text-sm font-medium mb-4">Market Activity</h3>
                        {#if isLoadingSales || isLoadingMints}
                            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                {#each Array(4) as _}
                                    <div class="space-y-2">
                                        <div class="h-4 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
                                        <div class="h-8 w-32 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
                                        <div class="h-4 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <div class="text-center sm:text-left">
                                    <div class="text-gray-600 dark:text-gray-400 text-sm">Total Volume</div>
                                    <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                        {voiVolume !== null && mintVolume !== null ? ((voiVolume + mintVolume) / Math.pow(10,6)).toLocaleString() : '-'} VOI
                                    </div>
                                    {#if volumeChange !== null && mintVolumeChange !== null}
                                        <div class="mt-1 flex items-center justify-center sm:justify-start {getChangeColor((volumeChange + mintVolumeChange) / 2)}">
                                            <i class="fas fa-{(volumeChange + mintVolumeChange) / 2 >= 0 ? 'arrow-up' : 'arrow-down'} mr-1"></i>
                                            {Math.abs((volumeChange + mintVolumeChange) / 2).toFixed(2)}%
                                        </div>
                                    {/if}
                                </div>
                                <div class="text-center sm:text-left">
                                    <div class="text-gray-600 dark:text-gray-400 text-sm">Secondary Market Volume</div>
                                    <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                        {voiVolume !== null ? (voiVolume / Math.pow(10,6)).toLocaleString() : '-'} VOI
                                    </div>
                                    {#if volumeChange !== null}
                                        <div class="mt-1 flex items-center justify-center sm:justify-start {getChangeColor(volumeChange)}">
                                            <i class="fas fa-{volumeChange >= 0 ? 'arrow-up' : 'arrow-down'} mr-1"></i>
                                            {Math.abs(volumeChange).toFixed(2)}%
                                        </div>
                                    {/if}
                                </div>
                                {#if collection}
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Total Mints</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {mintCount.toLocaleString()}
                                        </div>
                                        {#if mintChange !== null}
                                            <div class="mt-1 flex items-center justify-center sm:justify-start {getChangeColor(mintChange)}">
                                                <i class="fas fa-{mintChange >= 0 ? 'arrow-up' : 'arrow-down'} mr-1"></i>
                                                {Math.abs(mintChange).toFixed(2)}%
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Mint Volume</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {(mintVolume / Math.pow(10,6)).toLocaleString()} VOI
                                        </div>
                                        {#if mintVolumeChange !== null}
                                            <div class="mt-1 flex items-center justify-center sm:justify-start {getChangeColor(mintVolumeChange)}">
                                                <i class="fas fa-{mintVolumeChange >= 0 ? 'arrow-up' : 'arrow-down'} mr-1"></i>
                                                {Math.abs(mintVolumeChange).toFixed(2)}%
                                            </div>
                                        {/if}
                                    </div>
                                {:else}
                                    <div class="text-center sm:text-left col-span-2">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Average Price</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {avgPrice !== null ? avgPrice.toLocaleString() : '-'} VOI
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>

                    <!-- Current Market -->
                    {#if collection}
                        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-none">
                            <h3 class="text-gray-600 dark:text-gray-400 text-sm font-medium mb-4">Current Market</h3>
                            {#if isLoading || isLoadingMarket}
                                <div class="space-y-4 animate-pulse">
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                </div>
                            {:else}
                                <div class="space-y-4">
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Floor Price</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {floorPrice !== Infinity ? floorPrice.toLocaleString() : '-'} VOI
                                        </div>
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Ceiling Price</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {ceilingPrice !== -Infinity ? ceilingPrice.toLocaleString() : '-'} VOI
                                        </div>
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Active Listings</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {activeListings.toLocaleString()}
                                        </div>
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Listing Rate</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {listingRate.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>

                        <!-- Collection Stats -->
                        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-none">
                            <h3 class="text-gray-600 dark:text-gray-400 text-sm font-medium mb-4">Collection Stats</h3>
                            {#if isLoading}
                                <div class="space-y-4 animate-pulse">
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                </div>
                            {:else}
                                <div class="space-y-4">
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Total Supply</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {totalTokens.toLocaleString()}
                                        </div>
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Unique Holders</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {uniqueHolders.toLocaleString()}
                                        </div>
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Burned Tokens</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {burnedTokens.toLocaleString()}
                                        </div>
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Holder Concentration</div>
                                        <div class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                            {holderConcentration.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Tabs Section -->
        <div class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm dark:shadow-none">
            <Tabs style="underline">
                <TabItem open title="Overview">
                    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                        <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-full sm:w-auto">
                                <button 
                                    class="flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartType = 'bar'}
                                >
                                    Bar
                                </button>
                                <button 
                                    class="flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartType === 'line' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartType = 'line'}
                                >
                                    Line
                                </button>
                            </div>
                            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-full sm:w-auto">
                                <button 
                                    class="flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartView === 'volume' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartView = 'volume'}
                                >
                                    Volume
                                </button>
                                <button 
                                    class="flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartView === 'sales' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartView = 'sales'}
                                >
                                    Sales
                                </button>
                                <button 
                                    class="flex-1 sm:flex-none px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartView === 'mints' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartView = 'mints'}
                                >
                                    Mints
                                </button>
                            </div>
                            <button 
                                class="w-full sm:w-auto px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700
                                       {showMA ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                on:click={() => showMA = !showMA}
                            >
                                7-day MA
                            </button>
                        </div>
                    </div>

                    <div class="h-[300px] sm:h-[400px]">
                        <SalesChart 
                            data={chartData}
                            view={chartView}
                            {chartType}
                            {showMA}
                        />
                    </div>
                </TabItem>

                {#if collection}
                    <TabItem title="Transactions">
                        <div class="mt-4 -mx-4 sm:mx-0">
                            <SalesTable collectionId={collection?.contractId} />
                        </div>
                    </TabItem>

                    <TabItem title="Minting">
                        <div class="mt-4">
                            <div class="overflow-x-auto">
                                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead>
                                        <tr>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token ID</th>
                                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Minter</th>
                                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                                        {#if isLoadingMints}
                                            {#each Array(5) as _}
                                                <tr>
                                                    <td colspan="4" class="px-6 py-4">
                                                        <div class="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
                                                    </td>
                                                </tr>
                                            {/each}
                                        {:else if mints.length === 0}
                                            <tr>
                                                <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                                                    No minting activity in selected period
                                                </td>
                                            </tr>
                                        {:else}
                                            {#each mints as mint}
                                                {@const price = collection?.globalState ? (() => {
                                                    const getValue = (key: string): number => {
                                                        const value = collection.globalState?.find(gs => gs.key === key)?.value;
                                                        return value ? Number(value) : 0;
                                                    };
                                                    const pricing = {
                                                        wlPrice: getValue('wlPrice'),
                                                        publicPrice: getValue('price'),
                                                        launchStart: getValue('launchStart'),
                                                        wlLaunchStart: getValue('wlLaunchStart')
                                                    };
                                                    return mint.timestamp < pricing.launchStart && mint.timestamp >= pricing.wlLaunchStart
                                                        ? pricing.wlPrice
                                                        : pricing.publicPrice;
                                                })() : 0}
                                                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {new Date(mint.timestamp * 1000).toLocaleString()}
                                                    </td>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                                        <a 
                                                            href="/collection/{mint.contractId}/token/{mint.tokenId}" 
                                                            class="text-blue-500 hover:text-blue-700"
                                                        >
                                                            #{mint.tokenId}
                                                        </a>
                                                    </td>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                                        <a 
                                                            href="/portfolio/{mint.to}"
                                                            class="text-blue-500 hover:text-blue-700"
                                                        >
                                                            {mint.to.slice(0, 8)}...{mint.to.slice(-4)}
                                                        </a>
                                                    </td>
                                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                        {(price / Math.pow(10,6)).toLocaleString()} VOI
                                                    </td>
                                                </tr>
                                            {/each}
                                        {/if}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabItem>

                    <TabItem title="Holders">
                        <div class="mt-4 -mx-4 sm:mx-0">
                            {#if isLoading}
                                <div class="animate-pulse space-y-4">
                                    <div class="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                </div>
                            {:else}
                                <HoldersList {tokens} />
                            {/if}
                        </div>
                    </TabItem>
                {/if}
            </Tabs>
        </div>
    </div>
</div>

<style>
    :global(.dark) {
        color-scheme: dark;
    }
</style>