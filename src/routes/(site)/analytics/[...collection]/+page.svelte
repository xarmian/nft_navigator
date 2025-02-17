<script lang="ts">
	import type { PageData } from './$types';
    import Select from '$lib/component/ui/Select.svelte';
	import type { Collection, Sale, Listing } from '$lib/data/types';
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
    import { getTokens } from '$lib/utils/indexer';

    export let data: PageData & {
        tokens?: Token[];
    };

    let collectionOptions = data.collectionOptions;
    $: collection = data.collection;
    let tokens: Token[] = data.tokens ?? [];
    let isLoading = false;
    
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
    };
    
    let chartData: ChartDataPoint[] = [];
    let marketData: { listings: Listing[] } = { listings: [] };

    // Collection Stats
    $: uniqueHolders = new Set(tokens.filter(t => !t.isBurned).map(t => t.owner)).size;
    $: totalTokens = tokens.length;
    $: burnedTokens = tokens.filter(t => t.isBurned).length;
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
    let sales: Sale[] = [];
    $: startTime = undefined as undefined | Date;
    $: endTime = undefined as undefined | Date;

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

    const unsub = userPreferences.subscribe((value: any) => {
        if (value.analyticsStart) startTime = value.analyticsStart;
        if (value.analyticsEnd) endTime = value.analyticsEnd;
    });

    onDestroy(unsub);
    
    onMount(async () => {
        startTime = $userPreferences.analyticsStart ?? subDays(new Date(), 1);
        endTime = $userPreferences.analyticsEnd ?? new Date();

        // Fetch market data if we have a collection
        if (collection?.contractId) {
            const marketUrl = `${indexerBaseURL}/mp/listings/?collectionId=${collection.contractId}&active=true`;
            try {
                const response = await fetch(marketUrl);
                marketData = await response.json();
                
                // Update token market data
                tokens = tokens.map(token => {
                    const marketToken = marketData.listings.find(
                        (l: Listing) => l.tokenId === token.tokenId && !l.sale && !l.delete
                    );
                    if (marketToken && token.owner === marketToken.seller) {
                        return { ...token, marketData: marketToken };
                    }
                    return token;
                });
            } catch (error) {
                console.error('Error fetching market data:', error);
            }
        }
    });

    $: {
        if (collection?.contractId !== null && startTime != null && endTime != null) {
            chartData = [];
            resetMetrics();
            getData(collection?.contractId, startTime, endTime);
        }
    }

    function resetMetrics() {
        voiVolume = null;
        totalSales = null;
        avgPrice = null;
        volumeChange = null;
        salesChange = null;
    }

    async function getData(contractId: number | undefined, startTime: Date, endTime: Date) {
        if (!startTime || !endTime) return;
        
        // Fetch current period data
        let salesURL = `${indexerBaseURL}/mp/sales?min-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            salesURL += `&collectionId=${contractId}`;
        }
        const salesResp = await fetch(salesURL);
        const salesData = await salesResp.json();
        const s: Sale[] = salesData.sales;
        sales = s.reverse();

        // Calculate metrics
        voiVolume = s.reduce((acc, sale) => 
            sale.currency === 0 ? acc + sale.price : acc, 0);
        totalSales = s.length;
        avgPrice = totalSales > 0 ? (voiVolume) / totalSales / Math.pow(10,6) : 0;

        // Fetch previous period data for comparison
        const prevStartTime = new Date(startTime.getTime() - (endTime.getTime() - startTime.getTime()));
        const prevSalesURL = `${indexerBaseURL}/mp/sales?min-time=${Math.floor(prevStartTime.getTime() / 1000)}&max-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            salesURL += `&collectionId=${contractId}`;
        }
        const prevSalesResp = await fetch(prevSalesURL);
        const prevSalesData = await prevSalesResp.json();
        const prevSales: Sale[] = prevSalesData.sales;

        // Calculate changes
        const prevVoiVolume = prevSales.reduce((acc, sale) => 
            sale.currency === 0 ? acc + sale.price : acc, 0);
        const prevTotalVolume = prevVoiVolume;
        const currentTotalVolume = voiVolume;
        
        volumeChange = prevTotalVolume > 0 
            ? ((currentTotalVolume - prevTotalVolume) / prevTotalVolume) * 100 
            : null;
        salesChange = prevSales.length > 0 
            ? ((totalSales - prevSales.length) / prevSales.length) * 100 
            : null;

        // Fetch listings
        let listURL = `${indexerBaseURL}/mp/listings?min-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            listURL += `&collectionId=${contractId}`;
        }
        const listResp = await fetch(listURL);
        const listData = await listResp.json();
        const listings: any[] = listData.listings;

        // Chart data processing
        let segment = (endTime.getTime() - startTime.getTime()) / 30;
        let date: Date = new Date(startTime.getTime());
        let chartDataMap = new Map<string, { value: number, voi: number, salesCount: number }>();
        
        for (let i = 0; i < 30; i++) {
            let nextDate = new Date(date.getTime() + segment);
            let result = s.reduce((acc, sale) => {
                if (sale.timestamp * 1000 >= date.getTime() && sale.timestamp * 1000 < nextDate.getTime()) {
                    return { 
                        value: acc.value + sale.price, 
                        voi: acc.voi + (sale.currency == 0 ? sale.price : 0),
                        salesCount: acc.salesCount + 1 
                    };
                }
                return acc;
            }, { value: 0, salesCount: 0, voi: 0 });
            chartDataMap.set(date.toISOString(), result);
            date = nextDate;
        }
        
        chartData = Array.from(chartDataMap).map(([key, result]) => ({
            date: key,
            value: result.value / Math.pow(10,6),
            salesCount: result.salesCount,
            voi: result.voi / Math.pow(10,6),
        }));
    }

    function resetSelectedCollection() {
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
    let chartView: 'volume' | 'sales' = 'volume';
    let showMA = false;
    let activeTab: 'overview' | 'transactions' | 'holders' = 'overview';
</script>

<div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="container mx-auto px-4 pt-6 space-y-6">
        <!-- Header Section -->
        <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-4">
                    <div class="w-64">
                        <Select 
                            value={collection?.contractId??0} 
                            options={collectionOptions}
                            onchange={(v) => goto(`/analytics/collections/${v}`)} 
                        />
                    </div>
                    {#if collection}
                        <div class="flex gap-2">
                            <button 
                                class="px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                on:click={() => goto(`/analytics`)}
                            >
                                <i class="fas fa-undo mr-2"></i>
                                Reset
                            </button>
                            <button 
                                class="px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                on:click={() => goto(`/collection/${collection?.contractId}`)}
                            >
                                <i class="fas fa-external-link-alt mr-2"></i>
                                View Collection
                            </button>
                        </div>
                    {/if}
                </div>

                <div class="flex items-center gap-4">
                    <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {#each dateRanges as range}
                            <button 
                                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors
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
            <div class="grid grid-cols-12 gap-6">
                {#if collection}
                    <div class="col-span-3">
                        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 space-y-6 shadow-sm dark:shadow-none">
                            <CollectionSingle collection={collection} viewType='grid' />
                            
                            <!-- External Links -->
                            <div class="flex flex-wrap gap-2">
                                <div class="w-full flex flex-wrap gap-2">
                                    <NautilusButton 
                                        contractid={collection.contractId.toString()} 
                                        buttonClass="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 shadow-md dark:shadow-none"
                                    />
                                    <HighforgeButton 
                                        contractid={collection.contractId.toString()} 
                                        buttonClass="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 shadow-md dark:shadow-none"
                                    />
                                </div>
                                <div class="w-full flex flex-wrap gap-2">
                                    <LoungeButton 
                                        contractid={collection.contractId.toString()} 
                                        buttonClass="flex-1 px-4 py-2 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-gray-100 shadow-md dark:shadow-none"
                                    />
                                    <Share 
                                        url={`https://voi.nft/collection/${collection.contractId}`} 
                                        text="Share Collection"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
                
                <div class="col-span-9 grid grid-cols-2 gap-6">
                    <!-- Market Activity -->
                    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 col-span-2 shadow-sm dark:shadow-none">
                        <h3 class="text-gray-600 dark:text-gray-400 text-sm font-medium mb-4">Secondary Market Activity</h3>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <div class="text-gray-600 dark:text-gray-400 text-sm">Total Volume</div>
                                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                    {voiVolume !== null ? (voiVolume / Math.pow(10,6)).toLocaleString() : '-'} VOI
                                </div>
                                {#if volumeChange !== null}
                                    <div class="mt-1 flex items-center {getChangeColor(volumeChange)}">
                                        <i class="fas fa-{volumeChange >= 0 ? 'arrow-up' : 'arrow-down'} mr-1"></i>
                                        {Math.abs(volumeChange).toFixed(2)}%
                                    </div>
                                {/if}
                            </div>
                            <div>
                                <div class="text-gray-600 dark:text-gray-400 text-sm">Total Sales</div>
                                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                    {totalSales !== null ? totalSales.toLocaleString() : '-'}
                                </div>
                                {#if salesChange !== null}
                                    <div class="mt-1 flex items-center {getChangeColor(salesChange)}">
                                        <i class="fas fa-{salesChange >= 0 ? 'arrow-up' : 'arrow-down'} mr-1"></i>
                                        {Math.abs(salesChange).toFixed(2)}%
                                    </div>
                                {/if}
                            </div>
                            <div>
                                <div class="text-gray-600 dark:text-gray-400 text-sm">Average Price</div>
                                <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                    {avgPrice !== null ? avgPrice.toLocaleString() : '-'} VOI
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Current Market -->
                    {#if collection}
                        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none">
                            <h3 class="text-gray-600 dark:text-gray-400 text-sm font-medium mb-4">Current Market</h3>
                            {#if isLoading}
                                <div class="space-y-4 animate-pulse">
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                    <div class="h-16 bg-gray-100 dark:bg-gray-700 rounded"></div>
                                </div>
                            {:else}
                                <div class="space-y-4">
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Floor Price</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {floorPrice !== Infinity ? floorPrice.toLocaleString() : '-'} VOI
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Ceiling Price</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {ceilingPrice !== -Infinity ? ceilingPrice.toLocaleString() : '-'} VOI
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Active Listings</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {activeListings.toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Listing Rate</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {listingRate.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>

                        <!-- Collection Stats -->
                        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none">
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
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Total Supply</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {totalTokens.toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Unique Holders</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {uniqueHolders.toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Burned Tokens</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                            {burnedTokens.toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div class="text-gray-600 dark:text-gray-400 text-sm">Holder Concentration</div>
                                        <div class="text-2xl font-bold text-gray-900 dark:text-white">
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
        <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none">
            <Tabs style="underline">
                <TabItem open title="Overview">
                    <div class="flex items-center justify-between mb-6">
                        <div class="flex items-center gap-2">
                            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                <button 
                                    class="px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartType === 'bar' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartType = 'bar'}
                                >
                                    Bar
                                </button>
                                <button 
                                    class="px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartType === 'line' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartType = 'line'}
                                >
                                    Line
                                </button>
                            </div>
                            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                <button 
                                    class="px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartView === 'volume' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartView = 'volume'}
                                >
                                    Volume
                                </button>
                                <button 
                                    class="px-3 py-1 rounded-lg text-sm font-medium transition-colors
                                           {chartView === 'sales' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                    on:click={() => chartView = 'sales'}
                                >
                                    Sales
                                </button>
                            </div>
                            <button 
                                class="px-3 py-1 rounded-lg text-sm font-medium transition-colors bg-gray-100 dark:bg-gray-700
                                       {showMA ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}"
                                on:click={() => showMA = !showMA}
                            >
                                7-day MA
                            </button>
                        </div>
                    </div>

                    <div class="h-[400px]">
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
                        <div class="mt-4">
                            <SalesTable collectionId={collection?.contractId} />
                        </div>
                    </TabItem>

                    <TabItem title="Holders">
                        <div class="mt-4">
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