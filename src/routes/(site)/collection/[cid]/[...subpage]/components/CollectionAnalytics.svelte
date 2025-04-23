<script lang="ts">
  import { onMount } from 'svelte';
  import SalesChart from '$lib/component/ui/SalesChart.svelte';
  import SalesTable from '$lib/component/ui/SalesTable.svelte';
  import { getSales, getTransfers, getTokensWithPagination, getCollectors } from '$lib/utils/mimir';
  import { subDays, subWeeks, subMonths, format, parseISO } from 'date-fns';
  import type { Collection, Sale, Transfer, Token } from '$lib/data/types';
  import { getNFD } from '$lib/utils/nfd';

  export let collection: Collection;
  export let fetch: typeof window.fetch;

  // Chart and stats state
  let chartData: any[] = [];
  let sales: Sale[] = [];
  let mints: Transfer[] = [];
  let isLoading = true;
  let isLoadingSales = true;
  let isLoadingMints = true;
  let isLoadingDistribution = true;
  let mintCount = 0;
  let mintVolume = 0;
  let voiVolume = 0;
  let totalSales = 0;
  let avgPrice = 0;
  let volumeChange: number | null = null;
  let salesChange: number | null = null;
  let mintChange: number | null = null;
  let mintVolumeChange: number | null = null;
  let startTime = subDays(new Date(), 7);
  let endTime = new Date();
  let chartType: 'bar' | 'line' = 'bar';
  let chartView: 'volume' | 'sales' | 'mints' = 'volume';
  let showMA = false;
  let topHolders: { address: string; count: number; percentage: number; nfd?: string; avatar?: string }[] = [];
  let pieChartPaths: {path: string, color: string, data: { name: string; count: number; percentage: number; }}[] = [];
  let ownerDistributionData: { name: string; count: number; percentage: number; color: string }[] = [];
  let hoveredSlice: number | null = null;

  // Constants
  const VOI_DECIMALS = 6;
  const VOI_FACTOR = Math.pow(10, VOI_DECIMALS);
  const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";
  const timeRanges = [
    { label: "7D", value: 7, fn: subDays },
    { label: "14D", value: 14, fn: subDays },
    { label: "30D", value: 30, fn: subDays },
    { label: "90D", value: 90, fn: subDays },
    { label: "1Y", value: 12, fn: subMonths }
  ];
  let selectedRange = timeRanges[0];

  // Colors for the pie chart
  const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6', '#8B5CF6', '#F43F5E'];

  // Utility for color
  function getChangeColor(value: number | null) {
    if (value === null) return 'text-gray-500';
    return value >= 0 ? 'text-green-500' : 'text-red-500';
  }

  // Change time range
  function changeTimeRange(range: typeof timeRanges[0]) {
    selectedRange = range;
    startTime = range.fn(new Date(), range.value);
    endTime = new Date();
    getData(collection.contractId, startTime, endTime);
  }

  // Fetch token distribution data
  async function getTokenDistribution() {
    isLoadingDistribution = true;
    try {
      // Use new RPC for top holders
      const collectors = await getCollectors({ contractId: collection.contractId, limit: 20, fetch });
      // Calculate total tokens
      const totalHeldByTop = collectors.reduce((sum, c) => sum + c.tokenCount, 0);
      const totalTokens = collection.totalSupply;
      const otherTokenCount = totalTokens - totalHeldByTop;

      // Resolve NFDs for top holders (for both table and pie chart)
      const nfdData = await getNFD(collectors.slice(0, 10).map(c => c.owner));
      
      // Prepare data for the top holders display
      topHolders = collectors.slice(0, 10).map((c) => {
        const nfdInfo = nfdData.find(n => n.key === c.owner);
        return {
          address: c.owner,
          count: c.tokenCount,
          percentage: (c.tokenCount / totalTokens) * 100,
          nfd: nfdInfo?.replacementValue,
          avatar: nfdInfo?.avatar || undefined
        };
      });

      // Prepare data for pie chart, using NFD names or shortened addresses
      ownerDistributionData = collectors.slice(0, 10).map((collector, i) => {
        const nfdInfo = nfdData.find(n => n.key === collector.owner);
        const displayName = nfdInfo?.replacementValue || 
                           `${collector.owner.substring(0, 4)}...${collector.owner.substring(collector.owner.length - 4)}`;
        
        return {
          name: displayName,
          count: collector.tokenCount,
          percentage: (collector.tokenCount / totalTokens) * 100,
          color: colors[i % colors.length]
        };
      });

      // Add "Other" category if there are more tokens
      if (otherTokenCount > 0) {
        ownerDistributionData.push({
          name: 'Other Holders',
          count: otherTokenCount,
          percentage: (otherTokenCount / totalTokens) * 100,
          color: colors[10 % colors.length]
        });
      }
      
      // Generate pie chart
      generatePieChart();
    } catch (error) {
      console.error('Error fetching token distribution:', error);
    } finally {
      isLoadingDistribution = false;
    }
  }

  // Generate SVG pie chart
  function generatePieChart() {
    const radius = 80;
    const center = 90;
    
    // SVG coordinates for the pie chart
    let cumulativePercent = 0;
    pieChartPaths = [];
    
    ownerDistributionData.forEach((item, index) => {
      const startPercent = cumulativePercent;
      const valuePercent = item.percentage;
      const endPercent = startPercent + valuePercent;
      
      // Calculate coordinates
      const startAngle = startPercent / 100 * Math.PI * 2 - Math.PI / 2;
      const endAngle = endPercent / 100 * Math.PI * 2 - Math.PI / 2;
      
      const startX = center + radius * Math.cos(startAngle);
      const startY = center + radius * Math.sin(startAngle);
      const endX = center + radius * Math.cos(endAngle);
      const endY = center + radius * Math.sin(endAngle);
      
      // Determine if the arc is more than 180 degrees
      const largeArcFlag = valuePercent > 50 ? 1 : 0;
      
      // Create SVG path
      const path = `M${center},${center} L${startX},${startY} A${radius},${radius} 0 ${largeArcFlag},1 ${endX},${endY} Z`;
      
      pieChartPaths.push({
        path,
        color: item.color,
        data: item
      });
      
      cumulativePercent = endPercent;
    });
  }

  // Handle tooltip display
  function showTooltip(index: number, event: MouseEvent) {
    hoveredSlice = index;
    
    const tooltip = document.getElementById('pie-tooltip');
    if (!tooltip) return;
    
    const item = ownerDistributionData[index];
    
    tooltip.innerHTML = `
      <div class="p-3">
        <div class="font-medium text-sm">${item.name}</div>
        <div class="mt-1 text-xs text-gray-500 dark:text-gray-400">${item.count.toLocaleString()} tokens</div>
        <div class="font-medium text-xs">${item.percentage.toFixed(1)}% of supply</div>
      </div>
    `;
    
    tooltip.style.display = 'block';
    positionTooltip(event, tooltip);
  }
  
  function hideTooltip() {
    hoveredSlice = null;
    
    const tooltip = document.getElementById('pie-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }
  
  function positionTooltip(event: MouseEvent, tooltip: HTMLElement) {
    let left = event.clientX + 10;
    let top = event.clientY + 10;
    
    // Adjust if tooltip would go off the screen
    if (left + tooltip.offsetWidth > window.innerWidth) {
      left = event.clientX - tooltip.offsetWidth - 10;
    }
    
    if (top + tooltip.offsetHeight > window.innerHeight) {
      top = event.clientY - tooltip.offsetHeight - 10;
    }
    
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  // Data fetching logic
  async function getData(contractId: number | undefined, startTime: Date, endTime: Date) {
    if (!contractId || !startTime || !endTime) return;
    
    isLoading = true;
    isLoadingSales = true;
    isLoadingMints = true;
    
    try {
      // Get sales data for current period
      const salesData = await getSales({ 
        collectionId: contractId, 
        minTime: Math.floor(startTime.getTime() / 1000),
        maxTime: Math.floor(endTime.getTime() / 1000),
        limit: 500,
        includes: 'listing',
        fetch
      });
      
      // Get sales for previous period (for comparison)
      const prevDuration = endTime.getTime() - startTime.getTime();
      const prevStartTime = new Date(startTime.getTime() - prevDuration);
      const prevEndTime = new Date(endTime.getTime() - prevDuration);
      
      const prevSalesData = await getSales({
        collectionId: contractId,
        minTime: Math.floor(prevStartTime.getTime() / 1000),
        maxTime: Math.floor(prevEndTime.getTime() / 1000),
        limit: 500,
        includes: 'listing',
        fetch
      });
      
      // Get mint data (transfers from zero address)
      const mintsData = await getTransfers({
        contractId: contractId.toString(),
        from: ZERO_ADDRESS,
        minTime: Math.floor(prevStartTime.getTime() / 1000),
        maxTime: Math.floor(endTime.getTime() / 1000),
        limit: 1000,
        fetch
      });
      
      // Process sales data
      sales = salesData;
      totalSales = sales.length;
      voiVolume = sales.reduce((sum, sale) => sum + (sale.price / VOI_FACTOR), 0);
      avgPrice = totalSales > 0 ? voiVolume / totalSales : 0;
      
      // Process previous period for comparison
      const prevSales = prevSalesData;
      const prevVoiVolume = prevSales.reduce((sum, sale) => sum + (sale.price / VOI_FACTOR), 0);
      
      // Calculate changes
      volumeChange = prevVoiVolume > 0 ? ((voiVolume - prevVoiVolume) / prevVoiVolume) * 100 : null;
      salesChange = prevSales.length > 0 ? ((totalSales - prevSales.length) / prevSales.length) * 100 : null;
      
      // Process mint data
      const currentPeriodMints = mintsData.filter(t => 
        t.timestamp >= Math.floor(startTime.getTime() / 1000) && 
        t.timestamp <= Math.floor(endTime.getTime() / 1000)
      );
      
      const prevPeriodMints = mintsData.filter(t => 
        t.timestamp >= Math.floor(prevStartTime.getTime() / 1000) && 
        t.timestamp < Math.floor(startTime.getTime() / 1000)
      );
      
      mints = currentPeriodMints;
      mintCount = mints.length;
      
      // Calculate mint changes
      mintChange = prevPeriodMints.length > 0 
        ? ((mintCount - prevPeriodMints.length) / prevPeriodMints.length) * 100 
        : null;
      
      // Prepare chart data by grouping by day
      const daysMap = new Map();
      const millisecondsPerDay = 24 * 60 * 60 * 1000;
      
      // Initialize days
      let currentDay = new Date(startTime);
      while (currentDay <= endTime) {
        const dayStr = format(currentDay, 'yyyy-MM-dd');
        daysMap.set(dayStr, {
          date: dayStr,
          salesCount: 0,
          mintCount: 0,
          value: 0,
          voi: 0,
          mintVolume: 0
        });
        currentDay = new Date(currentDay.getTime() + millisecondsPerDay);
      }
      
      // Add sales data
      sales.forEach(sale => {
        const date = format(new Date(sale.timestamp * 1000), 'yyyy-MM-dd');
        if (daysMap.has(date)) {
          const day = daysMap.get(date);
          day.salesCount++;
          day.value += sale.price / VOI_FACTOR;
          day.voi += sale.price / VOI_FACTOR;
        }
      });
      
      // Add mint data
      mints.forEach(mint => {
        const date = format(new Date(mint.timestamp * 1000), 'yyyy-MM-dd');
        if (daysMap.has(date)) {
          const day = daysMap.get(date);
          day.mintCount++;
          // Use an estimated mint price if available from collection
          const mintPrice = getEstimatedMintPrice();
          day.mintVolume += mintPrice;
        }
      });
      
      // Convert to array and sort by date
      chartData = Array.from(daysMap.values())
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      isLoadingSales = false;
      isLoadingMints = false;
      isLoading = isLoadingSales || isLoadingMints;
    }
  }

  // Try to get mint price from collection data
  function getEstimatedMintPrice(): number {
    if (!collection || !collection.globalState) return 1;
    
    const priceState = collection.globalState.find(gs => gs.key === 'price');
    if (priceState) {
      return Number(priceState.value) / VOI_FACTOR;
    }
    
    return 1; // Default to 1 VOI if no price found
  }

  // Format percentage change
  function formatChange(value: number | null): string {
    if (value === null) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  // Format currency
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  // Format short address
  function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // Reactive: fetch data when collection, startTime, or endTime changes
  $: if (collection && collection.contractId && startTime && endTime) {
    getData(collection.contractId, startTime, endTime);
  }

  // Fetch distribution data on mount
  onMount(() => {
    if (collection && collection.contractId) {
      getTokenDistribution();
    }
  });
</script>

<div class="p-4 md:p-8 space-y-6 w-full">
  <h2 class="text-2xl font-bold mb-4">Analytics for {collection?.highforgeData?.title ?? `Collection #${collection?.contractId}`}</h2>
  
  <!-- Time range selection -->
  <div class="flex flex-wrap justify-between items-center gap-4 mb-6">
    <div class="flex flex-wrap gap-2">
      {#each timeRanges as range}
        <button
          class="px-3 py-1.5 rounded-md font-medium text-sm transition-colors {selectedRange === range 
            ? 'bg-indigo-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}"
          on:click={() => changeTimeRange(range)}
        >
          {range.label}
        </button>
      {/each}
    </div>
    
    <div class="flex items-center gap-3">
      <div class="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <button 
          class="px-3 py-1.5 text-sm font-medium {chartType === 'bar' 
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white' 
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}"
          on:click={() => chartType = 'bar'}
        >
          <i class="fas fa-chart-bar mr-1"></i> Bar
        </button>
        <button 
          class="px-3 py-1.5 text-sm font-medium {chartType === 'line' 
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white' 
            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'}"
          on:click={() => chartType = 'line'}
        >
          <i class="fas fa-chart-line mr-1"></i> Line
        </button>
      </div>
      
      <label class="inline-flex items-center cursor-pointer">
        <input type="checkbox" bind:checked={showMA} class="sr-only peer">
        <div class="relative w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
        <span class="ms-2 text-sm font-medium text-gray-700 dark:text-gray-300">7D MA</span>
      </label>
    </div>
  </div>
  
  <!-- Stats Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
    <!-- Volume -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Volume ({selectedRange.label})</h3>
        <div class={`text-xs font-medium ${getChangeColor(volumeChange)}`}>
          {volumeChange !== null ? formatChange(volumeChange) : 'N/A'}
        </div>
      </div>
      <div class="flex items-baseline">
        <div class="text-2xl font-bold">{formatCurrency(voiVolume)}</div>
        <div class="ml-1 text-sm text-gray-500 dark:text-gray-400">VOI</div>
      </div>
    </div>
    
    <!-- Sales -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Sales ({selectedRange.label})</h3>
        <div class={`text-xs font-medium ${getChangeColor(salesChange)}`}>
          {salesChange !== null ? formatChange(salesChange) : 'N/A'}
        </div>
      </div>
      <div class="flex items-baseline">
        <div class="text-2xl font-bold">{totalSales}</div>
      </div>
    </div>
    
    <!-- Average Price -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Avg. Price</h3>
      </div>
      <div class="flex items-baseline">
        <div class="text-2xl font-bold">{formatCurrency(avgPrice)}</div>
        <div class="ml-1 text-sm text-gray-500 dark:text-gray-400">VOI</div>
      </div>
    </div>
    
    <!-- Mints -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-100 dark:border-gray-700">
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Mints ({selectedRange.label})</h3>
        <div class={`text-xs font-medium ${getChangeColor(mintChange)}`}>
          {mintChange !== null ? formatChange(mintChange) : 'N/A'}
        </div>
      </div>
      <div class="flex items-baseline">
        <div class="text-2xl font-bold">{mintCount === 1000 ? '1000+' : mintCount}</div>
      </div>
    </div>
  </div>
  
  <!-- Chart View Controls -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
    <div class="p-4 border-b border-gray-100 dark:border-gray-700">
      <div class="flex flex-wrap gap-2">
        <button
          class="px-3 py-1.5 rounded-md font-medium text-sm transition-colors {chartView === 'volume' 
            ? 'bg-indigo-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}"
          on:click={() => chartView = 'volume'}
        >
          Volume
        </button>
        <button
          class="px-3 py-1.5 rounded-md font-medium text-sm transition-colors {chartView === 'sales' 
            ? 'bg-indigo-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}"
          on:click={() => chartView = 'sales'}
        >
          Sales
        </button>
        <button
          class="px-3 py-1.5 rounded-md font-medium text-sm transition-colors {chartView === 'mints' 
            ? 'bg-indigo-600 text-white' 
            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'}"
          on:click={() => chartView = 'mints'}
        >
          Mints
        </button>
      </div>
    </div>
    
    <div class="p-4 h-[600px] flex items-center justify-center">
      {#if isLoading}
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-indigo-600"></div>
          <p class="mt-2 text-gray-600 dark:text-gray-300">Loading chart data...</p>
        </div>
      {:else if chartData.length === 0}
        <div class="text-center text-gray-500">
          <p>No data available for the selected period</p>
        </div>
      {:else}
        <SalesChart data={chartData} view={chartView} {chartType} {showMA} />
      {/if}
    </div>
  </div>
  
  <!-- Two column layout for Distribution and Top Holders -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Token Distribution by Owners -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
      <h3 class="p-4 font-medium border-b border-gray-100 dark:border-gray-700">Token Ownership Distribution</h3>
      <div class="p-4">
        {#if isLoadingDistribution}
          <div class="text-center py-6">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-indigo-600"></div>
            <p class="mt-2 text-gray-600 dark:text-gray-300">Loading distribution data...</p>
          </div>
        {:else if pieChartPaths.length === 0}
          <div class="text-center py-6 text-gray-500">
            <p>No distribution data available</p>
          </div>
        {:else}
          <div class="flex flex-col items-center">
            <!-- Pie Chart -->
            <div class="flex justify-center">
              <svg width="380" height="380" viewBox="0 0 180 180" class="pie-chart">
                {#each pieChartPaths as path, i}
                  <path 
                    d={path.path} 
                    fill={path.color} 
                    class="transition-opacity duration-200 cursor-pointer hover:opacity-80"
                    class:opacity-75={hoveredSlice !== null && hoveredSlice !== i}
                    class:opacity-100={hoveredSlice === i || hoveredSlice === null}
                    on:mouseenter={(e) => showTooltip(i, e)}
                    on:mousemove={(e) => {
                      if (hoveredSlice === i) {
                        const tooltip = document.getElementById('pie-tooltip');
                        if (tooltip) positionTooltip(e, tooltip);
                      }
                    }}
                    on:mouseleave={() => hideTooltip()}
                  />
                {/each}
                <circle cx="90" cy="90" r="40" fill="white" class="dark:fill-gray-800" />
                <text x="90" y="90" text-anchor="middle" dominant-baseline="middle" fill="currentColor" class="text-gray-800 dark:text-gray-200 text-xs">
                  Holders
                </text>
              </svg>
            </div>
            
            <div class="mt-4 text-center text-sm text-gray-500">
              Hover over chart sections to see holder details
            </div>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Top Holders -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
      <h3 class="p-4 font-medium border-b border-gray-100 dark:border-gray-700">Top Holders</h3>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        {#if isLoadingDistribution}
          <div class="text-center py-6">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-indigo-600"></div>
            <p class="mt-2 text-gray-600 dark:text-gray-300">Loading top holders...</p>
          </div>
        {:else if topHolders.length === 0}
          <div class="text-center py-6 text-gray-500">
            <p>No holder data available</p>
          </div>
        {:else}
          {#each topHolders as holder, i}
            <div class="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700">
              <div class="flex items-center gap-3">
                <div class="text-gray-400 w-6">{i + 1}.</div>
                <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                  <img src={holder.avatar || '/blank_avatar_small.png'} alt="" class="w-full h-full object-cover" />
                </div>
                <div>
                  <a href={`/portfolio/${holder.address}`} class="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                    {holder.nfd || formatAddress(holder.address)}
                  </a>
                </div>
              </div>
              <div class="text-right">
                <div class="font-medium">{holder.count} NFTs</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{holder.percentage.toFixed(1)}%</div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Sales Table -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
    <h3 class="p-4 font-medium border-b border-gray-100 dark:border-gray-700">Recent Sales</h3>
    <div class="p-4">
      {#if isLoadingSales}
        <div class="text-center py-6">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-indigo-600"></div>
          <p class="mt-2 text-gray-600 dark:text-gray-300">Loading sales data...</p>
        </div>
      {:else if sales.length === 0}
        <div class="text-center py-6 text-gray-500">
          <p>No sales data available for the selected period</p>
        </div>
      {:else}
        <SalesTable collectionId={collection.contractId} sales={sales} />
      {/if}
    </div>
  </div>
</div>

<div id="pie-tooltip" 
     class="fixed hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
     style="pointer-events: none">
</div> 