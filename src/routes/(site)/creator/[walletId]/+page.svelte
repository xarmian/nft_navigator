<script lang="ts">
    import { onMount } from 'svelte';
    import { getImageUrl } from '$lib/utils/functions';
    import { getSales, getTokens } from '$lib/utils/indexer';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { copy } from 'svelte-copy';
    import { toast } from '@zerodevx/svelte-toast';
    import { zeroAddress, supabaseImageUrl } from '$lib/data/constants';
    import ImageModal from '$lib/component/ui/ImageModal.svelte';
    import type { Token } from '$lib/data/types';
    
    interface Sale {
        collectionId: number;
        timestamp: number;
        price: number;
        tokenId: string;
    }
    
    interface Message {
        id: number;
        walletId: string;
        message: string;
        timestamp: string;
        private: boolean;
        collectionId: number;
        deleted: boolean;
        reactions: null | number[];
        poll: null | any;
        reactions_json: Record<string, any>;
        images: string[];
        mr: any[];
        comments: any[];
    }
    
    interface Collection {
        contractId: number;
        highforgeData?: {
            title?: string;
        };
        firstToken?: {
            metadata?: {
                collection?: {
                    name?: string;
                };
            };
        };
    }
    
    interface NFD {
        key: string;
        replacementValue: string;
        avatar: string | null;
    }
    
    export let data: any;
    
    // Reactive variables
    $: walletId = data.walletId;
    $: creatorInfo = data.creatorInfo;
    $: createdCollections = data.createdCollections || [];
    $: totalNFTs = data.totalNFTs;
    $: totalOwners = data.totalOwners;
    $: burnedNFTs = data.burnedNFTs;
    $: allCollectionTokens = data.allCollectionTokens || {};
    $: salesData = data.salesData as Sale[] || [];
    $: totalSalesVolume = data.totalSalesVolume || 0;
    $: collectionsByPopularity = data.collectionsByPopularity || [];
    $: collectionsByVolume = data.collectionsByVolume || [];
    $: collectionsByOwnership = data.collectionsByOwnership || [];
    
    // Track loading state and data
    let isLoading = true;
    let searchQuery = '';
    let sales: Sale[] = [];
    let loungeMessages: Message[] = [];
    let loungeNFDs: NFD[] = [];
    let salesByCollection: Record<number, {count: number, volume: number}> = {};
    let selectedImage = '';
    let showImageModal = false;
    
    // Format timestamp to relative time
    function timeSince(timestamp: string | number): string {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp * 1000);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diffMs / (1000 * 60));
                return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
            }
            return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
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
    
    onMount(async () => {
        try {
            // Initialize arrays to store all sales and messages
            let allSales: Sale[] = [];
            let allMessages: Message[] = [];
            salesByCollection = {};

            // Fetch sales and messages for each collection
            for (const collection of createdCollections) {
                // Fetch sales data for this collection
                const collectionSales = await getSales({ 
                    contractId: String(collection.contractId),
                    limit: 10000, // High limit to get all sales
                    fetch: fetch
                });

                if (collectionSales) {
                    // Add to total sales array
                    allSales = [...allSales, ...collectionSales];
                    
                    // Calculate volume for this collection
                    const volume = collectionSales.reduce((acc, sale) => acc + sale.price, 0);
                    const count = collectionSales.length;
                    
                    salesByCollection[collection.contractId] = { count, volume };

                    // Fetch token data for this collection's sales
                    const tokenIds = collectionSales.map(sale => `${collection.contractId}_${sale.tokenId}`).join(',');
                    if (tokenIds) {
                        const tokens = await getTokens({ 
                            tokenIds: tokenIds,
                            fetch: fetch 
                        });
                        if (tokens) {
                            allCollectionTokens[collection.contractId] = tokens;
                        }
                    }
                }

                // Fetch lounge messages for this collection
                try {
                    const response = await fetch(`/api/lounge/${collection.contractId}`);
                    if (response.ok) {
                        const data = await response.json();
                        // Filter only public messages that aren't deleted
                        const collectionMessages = data.messages
                            .filter((m: Message) => !m.private && !m.deleted);
                        allMessages = [...allMessages, ...collectionMessages];
                        loungeNFDs = [...loungeNFDs, ...data.nfds];
                    }
                } catch (error) {
                    console.error('Error fetching lounge messages for collection:', collection.contractId, error);
                }
            }

            // Update total sales volume
            totalSalesVolume = Object.values(salesByCollection).reduce((acc, { volume }) => acc + volume, 0);

            // Sort collections by volume
            collectionsByVolume = [...createdCollections].sort((a, b) => {
                const aVolume = salesByCollection[a.contractId]?.volume || 0;
                const bVolume = salesByCollection[b.contractId]?.volume || 0;
                return bVolume - aVolume;
            });

            // Get 5 most recent sales
            sales = allSales
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5);

            // Get 5 most recent messages
            loungeMessages = allMessages
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 5);

            isLoading = false;
        } catch (error) {
            console.error('Error loading creator data:', error);
            isLoading = false;
        }
    });
    
    // Format wallet address for display
    $: formattedWallet = walletId ? 
        (walletId.length > 8 ? `${walletId.slice(0, 6)}...${walletId.slice(-6)}` : walletId) 
        : '';
    
    // Filter collections by search query
    function collectionMatchesSearch(collection: Collection): boolean {
        if (!searchQuery) return true;
        
        const searchLower = searchQuery.toLowerCase();
        return (
            (collection.highforgeData?.title || '').toLowerCase().includes(searchLower) ||
            `Collection #${collection.contractId}`.toLowerCase().includes(searchLower) ||
            (collection.firstToken?.metadata?.collection?.name || '').toLowerCase().includes(searchLower)
        );
    }
    
    // Function to get "display name" of collection
    function getCollectionDisplayName(collection: Collection): string {
        return collection.highforgeData?.title || 
               collection.firstToken?.metadata?.collection?.name || 
               `Collection #${collection.contractId}`;
    }
    
    // Handle clicking a collection
    function goToCollection(contractId: number) {
        goto(`/collection/${contractId}`);
    }
    
    function formatVOI(amount: number): string {
        return (amount / Math.pow(10, 6)).toLocaleString();
    }
</script>

<script context="module">
    // Type definitions
    interface Sale {
        collectionId: number;
        price: number;
        // Add other properties as needed
    }

    let salesByCollection: Record<number, {count: number, volume: number}> = {};
    
    // Populate salesByCollection from salesData if not already done
    function populateSalesByCollection(salesData: Sale[]) {
        if (Object.keys(salesByCollection).length === 0 && salesData.length > 0) {
            salesData.forEach((sale: Sale) => {
                const price = sale.price || 0;
                
                if (!salesByCollection[sale.collectionId]) {
                    salesByCollection[sale.collectionId] = { count: 0, volume: 0 };
                }
                salesByCollection[sale.collectionId].count++;
                salesByCollection[sale.collectionId].volume += price;
            });
        }
        return salesByCollection;
    }
</script>

<svelte:head>
    <title>{data.pageMetaTags.title}</title>
    <meta name="description" content={data.pageMetaTags.description} />
    <meta property="og:title" content={data.pageMetaTags.title} />
    <meta property="og:description" content={data.pageMetaTags.description} />
    <meta property="og:image" content={data.pageMetaTags.imageUrl} />
</svelte:head>

{#if isLoading}
    <div class="fixed inset-0 bg-white dark:bg-black flex items-center justify-center">
        <div class="space-y-4 text-center">
            <div class="text-gray-500 dark:text-gray-400 animate-pulse text-lg">Loading creator profile...</div>
            <div class="flex gap-2 justify-center">
                {#each Array(3) as _, i}
                    <div class="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style="animation-delay: {i * 200}ms"></div>
                {/each}
            </div>
        </div>
    </div>
{:else}
    <div class="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white">
        <!-- Immersive Hero Section -->
        <div class="relative h-screen">
            <!-- Dynamic Background -->
            <div class="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50 dark:to-black">
                {#if creatorInfo?.metadata?.avatar}
                    <img 
                        src={creatorInfo.metadata.avatar} 
                        alt="Background" 
                        class="w-full h-full object-cover opacity-20 dark:opacity-30 blur-sm"
                    >
                {:else}
                    <div class="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900"></div>
                {/if}
            </div>

            <!-- Hero Content -->
            <div class="absolute inset-0 flex items-center justify-center">
                <div class="max-w-7xl mx-auto px-4 w-full">
                    <div class="flex flex-col items-center text-center space-y-8">
                        <!-- Creator Avatar -->
                        <div class="relative">
                            {#if creatorInfo?.metadata?.avatar}
                                <img 
                                    src={creatorInfo.metadata.avatar} 
                                    alt={creatorInfo.name || formattedWallet}
                                    class="w-40 h-40 md:w-48 md:h-48 rounded-full object-cover border-4 border-white/10"
                                >
                            {:else}
                                <div class="w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                                    <i class="fas fa-palette text-6xl"></i>
                                </div>
                            {/if}
                            <div class="absolute -bottom-2 -right-2 bg-gradient-to-r from-purple-500 to-indigo-500 p-2 rounded-full">
                                <i class="fas fa-badge-check text-xl"></i>
                                Creator
                            </div>
                        </div>

                        <!-- Creator Name & Info -->
                        <div class="space-y-4">
                            {#if creatorInfo?.name} 
                                <h1 class="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
                                    {creatorInfo.name}
                                </h1>
                            {/if}
                            <div class="flex items-center justify-center gap-2 text-lg text-gray-600 dark:text-gray-300">
                                <span class="font-mono">{formattedWallet}</span>
                                <button 
                                    use:copy={walletId}
                                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
                                    on:click={() => {
                                        toast.push({
                                            msg: `<div class="flex items-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Address copied</div>`,
                                            theme: {
                                                '--toastBackground': '#48BB78',
                                                '--toastBarBackground': '#2F855A'
                                            }
                                        });
                                    }}
                                    aria-label="Copy wallet address"
                                >
                                    <i class="fas fa-copy"></i>
                                </button>
                            </div>
                            {#if creatorInfo?.metadata?.description}
                                <p class="max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-300">
                                    {creatorInfo.metadata.description}
                                </p>
                            {/if}
                        </div>

                        <!-- Quick Stats -->
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mt-8">
                            <div class="text-center">
                                <div class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
                                    {createdCollections.length}
                                </div>
                                <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">Collections</div>
                            </div>
                            <div class="text-center">
                                <div class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                                    {totalNFTs}
                                </div>
                                <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">NFTs Created</div>
                            </div>
                            <div class="text-center">
                                <div class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-400">
                                    {totalOwners}
                                </div>
                                <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">Collectors</div>
                            </div>
                            {#if totalSalesVolume > 0}
                                <div class="text-center">
                                    <div class="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-rose-400">
                                        {formatVOI(totalSalesVolume)}
                                    </div>
                                    <div class="text-sm text-gray-600 dark:text-gray-300 mt-1">VOI Volume ({Object.values(salesByCollection).reduce((acc, { count }) => acc + count, 0)} sales)</div>
                                </div>
                            {/if}
                        </div>

                        <!-- Social Links -->
                        {#if creatorInfo?.metadata}
                            <div class="flex flex-wrap justify-center gap-4 mt-8">
                                {#if creatorInfo.metadata.url}
                                    <a href={creatorInfo.metadata.url} 
                                       target="_blank" 
                                       rel="noopener noreferrer"
                                       class="group flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all">
                                        <i class="fas fa-globe text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300"></i>
                                        <span class="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">{creatorInfo.metadata.url}</span>
                                    </a>
                                {/if}
                                {#if creatorInfo.metadata['com.twitter']}
                                    <a href="https://x.com/{creatorInfo.metadata['com.twitter']}" 
                                       target="_blank"
                                       class="group flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all">
                                        <i class="fab fa-x-twitter text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300"></i>
                                        <span class="text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">@{creatorInfo.metadata['com.twitter']}</span>
                                    </a>
                                {/if}
                            </div>
                        {/if}

                        <!-- Scroll Indicator -->
                        <div class="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                            <i class="fas fa-chevron-down text-white/50"></i>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Content Sections -->
        <div class="relative py-20 bg-gradient-to-b from-gray-50 via-gray-50 to-gray-100 dark:from-black dark:via-black dark:to-gray-900">
            <div class="max-w-7xl mx-auto px-4">
                <!-- Section Header -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                    <div>
                        <h2 class="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400">Creator Activity</h2>
                        <p class="text-white/70 mt-2">Recent sales and community engagement</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
                    <!-- Recent Sales -->
                    <div class="bg-white dark:bg-white/5 shadow-lg dark:shadow-none rounded-2xl p-6 backdrop-blur-sm">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                <i class="fas fa-chart-line text-green-600 dark:text-green-400"></i>
                                Recent Sales
                            </h3>
                            <button 
                                class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors text-sm flex items-center gap-1"
                                on:click={() => goto(`/collection/${createdCollections[0]?.contractId}?tab=transactions`)}
                            >
                                View All Sales <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                        {#if sales.length === 0}
                            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                                No sales recorded yet
                            </div>
                        {:else}
                            <div class="space-y-4">
                                {#each sales as sale}
                                    <button 
                                        class="w-full text-left"
                                        on:click={() => goToCollection(sale.collectionId)}
                                    >
                                        <div class="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors">
                                            <div class="flex items-center gap-4">
                                                <div class="w-12 h-12 rounded-lg overflow-hidden bg-white/5">
                                                    {#if allCollectionTokens[sale.collectionId]}
                                                        {@const token = allCollectionTokens[sale.collectionId].find((t: Token) => t.tokenId === sale.tokenId)}
                                                        {#if token?.metadata?.image}
                                                            <img 
                                                                src={getImageUrl(token.metadata.image, 100)}
                                                                alt={`Token #${sale.tokenId}`}
                                                                class="w-full h-full object-cover"
                                                            />
                                                        {:else}
                                                            <div class="w-full h-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                                                                <i class="fas fa-image text-white/20 text-xl"></i>
                                                            </div>
                                                        {/if}
                                                    {:else}
                                                        <div class="w-full h-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                                                            <i class="fas fa-image text-white/20 text-xl"></i>
                                                        </div>
                                                    {/if}
                                                </div>
                                                <div class="flex-1">
                                                    <div class="font-medium text-gray-900 dark:text-white">
                                                        {getCollectionDisplayName(createdCollections.find((c: Collection) => c.contractId === sale.collectionId))}
                                                    </div>
                                                    <div class="text-sm text-gray-600 dark:text-gray-400">
                                                        Token #{sale.tokenId} • Sold for {formatVOI(sale.price)} VOI
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                                {timeSince(sale.timestamp)}
                                            </div>
                                        </div>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>

                    <!-- Recent Lounge Activity -->
                    <div class="bg-white dark:bg-white/5 shadow-lg dark:shadow-none rounded-2xl p-6 backdrop-blur-sm">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-xl font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                                <i class="fas fa-comments text-blue-600 dark:text-blue-400"></i>
                                Community Engagement
                            </h3>
                            <button 
                                class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors text-sm flex items-center gap-1"
                                on:click={() => goto(`/lounge/${createdCollections[0]?.contractId}`)}
                            >
                                Visit Lounge <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                        {#if loungeMessages.length === 0}
                            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                                No recent messages
                            </div>
                        {:else}
                            <div class="space-y-4">
                                {#each loungeMessages as message}
                                    <div class="p-4 bg-gray-50 hover:bg-gray-100 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors">
                                        <div class="flex items-start gap-4">
                                            <!-- User Avatar with Hover Effect -->
                                            <button 
                                                on:click|stopPropagation={() => goto(`/portfolio/${message.walletId}`)} 
                                                class="relative flex-shrink-0 w-12 h-12 rounded-full overflow-hidden ring-2 ring-white/10 dark:ring-white/5 hover:ring-blue-500 transition-all duration-200"
                                            >
                                                <img 
                                                    src={getImageUrl(loungeNFDs?.find((nfd: {key: string}) => nfd.key === message.walletId)?.avatar ?? '/blank_avatar_small.png', 240)} 
                                                    alt="User avatar"
                                                    class="w-full h-full object-cover"
                                                />
                                            </button>

                                            <div class="flex-1">
                                                <!-- Header Section -->
                                                <div class="flex items-center justify-between mb-2">
                                                    <div class="flex items-center gap-3 w-full">
                                                        <a 
                                                            href={`/portfolio/${message.walletId}`}
                                                            on:click|preventDefault|stopPropagation={() => goto(`/portfolio/${message.walletId}`)}
                                                            class="text-sm font-semibold text-gray-900 hover:text-gray-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                                                        >
                                                            {loungeNFDs?.find((nfd: {key: string}) => nfd.key === message.walletId)?.replacementValue ?? (message.walletId.slice(0, 8) + '...' + message.walletId.slice(-8))}
                                                        </a>
                                                        <div class="flex items-center justify-between w-full">
                                                            <span class="text-xs text-gray-500 dark:text-gray-400" title={new Date(message.timestamp).toLocaleString()}>
                                                                {timeSince(message.timestamp)}
                                                            </span>
                                                            <span class="text-xs text-gray-500 dark:text-gray-400">
                                                                {getCollectionDisplayName(createdCollections.find((c: Collection) => c.contractId === Number(message.collectionId)))}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- Message Content -->
                                                <div class="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
                                                    <div class="whitespace-pre-wrap">{message.message}</div>
                                                    {#if message.images && message.images.length > 0}
                                                        <div class="grid gap-2 mt-4 grid-cols-3">
                                                            {#each message.images as image}
                                                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                                                <div 
                                                                    role="button"
                                                                    tabindex="0"
                                                                    class="relative aspect-square cursor-zoom-in overflow-hidden rounded-lg ring-1 ring-black/5 dark:ring-white/5"
                                                                    on:click={() => {
                                                                        selectedImage = `${supabaseImageUrl}/${image}`;
                                                                        showImageModal = true;
                                                                    }}
                                                                >
                                                                    <img 
                                                                        src={`${supabaseImageUrl}/${image}`}
                                                                        alt="Message content" 
                                                                        class="w-full h-full object-cover transition-all duration-300"
                                                                    />
                                                                    <div class="absolute inset-0 opacity-0 hover:opacity-100 transition-all duration-300">
                                                                        <div class="absolute inset-0 bg-black/10"></div>
                                                                        <div class="absolute bottom-3 right-3">
                                                                            <div class="p-2 bg-black/60 rounded-full text-white/90 hover:text-white">
                                                                                <i class="fas fa-expand-alt"></i>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                </div>

                                                <!-- Message Footer -->
                                                <div class="flex items-center gap-4 mt-3 text-sm">
                                                    {#if Object.keys(message.reactions_json || {}).length > 0}
                                                        <div class="flex flex-wrap gap-2">
                                                            {#each Object.entries(message.reactions_json) as [reaction, count]}
                                                                <div class="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-xs">
                                                                    <span>{reaction}</span>
                                                                    <span class="text-white/50">{count}</span>
                                                                </div>
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                    <div class="flex-1"></div>
                                                    {#if message.comments?.length > 0}
                                                        <div class="flex items-center gap-1 text-white/50 text-xs">
                                                            <i class="fas fa-comment"></i>
                                                            <span>{message.comments.length}</span>
                                                        </div>
                                                    {/if}
                                                    <button 
                                                        class="text-blue-400 hover:text-blue-300 transition-colors text-xs flex items-center gap-1"
                                                        on:click={() => goto(`/lounge/${message.collectionId}`)}
                                                    >
                                                        View Thread <i class="fas fa-arrow-right text-xs"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Collection Metrics -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24">
                    <!-- Most Popular -->
                    <div class="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold flex items-center gap-2">
                                <i class="fas fa-fire text-orange-400"></i>
                                Most Popular
                            </h3>
                            <button 
                                class="text-blue-400 hover:text-blue-300 transition-colors text-sm flex items-center gap-1"
                                on:click={() => goto(`/collection/${collectionsByPopularity[0]?.contractId}`)}
                            >
                                View Collection <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                        {#each collectionsByPopularity.slice(0, 3) as collection}
                            <div class="flex items-center gap-4 mb-4 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
                                 on:click={() => goToCollection(collection.contractId)}>
                                <div class="w-12 h-12 rounded-lg overflow-hidden bg-white/5">
                                    {#if collection.highforgeData?.coverImageURL}
                                        <img src={getImageUrl(collection.highforgeData.coverImageURL, 100)} 
                                             alt={getCollectionDisplayName(collection)}
                                             class="w-full h-full object-cover">
                                    {:else if allCollectionTokens[collection.contractId]?.[0]?.metadata?.image}
                                        <img src={getImageUrl(allCollectionTokens[collection.contractId][0].metadata.image, 100)}
                                             alt={getCollectionDisplayName(collection)}
                                             class="w-full h-full object-cover">
                                    {/if}
                                </div>
                                <div class="flex-1">
                                    <div class="font-medium truncate">{getCollectionDisplayName(collection)}</div>
                                    <div class="text-sm text-white/50">{collection.uniqueOwners || '?'} owners</div>
                                </div>
                            </div>
                        {/each}
                    </div>

                    <!-- Highest Volume -->
                    <div class="bg-white/5 rounded-2xl p-6 backdrop-blur-sm">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold flex items-center gap-2">
                                <i class="fas fa-chart-line text-green-400"></i>
                                Highest Volume
                            </h3>
                            <button 
                                class="text-blue-400 hover:text-blue-300 transition-colors text-sm flex items-center gap-1"
                                on:click={() => goto(`/analytics/collections/${collectionsByVolume[0]?.contractId}`)}
                            >
                                View Analytics <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                        {#each collectionsByVolume.slice(0, 3) as collection}
                            <div class="flex items-center gap-4 mb-4 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors"
                                 on:click={() => goto(`/analytics/collections/${collection.contractId}`)}>
                                <div class="w-12 h-12 rounded-lg overflow-hidden bg-white/5">
                                    {#if collection.highforgeData?.coverImageURL}
                                        <img src={getImageUrl(collection.highforgeData.coverImageURL, 100)} 
                                             alt={getCollectionDisplayName(collection)}
                                             class="w-full h-full object-cover">
                                    {:else if allCollectionTokens[collection.contractId]?.[0]?.metadata?.image}
                                        <img src={getImageUrl(allCollectionTokens[collection.contractId][0].metadata.image, 100)}
                                             alt={getCollectionDisplayName(collection)}
                                             class="w-full h-full object-cover">
                                    {/if}
                                </div>
                                <div class="flex-1">
                                    <div class="font-medium truncate">{getCollectionDisplayName(collection)}</div>
                                    <div class="text-sm text-white/50">
                                        {formatVOI(salesByCollection[collection.contractId]?.volume || 0)} VOI ({salesByCollection[collection.contractId]?.count || 0} sales)
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Collection Grid Header -->
                <div class="flex justify-between items-center mb-8">
                    <h3 class="text-2xl font-semibold">All Collections</h3>
                    <div class="relative">
                        <input
                            type="text"
                            placeholder="Search collections..."
                            bind:value={searchQuery}
                            class="w-64 px-4 py-2 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-purple-500 dark:focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        >
                        <i class="fas fa-search absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"></i>
                    </div>
                </div>

                <!-- Collection Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {#each createdCollections.filter(collectionMatchesSearch) as collection}
                        <button 
                            class="w-full text-left"
                            on:click={() => goToCollection(collection.contractId)}
                        >
                            <div class="group relative bg-white dark:bg-white/5 shadow-lg dark:shadow-none rounded-2xl overflow-hidden hover:transform hover:-translate-y-1 transition-all duration-300">
                                <div class="aspect-video relative overflow-hidden">
                                    {#if collection.highforgeData?.coverImageURL}
                                        <img 
                                            src={getImageUrl(collection.highforgeData.coverImageURL, 800)}
                                            alt={getCollectionDisplayName(collection)}
                                            class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        >
                                    {:else if allCollectionTokens[collection.contractId]?.[0]?.metadata?.image}
                                        <img 
                                            src={getImageUrl(allCollectionTokens[collection.contractId][0].metadata.image, 800)}
                                            alt={getCollectionDisplayName(collection)}
                                            class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        >
                                    {:else}
                                        <div class="w-full h-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                                            <i class="fas fa-image text-white/20 text-4xl"></i>
                                        </div>
                                    {/if}
                                    
                                    <!-- Hover Overlay -->
                                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div class="absolute bottom-0 left-0 right-0 p-6">
                                            <div class="flex justify-between items-end">
                                                <div>
                                                    <div class="text-sm text-white/70">Collection</div>
                                                    <div class="text-xl font-bold">{getCollectionDisplayName(collection)}</div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <i class="fas fa-arrow-right text-white/70"></i>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Quick Stats -->
                                <div class="absolute top-4 right-4 flex gap-2">
                                    <div class="bg-white/90 dark:bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-gray-900 dark:text-white">
                                        <i class="fas fa-layer-group mr-1"></i>
                                        {collection.totalSupply}
                                    </div>
                                    <div class="bg-white/90 dark:bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-gray-900 dark:text-white">
                                        <i class="fas fa-users mr-1"></i>
                                        {collection.uniqueOwners || '?'}
                                    </div>
                                </div>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        </div>
    </div>
{/if}

{#if showImageModal}
    <ImageModal 
        bind:showModal={showImageModal}
        imageUrl={selectedImage}
        altText="Message image"
    />
{/if}

<style>
    /* Optional: Add custom animations or styles */
    .typewriter-effect {
        overflow: hidden;
        white-space: nowrap;
    }
</style> 