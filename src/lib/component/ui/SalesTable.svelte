<script lang="ts">
    import type { Sale } from '$lib/data/types';
    import { onMount } from 'svelte';
    import { toast } from '@zerodevx/svelte-toast';
	import TokenIcon from './TokenIcon.svelte';
    import { indexerBaseURL } from '$lib/utils/indexer';
    import { getNFD } from '$lib/utils/nfd';
    import blankAvatar from '$lib/assets/blank_avatar.png';
    
    interface SaleWithEnvoiName extends Sale {
        buyerEnvoi?: {
            key: string;
            avatar?: string;
            replacementValue?: string;
        };
        sellerEnvoi?: {
            key: string;
            avatar?: string;
            replacementValue?: string;
        };
    }

    export let collectionId: number = 0;
    export let sales: SaleWithEnvoiName[] = [];
    export let sortDirection: 'asc' | 'desc' = 'desc';
    export let tokenId: string = '';

    let currentPage = 1;
    let itemsPerPage = 10;
    
    $: filteredSales = tokenId 
        ? sales.filter(sale => sale.tokenId === tokenId)
        : sales;
    $: paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    $: totalPages = Math.ceil(filteredSales.length / itemsPerPage);

    function nextPage() {
        if (currentPage < totalPages) currentPage++;
    }

    function previousPage() {
        if (currentPage > 1) currentPage--;
    }

    function downloadCSV() {
        const headers = ['Date/Time', 'Block', 'Transaction ID', 'Collection', 'Token', 'Seller', 'Buyer', 'Amount', 'Currency'];
        const rows = sales.map(sale => [
            new Date(sale.timestamp*1000).toLocaleString().replace(',',''),
            sale.round,
            sale.transactionId,
            sale.collectionId,
            sale.tokenId,
            sale.seller,
            sale.buyer,
            sale.price,
            sale.currency == 0 ? 'VOI' : 'VIA',
        ]);

        let csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}${month}${day}`;
        link.setAttribute('download', `sales_${collectionId}_${formattedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Function to copy text to clipboard
    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            toast.push(`Wallet Copied to Clipboard:<br/> ${text.substring(0,20)}...`);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }

    onMount(async () => {
        const estimatedRowHeight = 50; // Replace with your estimated row height
        itemsPerPage = Math.max(10,Math.floor(window.innerHeight / estimatedRowHeight));

        if (sales.length > 0) return;
        const url = `${indexerBaseURL}/mp/sales/?collectionId=${collectionId}`;
        try {
            const data = await fetch(url).then((response) => response.json());
            sales = data.sales;
        }
        catch(err) {
            console.error(err);
        }

        // Get unique list of addresses from both buyers and sellers
        const addresses = Array.from(new Set([
            ...sales.map(sale => sale.seller),
            ...sales.map(sale => sale.buyer)
        ]));

        const nfds = await getNFD(addresses);
        
        // Create a new array to trigger reactivity
        sales = sales.map(sale => {
            const nfd = nfds.find(nfd => nfd.key === sale.seller || nfd.key === sale.buyer);
            const updatedSale = { ...sale };
            
            if (nfd) {
                if (nfd.key === sale.seller) {
                    updatedSale.sellerEnvoi = {
                        key: sale.seller,
                        replacementValue: nfd.replacementValue,
                        avatar: nfd.avatar ?? undefined
                    };
                }
                if (nfd.key === sale.buyer) {
                    updatedSale.buyerEnvoi = {
                        key: sale.buyer,
                        replacementValue: nfd.replacementValue,
                        avatar: nfd.avatar ?? undefined
                    };
                }
            }
            return updatedSale;
        });
    });

    $: {
        sales = sales.sort((a: Sale, b: Sale) => sortDirection === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);
    }
    
</script>
<div class="w-full px-4 md:px-0 pt-4 md:pr-8">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700">
        <div class="inline-flex items-center space-x-1 sm:space-x-2">
            <button 
                on:click={() => (currentPage = 1)} 
                disabled={currentPage === 1} 
                class="p-1.5 rounded-md bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-600">
                <span class="sr-only">First page</span>
                <i class="fas fa-angle-double-left text-sm"></i>
            </button>
            <button 
                on:click={previousPage} 
                disabled={currentPage === 1} 
                class="p-1.5 rounded-md bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-600">
                <span class="sr-only">Previous page</span>
                <i class="fas fa-angle-left text-sm"></i>
            </button>
            <span class="text-xs sm:text-sm font-medium whitespace-nowrap px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">{currentPage}/{totalPages}</span>
            <button 
                on:click={nextPage} 
                disabled={currentPage === totalPages} 
                class="p-1.5 rounded-md bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-600">
                <span class="sr-only">Next page</span>
                <i class="fas fa-angle-right text-sm"></i>
            </button>
            <button 
                on:click={() => (currentPage = totalPages)} 
                disabled={currentPage === totalPages} 
                class="p-1.5 rounded-md bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200 dark:border-gray-600">
                <span class="sr-only">Last page</span>
                <i class="fas fa-angle-double-right text-sm"></i>
            </button>
        </div>
        <button 
            on:click={downloadCSV} 
            class="inline-flex items-center px-3 py-1.5 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors text-sm md:text-lg shadow-sm hover:shadow"
            title="Download as CSV"
            aria-label="Download as CSV">
            <i class="fas fa-file-csv mr-1.5"></i>
            <i class="fas fa-download"></i>
        </button>
    </div>

    <!-- Table headers (desktop only) -->
    <div class="hidden md:grid md:grid-cols-[2fr,1fr,1.5fr,1.5fr,1fr] lg:grid-cols-[1.5fr,1fr,1.5fr,1.5fr,1fr] gap-4 px-4 py-2 mb-2 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-sm text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider border border-gray-100 dark:border-gray-700">
        <div>Date/Time</div>
        <div>Token</div>
        <div>Seller</div>
        <div>Buyer</div>
        <div class="text-right">Amount</div>
    </div>

    <!-- Responsive grid that acts as table on desktop -->
    <div class="space-y-2 md:space-y-1.5">
        {#each paginatedSales as sale}
            <div class="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-sm hover:shadow rounded-lg p-4 md:p-3 border border-gray-100 dark:border-gray-700 transition-all hover:bg-white dark:hover:bg-gray-800">
                <!-- Mobile view -->
                <div class="md:hidden space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-medium text-gray-900 dark:text-gray-100">{new Date(sale.timestamp*1000).toLocaleString()}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">
                                Block: <a href={'https://explorer.voi.network/explorer/block/'+sale.round+'/transactions'} 
                                        class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline" 
                                        target="_blank">{sale.round}</a>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="font-medium text-emerald-600 dark:text-emerald-400 text-lg">
                                {(sale.price/1000000).toLocaleString()} VOI
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-4 text-sm">
                        {#if collectionId === 0}
                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1">Collection</div>
                                <a href={`/collection/${sale.collectionId}`} 
                                   class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.collectionId}</a>
                            </div>
                        {/if}
                        <div>
                            <div class="text-gray-500 dark:text-gray-400 mb-1">Token</div>
                            <a href={`/collection/${sale.collectionId}/token/${sale.tokenId}`} 
                               class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.tokenId}</a>
                        </div>
                        
                        <div class="space-y-3">
                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1">Seller</div>
                                <div class="flex items-center space-x-3">
                                    <img src={sale.sellerEnvoi?.avatar || blankAvatar} alt="" class="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700"/>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center space-x-2">
                                            <div class="flex-1 truncate">
                                                {#if sale.sellerEnvoi}
                                                    <a href={`/portfolio/${sale.seller}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.sellerEnvoi.replacementValue}</a>
                                                {:else}
                                                    <a href={`/portfolio/${sale.seller}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.seller.slice(0,8)}...{sale.seller.slice(-8)}</a>
                                                {/if}
                                            </div>
                                            <button on:click={() => copyToClipboard(sale.seller)} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                                <i class="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div class="text-gray-500 dark:text-gray-400 mb-1">Buyer</div>
                                <div class="flex items-center space-x-3">
                                    <img src={sale.buyerEnvoi?.avatar || blankAvatar} alt="" class="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700"/>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center space-x-2">
                                            <div class="flex-1 truncate">
                                                {#if sale.buyerEnvoi}
                                                    <a href={`/portfolio/${sale.buyer}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.buyerEnvoi.replacementValue}</a>
                                                {:else}
                                                    <a href={`/portfolio/${sale.buyer}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.buyer.slice(0,8)}...{sale.buyer.slice(-8)}</a>
                                                {/if}
                                            </div>
                                            <button on:click={() => copyToClipboard(sale.buyer)} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                                <i class="fas fa-copy"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                            <a href={'https://explorer.voi.network/explorer/transaction/'+sale.transactionId} 
                               class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline" 
                               target="_blank">Tx: {sale.transactionId}</a>
                        </div>
                    </div>
                </div>

                <!-- Desktop view (table-like) -->
                <div class="hidden md:grid md:grid-cols-[2fr,1fr,1.5fr,1.5fr,1fr] lg:grid-cols-[1.5fr,1fr,1.5fr,1.5fr,1fr] gap-4 items-center text-sm">
                    <div>
                        <div class="font-medium text-gray-900 dark:text-gray-100">{new Date(sale.timestamp*1000).toLocaleString()}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">
                            Block: <a href={'https://explorer.voi.network/explorer/block/'+sale.round+'/transactions'} 
                                    class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline" 
                                    target="_blank">{sale.round}</a>
                            <span class="mx-1">·</span>
                            <a href={'https://explorer.voi.network/explorer/transaction/'+sale.transactionId} 
                               class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline" 
                               target="_blank">Tx: {sale.transactionId.slice(0,8)}...</a>
                        </div>
                    </div>

                    <div>
                        {#if collectionId === 0}
                            <div class="text-xs text-gray-500 dark:text-gray-400">Collection {sale.collectionId}</div>
                        {/if}
                        <a href={`/collection/${sale.collectionId}/token/${sale.tokenId}`} 
                           class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.tokenId}</a>
                    </div>

                    <div class="flex items-center space-x-2">
                        <img src={sale.sellerEnvoi?.avatar || blankAvatar} alt="" class="w-6 h-6 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700"/>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-1">
                                <div class="flex-1 truncate">
                                    {#if sale.sellerEnvoi}
                                        <a href={`/portfolio/${sale.seller}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.sellerEnvoi.replacementValue}</a>
                                    {:else}
                                        <a href={`/portfolio/${sale.seller}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.seller.slice(0,8)}...</a>
                                    {/if}
                                </div>
                                <button on:click={() => copyToClipboard(sale.seller)} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <i class="fas fa-copy text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2">
                        <img src={sale.buyerEnvoi?.avatar || blankAvatar} alt="" class="w-6 h-6 rounded-full object-cover flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700"/>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-1">
                                <div class="flex-1 truncate">
                                    {#if sale.buyerEnvoi}
                                        <a href={`/portfolio/${sale.buyer}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.buyerEnvoi.replacementValue}</a>
                                    {:else}
                                        <a href={`/portfolio/${sale.buyer}`} class="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 hover:underline">{sale.buyer.slice(0,8)}...</a>
                                    {/if}
                                </div>
                                <button on:click={() => copyToClipboard(sale.buyer)} class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                    <i class="fas fa-copy text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {(sale.price/1000000).toLocaleString()} VOI
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>
