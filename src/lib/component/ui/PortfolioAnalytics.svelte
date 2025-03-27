<script lang="ts">
    import { onMount } from 'svelte';
    import { getSalesAndTransfers } from '$lib/utils/indexer';
    import type { Token, Collection, Transfer } from '$lib/data/types';
    import { getNFD } from '$lib/utils/nfd';
    import { zeroAddress } from '$lib/data/constants';
    
    // Main data
    export let tokens: Token[] = [];
    export let collections: Collection[] = [];
    export let walletId: string;

    // Real data containers
    let transfers: Transfer[] = [];
    let isLoading = true;

    // Collection analysis
    let realCollectionDistribution: {name: string, color: string, count: number, id: number}[] = [];
    let colors = ['#4F46E5', '#10B981', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6', '#8B5CF6', '#F43F5E', '#6B7280'];
    let dorkToken: Token | null = null; // Track a Dork token for the easter egg

    // Activity indicators
    let newLastMonth = 0;
    let mostFrequentCollection = 'None';
    let lastActivity = 'Unknown';

    let dorkVisible = false;
    let isFlipping = false;
    let isTextAnimating = false;
    let originalPosition = { x: 0, y: 0 };
    let textPosition = { x: 0, y: 0 };
    let imageUrl = '';
    let animationStarted = false;

    // Load real transfers data
    async function loadTransferData() {
        isLoading = true;
        
        if (walletId) {
            try {
                // Get transfers for this wallet
                transfers = await getSalesAndTransfers({ 
                    user: walletId, 
                    limit: 1000, 
                    fetch: fetch 
                });
                
                // Get NFDs for addresses
                let addresses = new Set<string>();
                transfers.forEach(t => {
                    addresses.add(t.from);
                    addresses.add(t.to);
                });
                
                const nfd = await getNFD(Array.from(addresses) as string[]);
                
                // Count new tokens in the last month
                const lastMonthTs = Date.now() - 30 * 24 * 60 * 60 * 1000;
                newLastMonth = transfers.filter(t => 
                    t.to === walletId && 
                    t.from === zeroAddress && 
                    t.timestamp * 1000 > lastMonthTs
                ).length;
                
                // Calculate last activity date
                if (transfers.length > 0) {
                    const lastTx = transfers[0];
                    lastActivity = formatDateRelative(lastTx.timestamp);
                }
                
            } catch (error) {
                console.error('Error loading transfers:', error);
            }
        }
        
        // Analyze collections
        analyzeCollections();
        
        isLoading = false;
    }

    // Analyze the token collection distribution
    function analyzeCollections() {
        if (!tokens.length) return;
        
        // Find a Dork token if it exists
        dorkToken = tokens.find(token => 
            token.contractId === 313597 || token.contractId === 894888
        ) || null;
        
        // Group tokens by collection
        const collectionCounts = new Map<number, {count: number, name: string}>();
        
        tokens.forEach(token => {
            if (!token.contractId) return;
            
            const contractId = token.contractId;
            const collection = collections.find(c => c.contractId === contractId);
            const name = collection?.highforgeData?.title || 
                         token.metadata?.collection?.name || 
                         `Collection #${contractId}`;
            
            if (!collectionCounts.has(contractId)) {
                collectionCounts.set(contractId, {count: 0, name});
            }
            
            collectionCounts.get(contractId)!.count++;
        });
        
        // Sort by count
        const sortedCollections = Array.from(collectionCounts.entries())
            .sort((a, b) => b[1].count - a[1].count);
            
        // Calculate percentages
        const totalTokens = tokens.length;
        let otherCount = 0;
        
        // Take top collections for the chart (up to 4), group the rest as "Other"
        realCollectionDistribution = sortedCollections.slice(0, 4).map(([id, data], index) => {
            const percent = Math.round((data.count / totalTokens) * 100);
            return {
                id,
                name: data.name,
                count: data.count,
                color: colors[index % colors.length]
            };
        });
        
        // Calculate "Other" category if needed
        if (sortedCollections.length > 4) {
            otherCount = sortedCollections.slice(4).reduce((sum, [, data]) => sum + data.count, 0);
            
            if (otherCount > 0) {
                realCollectionDistribution.push({
                    id: 0,
                    name: 'Other Collections',
                    count: otherCount,
                    color: colors[4]
                });
            }
        }
        
        // Get most frequent collection name
        if (sortedCollections.length > 0) {
            mostFrequentCollection = sortedCollections[0][1].name;
        }
        
        // Generate the SVG for the pie chart
        generatePieChart();
    }

    // SVG pie chart paths
    let pieChartPaths: {path: string, color: string}[] = [];
    
    // Generate SVG pie chart
    function generatePieChart() {
        const radius = 80;
        const center = 90;
        
        // SVG coordinates for the pie chart
        let cumulativePercent = 0;
        pieChartPaths = [];
        
        realCollectionDistribution.forEach(item => {
            const startPercent = cumulativePercent;
            const valuePercent = (item.count / tokens.length) * 100;
            const endPercent = startPercent + valuePercent;
            
            // Calculate coordinates
            const startAngle = startPercent / 100 * Math.PI * 2 - Math.PI / 2;
            const endAngle = endPercent / 100 * Math.PI * 2 - Math.PI / 2;
            
            const startX = center + radius * Math.cos(startAngle);
            const startY = center + radius * Math.sin(startAngle);
            const endX = center + radius * Math.cos(endAngle);
            const endY = center + radius * Math.sin(endAngle);
            
            // Determine if the arc is more than 180 degrees
            const largeArcFlag = endPercent - startPercent > 50 ? 1 : 0;
            
            // Create SVG path
            const path = `M${center},${center} L${startX},${startY} A${radius},${radius} 0 ${largeArcFlag},1 ${endX},${endY} Z`;
            
            pieChartPaths.push({
                path,
                color: item.color
            });
            
            cumulativePercent = endPercent;
        });
    }

    // Format date
    function formatDate(timestamp: number) {
        const date = new Date(timestamp * 1000);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric', 
            year: 'numeric'
        }).format(date);
    }
    
    // Format relative date (like "2 days ago")
    function formatDateRelative(timestamp: number) {
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return 'Today';
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 30) {
            return `${diffDays} days ago`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months} ${months === 1 ? 'month' : 'months'} ago`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years} ${years === 1 ? 'year' : 'years'} ago`;
        }
    }
    
    // Format wallet addresses
    function formatAddr(addr: string) {
        return addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;
    }
    
    // Classify transaction types
    function getTransactionType(transfer: Transfer) {
        if (transfer.from === zeroAddress && transfer.to === walletId) {
            return 'mint';
        } else if (transfer.from === walletId && transfer.to === zeroAddress) {
            return 'burn';
        } else if (transfer.from === walletId) {
            return transfer.salePrice ? 'sale' : 'sent';
        } else if (transfer.to === walletId) {
            return transfer.salePrice ? 'purchase' : 'received';
        }
        return 'other';
    }
    
    // Get transaction label
    function getTransactionLabel(type: string) {
        switch (type) {
            case 'mint': return 'Minted';
            case 'burn': return 'Burned';
            case 'sale': return 'Sold';
            case 'purchase': return 'Purchased';
            case 'sent': return 'Sent';
            case 'received': return 'Received';
            default: return 'Transferred';
        }
    }
    
    // Get transaction icon
    function getTransactionIcon(type: string) {
        switch (type) {
            case 'mint': return 'fa-magic text-purple-500';
            case 'burn': return 'fa-fire-alt text-red-500';
            case 'sale': return 'fa-coins text-green-500';
            case 'purchase': return 'fa-shopping-cart text-blue-500';
            case 'sent': return 'fa-arrow-right text-orange-500';
            case 'received': return 'fa-arrow-left text-indigo-500';
            default: return 'fa-exchange-alt text-gray-500';
        }
    }

    // Watch for wallet changes
    $: {
        if (walletId) {
            loadTransferData();
        }
    }

    function startFlipAnimation(event: MouseEvent) {
        if (!isFlipping) {
            const img = event.target as HTMLImageElement;
            const rect = img.getBoundingClientRect();
            const textEl = img.closest('.dork-card')?.querySelector('.dork-text') as HTMLElement;
            const textRect = textEl?.getBoundingClientRect();
            
            originalPosition = {
                x: rect.left,
                y: rect.top
            };
            textPosition = {
                x: textRect?.left || 0,
                y: textRect?.top || 0
            };
            
            imageUrl = img.src;
            isFlipping = true;
            isTextAnimating = true;
            animationStarted = false;
            
            setTimeout(() => {
                animationStarted = true;
            }, 50);
            
            setTimeout(() => {
                isFlipping = false;
                isTextAnimating = false;
                animationStarted = false;
            }, 10000);
        }
    }

    onMount(() => {
        if (walletId) {
            loadTransferData();
        }
        setTimeout(() => {
            dorkVisible = true;
        }, 500);
    });
</script>

<style>
    .dork-card {
        cursor: pointer;
        position: absolute;
        left: 0;
        top: 48px; /* Position it below the header */
        margin-left: 72px;
    }

    .dork-image-container {
        position: relative;
        width: 96px;
        height: 96px;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        overflow: hidden;
    }

    .dork-image {
        width: 100%;
        height: 100%;
        border-radius: 8px;
        object-fit: cover;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        transform: translateY(-90%); /* Show bottom portion instead of top */
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .dork-text {
        position: absolute;
        text-align: center;
        transform: translateY(100%);
        opacity: 0;
        left: 50%;
        width: 140px;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .dork-card:hover .dork-image:not(.flipping) {
        transform: translateY(0);
    }

    .dork-card:hover .dork-text {
        transform: translateY(0);
        opacity: 1;
    }

    @keyframes peekImage {
        0% { transform: translate(-50%, 100%); opacity: 0; }
        100% { transform: translate(-50%, 0); opacity: 1; }
    }

    .image-peek {
        animation: peekImage 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .floating-image {
        position: fixed;
        width: 96px;
        height: 96px;
        pointer-events: none;
        z-index: 9999;
        border-radius: 8px;
        object-fit: cover;
        box-shadow: 0 8px 16px -2px rgba(0, 0, 0, 0.2);
        transform-origin: center center;
        will-change: transform;
    }

    @keyframes crazyFlip {
        0% {
            transform: translate(0, 0) rotateY(0deg) scale(1);
        }
        10% {
            transform: translate(calc(50vw - 200px), calc(-50vh + 100px)) rotateY(180deg) scale(1.2);
        }
        20% {
            transform: translate(calc(-50vw + 100px), calc(30vh)) rotateY(360deg) scale(0.8);
        }
        30% {
            transform: translate(calc(40vw), calc(-40vh)) rotateY(540deg) scale(1.1);
        }
        40% {
            transform: translate(calc(-30vw), calc(45vh)) rotateY(720deg) scale(0.9);
        }
        50% {
            transform: translate(calc(45vw), calc(35vh)) rotateY(900deg) scale(1.2);
        }
        60% {
            transform: translate(calc(-45vw), calc(-35vh)) rotateY(1080deg) scale(0.8);
        }
        70% {
            transform: translate(calc(30vw), calc(40vh)) rotateY(1260deg) scale(1.1);
        }
        80% {
            transform: translate(calc(-40vw), calc(-30vh)) rotateY(1440deg) scale(0.9);
        }
        90% {
            transform: translate(calc(20vw), calc(25vh)) rotateY(1620deg) scale(1.05);
        }
        100% {
            transform: translate(0, 0) rotateY(1800deg) scale(1);
        }
    }

    .animate-flip {
        animation: crazyFlip 10s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    @keyframes crazyText {
        0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
        }
        15% {
            transform: translate(calc(-30vw), calc(-20vh)) rotate(-45deg) scale(1.2);
        }
        30% {
            transform: translate(calc(40vw), calc(30vh)) rotate(30deg) scale(0.9);
        }
        45% {
            transform: translate(calc(-20vw), calc(40vh)) rotate(-60deg) scale(1.1);
        }
        60% {
            transform: translate(calc(35vw), calc(-35vh)) rotate(90deg) scale(0.8);
        }
        75% {
            transform: translate(calc(-40vw), calc(-25vh)) rotate(-120deg) scale(1.2);
        }
        90% {
            transform: translate(calc(25vw), calc(20vh)) rotate(45deg) scale(0.9);
        }
        100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
        }
    }

    .animate-text {
        animation: crazyText 10s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .floating-text {
        position: fixed;
        width: 400px;
        pointer-events: none;
        z-index: 9999;
    }
</style>

<div class="py-6 px-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-6xl mx-auto">
        <!-- Analytics Header -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-2xl font-bold mb-6">Portfolio Analytics</h2>
            
            <!-- Portfolio Summary Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-4 border border-green-100 dark:border-green-900/50">
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">NFT Count</div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{tokens.length}</div>
                    <div class="text-xs text-green-600 dark:text-green-400 flex items-center">
                        <i class="fas fa-arrow-up mr-1"></i> {newLastMonth} new this month
                    </div>
                </div>
                
                <div class="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/30 dark:to-fuchsia-900/30 rounded-xl p-4 border border-purple-100 dark:border-purple-900/50">
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Collections</div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{new Set(tokens.map(t => t.contractId)).size}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                        Most: {mostFrequentCollection}
                    </div>
                </div>
                
                <div class="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-4 border border-amber-100 dark:border-amber-900/50">
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Last Activity</div>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{lastActivity}</div>
                    <div class="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                        <i class="fas fa-history mr-1"></i> {transfers.length} transactions
                    </div>
                </div>
            </div>
        </div>
        
        <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Transaction Summary -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:col-span-1">
                <h3 class="text-lg font-bold mb-4">Transaction Summary</h3>
                
                {#if isLoading}
                    <div class="py-8 flex justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700"></div>
                    </div>
                {:else if transfers.length === 0}
                    <div class="py-8 text-center text-gray-500">
                        No transactions found
                    </div>
                {:else}
                    {@const mints = transfers.filter(t => t.from === zeroAddress && t.to === walletId).length}
                    {@const sales = transfers.filter(t => t.salePrice && t.from === walletId).length}
                    {@const purchases = transfers.filter(t => t.salePrice && t.to === walletId && t.from !== zeroAddress).length}
                    {@const outTransfers = transfers.filter(t => t.from === walletId && !t.salePrice && t.to !== zeroAddress).length}
                    {@const inTransfers = transfers.filter(t => t.to === walletId && !t.salePrice && t.from !== zeroAddress).length}
                    
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-3">
                            <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                                <div class="flex items-center text-purple-600 dark:text-purple-400">
                                    <i class="fas fa-magic mr-2"></i>
                                    <span class="font-medium">Mints</span>
                                </div>
                                <div class="mt-1 text-xl font-bold">{mints}</div>
                            </div>
                            
                            <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                <div class="flex items-center text-green-600 dark:text-green-400">
                                    <i class="fas fa-coins mr-2"></i>
                                    <span class="font-medium">Sales</span>
                                </div>
                                <div class="mt-1 text-xl font-bold">{sales}</div>
                            </div>
                            
                            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                                <div class="flex items-center text-blue-600 dark:text-blue-400">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <span class="font-medium">Purchases</span>
                                </div>
                                <div class="mt-1 text-xl font-bold">{purchases}</div>
                            </div>
                            
                            <div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg">
                                <div class="flex items-center text-indigo-600 dark:text-indigo-400">
                                    <i class="fas fa-exchange-alt mr-2"></i>
                                    <span class="font-medium">Transfers</span>
                                </div>
                                <div class="mt-1 text-xl font-bold">{outTransfers + inTransfers}</div>
                            </div>
                        </div>
                        
                        <div class="text-center text-sm text-gray-500 mt-2">
                            Transactions from the most recent {transfers.length} events
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Collection Distribution -->
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 lg:col-span-1">
                <h3 class="text-lg font-bold mb-4">Collection Distribution</h3>
                
                {#if isLoading}
                    <div class="flex justify-center py-10">
                        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700"></div>
                    </div>
                {:else if realCollectionDistribution.length === 0}
                    <div class="py-10 text-center text-gray-500">
                        No collection data available
                    </div>
                {:else}
                    <div class="relative pt-6">
                        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-6xl mx-auto">
                            <div class="p-6 relative"> <!-- Added relative positioning context -->
                                <h3 class="text-lg font-bold mb-4">Collection Distribution</h3>
                                
                                {#if dorkToken}
                                    <div class="dork-card flex justify-center items-center">
                                        {#if dorkToken.metadata?.image}
                                            <div class="dork-image-container {dorkVisible ? 'image-peek' : ''}">
                                                <img 
                                                    src={dorkToken.metadata.image} 
                                                    alt="Dork Token" 
                                                    class="dork-image"
                                                    style="visibility: {isFlipping ? 'hidden' : 'visible'};"
                                                    on:click={startFlipAnimation}
                                                />
                                            </div>
                                        {/if}
                                        <div class="dork-text font-bold text-lg text-purple-600 dark:text-purple-400 {isFlipping ? 'hidden' : 'visible'}">
                                            Holy shit, is that a Dork?! 🐋
                                        </div>
                                    </div>
                                {/if}
                                <div class="flex justify-center mb-4">
                                    <!-- Dynamic SVG Pie Chart -->
                                    <svg width="180" height="180" viewBox="0 0 180 180">
                                        {#each pieChartPaths as path}
                                            <path d={path.path} fill={path.color} />
                                        {/each}
                                        <circle cx="90" cy="90" r="40" fill="white" class="dark:fill-gray-800" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        
                        <div class="space-y-2">
                            {#each realCollectionDistribution as item}
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="w-3 h-3 rounded-full mr-2" style="background-color: {item.color}"></div>
                                        <span class="text-sm">{item.name}</span>
                                    </div>
                                    <div class="flex flex-col items-end">
                                        <span class="text-sm font-medium">{Math.round((item.count / tokens.length) * 100)}%</span>
                                        <span class="text-xs text-gray-500">{item.count} NFTs</span>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>

                    {#if isFlipping}
                        <div class="fixed inset-0 pointer-events-none" style="z-index: 9999; perspective: 1000px;">
                            <img 
                                src={imageUrl}
                                alt="Floating Dork"
                                class="floating-image {animationStarted ? 'animate-flip' : ''}"
                                style="left: {originalPosition.x}px; top: {originalPosition.y}px;"
                            />
                            <div 
                                class="floating-text font-bold text-lg text-purple-600 dark:text-purple-400 {animationStarted ? 'animate-text' : ''}"
                                style="left: {textPosition.x}px; top: {textPosition.y}px;"
                            >
                                Holy shit, is that a Dork?! 🐋
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </div>
    </div>
</div> 