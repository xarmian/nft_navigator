<script lang="ts">
    import TokenIcon from './TokenIcon.svelte';
    import { onMount } from 'svelte';
    import { A } from 'flowbite-svelte';
    import type { Token, Transfer, Sale } from '$lib/data/types';
	import { getNFD } from '$lib/utils/nfd';
	import Modal from './Modal.svelte';
    import Switch from './Switch.svelte';
    import { getSalesAndTransfers, reformatTokenName, getTokens } from '$lib/utils/indexer';
    import { zeroAddress } from '$lib/data/constants';

    export let token: Token | undefined = undefined;
    export let owner: string | undefined = undefined;

    let transfers: Transfer[] = [];
    let filteredTransfers: Transfer[] = [];
    let paginatedTransfers: Transfer[] = [];
    let nfdMap: any = {};
    let showTxModal = false;
    let selectedTx: Transfer | null = null;
    let showOnlySales = 'all';
    let searchFrom = '';
    let searchTo = '';
    let tokenList: Token[] = [];
    let filterToken: Token | undefined = undefined;
    let tokenSearch = '';

    let currentPage = 1;
    const transactionsPerPage = 10;

    $: filteredTokenList = tokenList.filter(t => 
        (t.metadata?.name ?? `${t.contractId}-${t.tokenId}`).toLowerCase().includes(tokenSearch.toLowerCase())
    );

    $: {
        filteredTransfers = transfers.filter((t: Transfer) => {
            const matchesSearch = (searchFrom.length > 0 ? t.from.toLowerCase().includes(searchFrom.toLowerCase()) : true) &&
                (searchTo.length > 0 ? t.to.toLowerCase().includes(searchTo.toLowerCase()) : true);

            const matchesType = showOnlySales === 'all' ? true :
                showOnlySales === 'purchases' ? t.salePrice && t.to === owner :
                showOnlySales === 'sales' ? t.salePrice && t.from === owner :
                showOnlySales === 'transfer-in' ? !t.salePrice && t.to === owner :
                showOnlySales === 'transfer-out' ? !t.salePrice && t.from === owner :
                true;

            return matchesSearch && matchesType;
        });

        if (filterToken) {
            filteredTransfers = filteredTransfers.filter(t => t.token?.contractId === (filterToken?.contractId ?? '') && t.token?.tokenId === (filterToken?.tokenId ?? ''));
        }

        const start = (currentPage - 1) * transactionsPerPage;
        const end = start + transactionsPerPage;
        paginatedTransfers = filteredTransfers.slice(start, end);
    }

    const nextPage = () => {
        if (currentPage < Math.ceil(filteredTransfers.length / transactionsPerPage)) {
            currentPage++;
        }
    };

    const previousPage = () => {
        if (currentPage > 1) {
            currentPage--;
        }
    };

    const doShowTxModal = (transfer: Transfer) => {
        selectedTx = transfer;
        showTxModal = true;
    }

    const formatAddr = (addr: string) => {
        return addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;
    }

    // if owner changes, reload the data
    $: {
        if (owner || token) {
            loadData();
        }
    }

    function refreshTable() {
        transfers = [];
        filteredTransfers = [];
        paginatedTransfers = [];
        nfdMap = {};
        showTxModal = false;
        selectedTx = null;
        currentPage = 1;
        loadData();
    }

    async function loadData() {
        let tokenId: string | undefined = token?.tokenId ? String(token.tokenId) : undefined;
        let contractId: string | undefined = token?.contractId ? String(token.contractId) : undefined;

        // First get transfers
        transfers = await getSalesAndTransfers({ contractId, tokenId, user: owner, fetch: fetch });

        // Extract unique token identifiers
        const tokenIdentifiers = Array.from(new Set(
            transfers.map(t => `${t.contractId}_${t.tokenId}`)
        ));

        // Get full token details from indexer in one request
        const tokenDetails = await getTokens({
            tokenIds: tokenIdentifiers.join(','),
            fetch
        });

        // Create a map for quick token lookup
        const tokenMap = new Map(
            tokenDetails.map(t => [`${t.contractId}_${t.tokenId}`, t])
        );

        // Update transfers with full token details
        transfers = transfers.map(t => ({
            ...t,
            token: tokenMap.get(`${t.contractId}_${t.tokenId}`) || null
        }));

        // Update token list with full details
        tokenList = Array.from(tokenMap.values())
            .sort((a, b) => (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''));

        // get NFDs
        let addresses = new Set();
        transfers.forEach(t => {
            addresses.add(t.from);
            addresses.add(t.to);
        });

        const nfd = await getNFD(Array.from(addresses) as string[]);

        // create a key/value pair array of n.key to n.replacementValue
        nfdMap = nfd.reduce((acc: any, n: any) => {
            acc[n.key] = n.replacementValue;
            return acc;
        }, {});
    }

</script>
<div class="space-y-6">
    <!-- Filter controls -->
    <div class="flex items-center gap-2 mb-6">
        <div class="relative flex-grow">
            <div class="relative">
                <input
                    type="text"
                    class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                    placeholder="Search tokens..."
                    bind:value={tokenSearch}
                />
                <i class="fas fa-filter absolute left-3 top-2.5 text-gray-400"></i>
                {#if filterToken}
                    <button 
                        class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        on:click={() => { filterToken = undefined; tokenSearch = ''; }}
                        aria-label="Clear filter"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                {/if}
            </div>
            {#if tokenSearch && !filterToken}
                <div class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {#each filteredTokenList as token}
                        <button
                            class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                            on:click={() => { filterToken = token; tokenSearch = token.metadata?.name ?? `${token.contractId}-${token.tokenId}`; }}
                        >
                            <div class="w-8 h-8 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                <TokenIcon token={token} />
                            </div>
                            <span>{token.metadata?.name ?? `${token.contractId}-${token.tokenId}`}</span>
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
        
        <div class="relative">
            <select 
                class="pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 appearance-none"
                bind:value={showOnlySales}
            >
                <option value="all">All Types</option>
                <option value="purchases">Purchases</option>
                <option value="sales">Sales</option>
                <option value="transfer-in">Transfer In</option>
                <option value="transfer-out">Transfer Out</option>
            </select>
            <i class="fas fa-sort absolute left-3 top-2.5 text-gray-400"></i>
            <i class="fas fa-chevron-down absolute right-3 top-2.5 text-gray-400 pointer-events-none"></i>
        </div>

        <button class="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors" on:click={refreshTable}>
            <i class="fas fa-sync-alt mr-2"></i>
            Refresh
        </button>
    </div>

    <!-- Activity List -->
    <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each paginatedTransfers as transfer}
            <div class="py-4 flex items-center">
                <div class="h-16 w-16 rounded-lg overflow-hidden mr-4 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    {#if transfer.token}
                        <TokenIcon token={transfer.token} />
                    {:else}
                        <div class="h-full w-full flex items-center justify-center text-gray-400">
                            <i class="fas fa-image text-2xl"></i>
                        </div>
                    {/if}
                </div>
                
                <div class="flex-grow">
                    <div class="flex flex-col md:flex-row justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                {#if transfer.from === zeroAddress}
                                    <i class="fas fa-magic text-indigo-500"></i>
                                    <span class="font-medium">Minted NFT</span>
                                {:else if transfer.to === zeroAddress}
                                    <i class="fas fa-fire text-red-500"></i>
                                    <span class="font-medium">Burned NFT</span>
                                {:else if transfer.salePrice && transfer.from === owner}
                                    <i class="fas fa-shopping-cart text-green-500"></i>
                                    <span class="font-medium">Sale</span>
                                {:else if transfer.salePrice && transfer.to === owner}
                                    <i class="fas fa-shopping-cart text-red-500"></i>
                                    <span class="font-medium">Purchase</span>
                                {:else}
                                    <i class="fas fa-exchange-alt text-purple-500"></i>
                                    <span class="font-medium">Transfer</span>
                                {/if}
                            </div>
                            <div class="text-sm text-gray-500">
                                <a href={`/collection/${transfer.contractId}`} 
                                    class="font-medium text-gray-700 dark:text-gray-300">
                                    { transfer.token?.metadata?.name ?? 'Unknown Collection'}
                                </a> 
                                {#if !transfer.token?.metadata?.name}
                                    <a href={`/collection/${transfer.contractId}/token/${transfer.tokenId}`} 
                                        class="text-gray-500 dark:text-gray-400">
                                        #{transfer.tokenId}
                                    </a>
                                {/if}
                            </div>
                        </div>
                        
                        <div class="mt-2 md:mt-0 text-right">
                            {#if transfer.salePrice}
                                <div class="font-bold">
                                    {transfer.salePrice / Math.pow(10, transfer.saleCurrency?.decimals ?? 0)} 
                                    {transfer.saleCurrency?.unitName ?? ''}
                                </div>
                            {/if}
                            <div class="text-sm text-gray-500">
                                {new Date(transfer.timestamp * 1000).toLocaleString()}
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                        {#if transfer.from !== zeroAddress}
                            <div>
                                From: <A href={`/portfolio/${transfer.from}`} class="text-blue-500 hover:underline">
                                    {nfdMap[transfer.from] ?? formatAddr(transfer.from)}
                                </A>
                            </div>
                        {/if}
                        {#if transfer.to !== zeroAddress}
                            <div>
                                To: <A href={`/portfolio/${transfer.to}`} class="text-blue-500 hover:underline">
                                    {nfdMap[transfer.to] ?? formatAddr(transfer.to)}
                                </A>
                            </div>
                        {/if}
                        <div>
                            Tx: <a href={`https://explorer.voi.network/explorer/transaction/${transfer.transactionId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  class="text-blue-500 hover:underline">
                                {transfer.transactionId.substring(0, 8)}...{transfer.transactionId.substring(transfer.transactionId.length - 4)}
                            </a>
                        </div>
                    </div>
                </div>
                
                <div class="ml-4">
                    <button on:click={() => doShowTxModal(transfer)} 
                            class="text-blue-500 hover:text-blue-700"
                            aria-label="View Transaction">
                        <i class="fas fa-magnifying-glass"></i>
                    </button>
                </div>
            </div>
        {/each}
    </div>
    
    <!-- Pagination -->
    {#if filteredTransfers.length > transactionsPerPage}
        <div class="mt-6 flex justify-center gap-4">
            <button 
                class="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                on:click={previousPage}
                disabled={currentPage === 1}>
                Previous
            </button>
            <span class="px-4 py-2">
                Page {currentPage} of {Math.ceil(filteredTransfers.length / transactionsPerPage)}
            </span>
            <button 
                class="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
                on:click={nextPage}
                disabled={currentPage >= Math.ceil(filteredTransfers.length / transactionsPerPage)}>
                Next
            </button>
        </div>
    {/if}
</div>

{#if showTxModal && selectedTx}
    <Modal bind:showModal={showTxModal} title="Transaction Details">
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <div class="text-sm text-gray-500">From</div>
                    <div class="font-medium">
                        {#if selectedTx.from === zeroAddress}
                            <span class="text-indigo-500">Minted</span>
                        {:else}
                            {nfdMap[selectedTx.from] ?? formatAddr(selectedTx.from)}
                        {/if}
                    </div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">To</div>
                    <div class="font-medium">
                        {#if selectedTx.to === zeroAddress}
                            <span class="text-red-500">Burned</span>
                        {:else}
                            {nfdMap[selectedTx.to] ?? formatAddr(selectedTx.to)}
                        {/if}
                    </div>
                </div>
            </div>
            
            {#if selectedTx.salePrice}
                <div>
                    <div class="text-sm text-gray-500">Sale Price</div>
                    <div class="font-medium">
                        {selectedTx.salePrice / Math.pow(10, selectedTx.saleCurrency?.decimals ?? 0)} 
                        {selectedTx.saleCurrency?.unitName ?? ''}
                    </div>
                </div>
            {/if}
            
            <div>
                <div class="text-sm text-gray-500">Transaction ID</div>
                <div class="font-medium break-all">
                    <a href={`https://explorer.voi.network/explorer/transaction/${selectedTx.transactionId}`} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="text-blue-500 hover:underline">
                        {selectedTx.transactionId}
                    </a>
                </div>
            </div>
            
            <div>
                <div class="text-sm text-gray-500">Timestamp</div>
                <div class="font-medium">
                    {new Date(selectedTx.timestamp * 1000).toLocaleString()}
                </div>
            </div>
        </div>
    </Modal>
{/if}

<style>
    /* Remove the old pagination styles */
    .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 300ms;
    }

    .hover\:scale-\[1\.01\]:hover {
        transform: scale(1.01);
    }

    .hover\:shadow-xl:hover {
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }
</style>