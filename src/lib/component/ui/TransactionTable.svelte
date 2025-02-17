<script lang="ts">
  import TokenIcon from './TokenIcon.svelte';

    import { onMount } from 'svelte';
    import { A } from 'flowbite-svelte';
    import type { Token, Transfer, Sale } from '$lib/data/types';
	import { getNFD } from '$lib/utils/nfd';
	import Modal from './Modal.svelte';
    import Switch from './Switch.svelte';
    import { getSalesAndTransfers } from '$lib/utils/indexer';
    import { zeroAddress } from '$lib/data/constants';

    export let token: Token | undefined = undefined;
    export let owner: string | undefined = undefined;

    let transfers: Transfer[] = [];
    let filteredTransfers: Transfer[] = [];
    let paginatedTransfers: Transfer[] = [];
    let nfdMap: any = {};
    let showTxModal = false;
    let selectedTx: Transfer | null = null;
    let showOnlySales = false;
    let searchFrom = '';
    let searchTo = '';
    let tokenList: Token[] = [];
    let filterToken: Token | undefined = undefined;

    let currentPage = 1;
    const transactionsPerPage = 10;

    $: {
        filteredTransfers = transfers.filter((t: Transfer) => {
            return (searchFrom.length > 0 ? t.from.toLowerCase().includes(searchFrom.toLowerCase()) : true) &&
                (searchTo.length > 0 ? t.to.toLowerCase().includes(searchTo.toLowerCase()) : true) &&
                (!showOnlySales ? true : t.salePrice);
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

    onMount(() => {
        loadData();
    });

    // if owner changes, reload the data
    $: {
        if (owner) {
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

        transfers = await getSalesAndTransfers({ contractId, tokenId, user: owner, fetch: fetch });

        tokenList = Array.from(new Set(transfers
            .map(t => t.token)
            .filter((t: Token | null | undefined): t is Token => t !== null && t !== undefined)));
        tokenList = tokenList.filter((t, i) => i === tokenList.findIndex(tt => tt.contractId === t.contractId && tt.tokenId === t.tokenId)).sort((a, b) => (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? ''));

        // get NFDs
        let addresses = new Set();
        transfers.forEach(t => {
            addresses.add(t.from);
            addresses.add(t.to);
        });

        const nfd = await getNFD(Array.from(addresses) as string[], fetch);

        // create a key/value pair array of n.key to n.replacementValue
        nfdMap = nfd.reduce((acc: any, n: any) => {
            acc[n.key] = n.replacementValue;
            return acc;
        }, {}); 
    }

</script>
<div class="space-y-6">
    <!-- Filter controls -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:hidden">
        <div class={tokenList.length > 0 ? 'hidden' : ''}>
            <label for="token-filter" class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Token</label>
            <select id="token-filter" class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 dark:text-white" bind:value={filterToken}>
                <option value=''>All</option>
                {#each tokenList as token (token)}
                    <option value={token}>{token.metadata ? token.metadata.name : token.contractId + '-' + token.tokenId}</option>
                {/each}
            </select>
        </div>
        <div>
            <label for="from-filter" class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">From</label>
            <input id="from-filter" type="text" placeholder="Search address" class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 dark:text-white" bind:value={searchFrom} />
        </div>
        <div>
            <label for="to-filter" class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">To</label>
            <input id="to-filter" type="text" placeholder="Search address" class="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 dark:text-white" bind:value={searchTo} />
        </div>
        <div>
            <label for="sales-filter" class="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Only Sales</label>
            <Switch label="" bind:checked={showOnlySales} title="Toggle only marketplace sales"></Switch>
        </div>
        <div>
            <button class="w-full mt-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2" on:click={refreshTable}>
                <i class="fas fa-sync-alt" aria-details="Refresh"></i>
                <span>Refresh</span>
            </button>
        </div>
    </div>

    <!-- Mobile view -->
    <div class="md:hidden space-y-4">
        {#each paginatedTransfers as transfer (transfer.transactionId)}
            <div class="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.01] border border-gray-100 dark:border-gray-700">
                <div class="flex justify-between items-center mb-4">
                    <div class="text-sm text-gray-500 dark:text-gray-400">{new Date(transfer.timestamp * 1000).toLocaleString()}</div>
                    <button class="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center gap-2" on:click={() => doShowTxModal(transfer)}>
                        <i class="fas fa-info-circle"></i>
                        <span>Details</span>
                    </button>
                </div>
                <div class="flex items-center mb-4">
                    {#if transfer.token}
                        <TokenIcon token={transfer.token}></TokenIcon>
                        <div class="ml-3 text-gray-900 dark:text-white font-medium">{transfer.token.metadata?.name??''}</div>
                    {:else}
                        <div class="text-gray-900 dark:text-white">{transfer.tokenId}</div>
                    {/if}
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <span class="text-sm text-gray-500 dark:text-gray-400">From</span><br>
                        {#if transfer.from == zeroAddress}
                            <span class="inline-block text-xs px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-lg font-medium">Minted</span>
                        {:else}
                            <A href='/portfolio/{transfer.from}' class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{nfdMap[transfer.from] ? nfdMap[transfer.from] : formatAddr(transfer.from)}</A>
                        {/if}
                    </div>
                    <div>
                        <span class="text-sm text-gray-500 dark:text-gray-400">To</span><br>
                        {#if transfer.to == zeroAddress}
                            <span class="inline-block text-xs px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-lg font-medium">Burned</span>
                        {:else}
                            <A href='/portfolio/{transfer.to}' class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{nfdMap[transfer.to] ? nfdMap[transfer.to] : formatAddr(transfer.to)}</A>
                        {/if}
                    </div>
                </div>
                {#if transfer.salePrice}
                    <div class="mt-4 p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-between">
                        <span class="text-sm text-gray-600 dark:text-gray-300">Sales Only</span>
                        <span class="font-medium text-purple-600 dark:text-purple-400">
                            {transfer.salePrice / Math.pow(10,transfer.saleCurrency?.decimals??0)} {transfer.saleCurrency?.unitName??''}
                            <span role="img" aria-label="Celebration" class="ml-1">🎉</span>
                        </span>
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Desktop view -->
    <div class="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <table class="w-full">
            <thead>
                <tr class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <th class="px-6 py-4">
                        <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Date</span>
                    </th>
                    <th class="px-6 py-4">
                        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Token</span>
                        <select class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 dark:text-white text-sm" bind:value={filterToken}>
                            <option value=''>All</option>
                            {#each tokenList as token (token)}
                                <option value={token}>{token.metadata ? token.metadata.name : token.contractId + '-' + token.tokenId}</option>
                            {/each}
                        </select>
                    </th>
                    <th class="px-6 py-4">
                        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">From</span>
                        <input type="text" placeholder="Search" class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 dark:text-white text-sm" bind:value={searchFrom} />
                    </th>
                    <th class="px-6 py-4">
                        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">To</span>
                        <input type="text" placeholder="Search" class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 dark:text-white text-sm" bind:value={searchTo} />
                    </th>
                    <th class="px-6 py-4">
                        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 block mb-2">Sale Price</span>
                        <Switch label="" bind:checked={showOnlySales} title="Toggle only marketplace sales"></Switch>
                    </th>
                    <th class="px-6 py-4">
                        <button class="w-full mt-6 px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2" on:click={refreshTable}>
                            <i class="fas fa-sync-alt"></i>
                            <span>Refresh</span>
                        </button>
                    </th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each paginatedTransfers as transfer (transfer.transactionId)}
                    <tr class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                        <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{new Date(transfer.timestamp * 1000).toLocaleString()}</td>
                        <td class="px-6 py-4">
                            {#if transfer.token}
                                <div class="flex items-center gap-3">
                                    <TokenIcon token={transfer.token}></TokenIcon>
                                    <span class="text-sm text-gray-900 dark:text-white">{transfer.token.metadata?.name??''}</span>
                                </div>
                            {:else}
                                <span class="text-sm text-gray-900 dark:text-white">{transfer.tokenId}</span>
                            {/if}
                        </td>
                        <td class="px-6 py-4">
                            {#if transfer.from == zeroAddress}
                                <span class="inline-block text-xs px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-lg font-medium">Minted</span>
                            {:else}
                                <A href='/portfolio/{transfer.from}' class="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700">{nfdMap[transfer.from] ? nfdMap[transfer.from] : formatAddr(transfer.from)}</A>
                            {/if}
                        </td>
                        <td class="px-6 py-4">
                            {#if transfer.to == zeroAddress}
                                <span class="inline-block text-xs px-3 py-1 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white rounded-lg font-medium">Burned</span>
                            {:else}
                                <A href='/portfolio/{transfer.to}' class="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700">{nfdMap[transfer.to] ? nfdMap[transfer.to] : formatAddr(transfer.to)}</A>
                            {/if}
                        </td>
                        <td class="px-6 py-4">
                            {#if transfer.salePrice}
                                <div class="flex items-center gap-2">
                                    <span class="text-sm font-medium text-purple-600 dark:text-purple-400">
                                        {transfer.salePrice / Math.pow(10,transfer.saleCurrency?.decimals??0)} {transfer.saleCurrency?.unitName??''}
                                    </span>
                                    <span role="img" aria-label="Celebration">🎉</span>
                                </div>
                            {:else}
                                <span class="text-sm text-gray-500 dark:text-gray-400">-</span>
                            {/if}
                        </td>
                        <td class="px-6 py-4">
                            <button class="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 w-full" on:click={() => doShowTxModal(transfer)}>
                                <i class="fas fa-info-circle"></i>
                                <span>Details</span>
                            </button>
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
        <button 
            on:click={previousPage} 
            disabled={currentPage === 1} 
            class="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <i class="fas fa-chevron-left"></i>
            <span>Previous</span>
        </button>
        <span class="text-sm text-gray-600 dark:text-gray-300">Page {currentPage} of {Math.ceil(filteredTransfers.length / transactionsPerPage)}</span>
        <button 
            on:click={nextPage} 
            disabled={currentPage === Math.ceil(filteredTransfers.length / transactionsPerPage)} 
            class="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <span>Next</span>
            <i class="fas fa-chevron-right"></i>
        </button>
    </div>
</div>

<!-- Transaction details modal -->
<Modal title="Transaction Details" bind:showModal={showTxModal}>
    {#if selectedTx}
        <div class="p-6 space-y-6">
            <div class="text-center space-y-2">
                <h3 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Transaction Details</h3>
                <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Transaction ID</div>
                    <A href="https://explorer.voi.network/explorer/transaction/{selectedTx.transactionId}" target="_blank" 
                       class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">
                        {selectedTx.transactionId.substring(0, 6)}...{selectedTx.transactionId.substring(selectedTx.transactionId.length - 6)}
                    </A>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Round</div>
                        <A href="https://explorer.voi.network/explorer/block/{selectedTx.round.toString()}" target="_blank" 
                           class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">{selectedTx.round}</A>
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Date</div>
                        <div class="text-gray-900 dark:text-white font-medium">{new Date(selectedTx.timestamp * 1000).toLocaleString()}</div>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">From</div>
                        <A href='/portfolio/{selectedTx.from}' class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">
                            {nfdMap[selectedTx.from] ? nfdMap[selectedTx.from] : formatAddr(selectedTx.from)}
                        </A>
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">To</div>
                        <A href='/portfolio/{selectedTx.to}' class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">
                            {nfdMap[selectedTx.to] ? nfdMap[selectedTx.to] : formatAddr(selectedTx.to)}
                        </A>
                    </div>
                </div>

                {#if selectedTx.salePrice}
                    <div class="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Sale Price</div>
                        <div class="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {selectedTx.salePrice / Math.pow(10,selectedTx.saleCurrency?.decimals??0)} {selectedTx.saleCurrency?.unitName??''}
                            <span role="img" aria-label="Celebration" class="ml-2">🎉</span>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</Modal>

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