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
<div class="flex flex-col md:flex-row shadow-2xl rounded-xl bg-opacity-0 bg-black dark:bg-white dark:bg-opacity-10 my-2">
    <div class="w-full overflow-hidden rounded-lg shadow-xs">
        <div class="w-full overflow-x-auto">
            <!-- Filter controls -->
            <div class="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:hidden">
                <div class={tokenList.length > 0 ? 'hidden' : ''}>
                    <label for="token-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Token</label>
                    <select id="token-filter" class="mt-1 block w-full border border-gray-200 rounded-lg p-2 dark:text-black" bind:value={filterToken}>
                        <option value=''>All</option>
                        {#each tokenList as token (token)}
                            <option value={token}>{token.metadata ? token.metadata.name : token.contractId + '-' + token.tokenId}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label for="from-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
                    <input id="from-filter" type="text" placeholder="Search" class="mt-1 block w-full border border-gray-200 rounded-lg p-2 dark:text-black" bind:value={searchFrom} />
                </div>
                <div>
                    <label for="to-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
                    <input id="to-filter" type="text" placeholder="Search" class="mt-1 block w-full border border-gray-200 rounded-lg p-2 dark:text-black" bind:value={searchTo} />
                </div>
                <div>
                    <label for="sales-filter" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Only Sales</label>
                    <Switch label="" bind:checked={showOnlySales} title="Toggle only marketplace sales"></Switch>
                </div>
                <div>
                    <button class="mt-6 w-full cursor-pointer p-2 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200" on:click={refreshTable}>
                        <i class="fas fa-sync-alt" aria-details="Refresh"></i>
                        <span class="ml-2">Refresh</span>
                    </button>
                </div>
            </div>

            <!-- Mobile view -->
            <div class="md:hidden">
                {#each paginatedTransfers as transfer (transfer.transactionId)}
                    <div class="bg-white dark:bg-gray-700 p-4 mb-4 rounded-lg shadow">
                        <div class="flex justify-between items-center mb-2">
                            <div class="text-sm text-gray-500 dark:text-gray-300">{new Date(transfer.timestamp * 1000).toLocaleString()}</div>
                            <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200" on:click={() => doShowTxModal(transfer)}>
                                <i class="fas fa-info-circle" aria-details="Info"></i>
                                <span class="ml-1">Details</span>
                            </button>
                        </div>
                        <div class="flex items-center mb-2">
                            {#if transfer.token}
                                <TokenIcon token={transfer.token}></TokenIcon>
                                <div class="ml-2 text-sm">{transfer.token.metadata?.name??''}</div>
                            {:else}
                                <div>{transfer.tokenId}</div>
                            {/if}
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span class="font-semibold">From:</span> 
                                {#if transfer.from == zeroAddress}
                                    <span class="inline-block text-center text-xs bg-yellow-200 rounded-lg text-yellow-700 font-bold p-1">Minted</span>
                                {:else}
                                    <A href='/portfolio/{transfer.from}'>{nfdMap[transfer.from] ? nfdMap[transfer.from] : formatAddr(transfer.from)}</A>
                                {/if}
                            </div>
                            <div>
                                <span class="font-semibold">To:</span> 
                                {#if transfer.to == zeroAddress}
                                    <span class="inline-block text-center text-xs bg-yellow-200 rounded-lg text-yellow-700 font-bold p-1">Burned</span>
                                {:else}
                                    <A href='/portfolio/{transfer.to}'>{nfdMap[transfer.to] ? nfdMap[transfer.to] : formatAddr(transfer.to)}</A>
                                {/if}
                            </div>
                        </div>
                        <div class="mt-2 text-sm">
                            <span class="font-semibold">Sale Price:</span> 
                            {#if transfer.salePrice}
                                {transfer.salePrice / Math.pow(10,transfer.saleCurrency?.decimals??0)} {transfer.saleCurrency?.unitName??''}
                                <span role="img" aria-label="Celebration">🎉</span>
                            {:else}
                                -
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Desktop view -->
            <table class="w-full whitespace-no-wrap hidden md:table">
                <thead>
                    <tr class="text-xs font-semibold tracking-wide text-left text-gray-500 dark:text-gray-100 uppercase border-b bg-gray-50 dark:bg-gray-700">
                        <th class="px-4 py-3 align-top">Date</th>
                        <th class="px-4 py-3 align-top">
                            <div>Token</div>
                            <select class="w-full border border-gray-200 rounded-lg p-1 dark:text-black" bind:value={filterToken}>
                                <option value=''>All</option>
                                {#each tokenList as token (token)}
                                    <option value={token}>{token.metadata ? token.metadata.name : token.contractId + '-' + token.tokenId}</option>
                                {/each}
                            </select>
                        </th>
                        <th class="px-4 py-3 align-top">
                            <div>From</div>
                            <input type="text" placeholder="Search" class="w-full border border-gray-200 rounded-lg p-1 dark:text-black" bind:value={searchFrom} />
                        </th>
                        <th class="px-4 py-3 align-top">
                            <div>To</div>
                            <input type="text" placeholder="Search" class="w-full border border-gray-200 rounded-lg p-1 dark:text-black" bind:value={searchTo} />
                        </th>
                        <th class="px-4 py-3 align-top">
                            <div>Sale Price</div>
                            <Switch label="" bind:checked={showOnlySales} title="Toggle only marketplace sales"></Switch> 
                        </th>
                        <th>
                            <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-14" on:click={refreshTable}>
                                <i class="fas fa-sync-alt" aria-details="Refresh"></i>
                                <div class="text-xs">Refresh</div>
                            </button>
                        </th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-700 divide-y text-left">
                    {#each paginatedTransfers as transfer (transfer.transactionId)}
                        {#if transfers.length === 0}
                            <tr class="text-gray-700 dark:text-gray-100">
                                <td class="px-4 py-3" colspan="6">No transfers found</td>
                            </tr>
                        {/if}
                        <tr class="text-gray-700 dark:text-gray-100">
                            <td class="px-4 py-3">{new Date(transfer.timestamp * 1000).toLocaleString()}</td>
                            <td class="px-4 py-3">
                                {#if transfer.token}
                                    <TokenIcon token={transfer.token}></TokenIcon>
                                    <div class="text-xs">{transfer.token.metadata?.name??''}</div>
                                {:else}
                                    {transfer.tokenId}
                                {/if}
                            </td>
                            <td class="px-4 py-3">
                                {#if transfer.from == zeroAddress}
                                    <span class="text-center w-full text-sm bg-yellow-200 rounded-lg text-yellow-700 font-bold p-1 pl-2 pr-2">Minted</span>
                                {:else}
                                    <A href='/portfolio/{transfer.from}'>{nfdMap[transfer.from] ? nfdMap[transfer.from] : formatAddr(transfer.from)}</A>
                                {/if}
                            </td>
                            <td class="px-4 py-3">
                                {#if transfer.to == zeroAddress}
                                    <span class="text-center w-full text-sm bg-yellow-200 rounded-lg text-yellow-700 font-bold p-1 pl-2 pr-2">Burned</span>
                                {:else}
                                    <A href='/portfolio/{transfer.to}'>{nfdMap[transfer.to] ? nfdMap[transfer.to] : formatAddr(transfer.to)}</A>
                                {/if}
                            </td>
                            <td class="px-4 py-3">
                                {#if transfer.salePrice}
                                    {transfer.salePrice / Math.pow(10,transfer.saleCurrency?.decimals??0)} {transfer.saleCurrency?.unitName??''}
                                    <span role="img" aria-label="Celebration">🎉</span>
                                {:else}
                                    -
                                {/if}
                            </td>
                            <td class="px-4 py-3">
                                <button class="cursor-pointer p-1 bg-blue-400 hover:bg-blue-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 w-14" on:click={() => doShowTxModal(transfer)}>
                                    <i class="fas fa-info-circle" aria-details="Info"></i>
                                    <div class="text-xs">Details</div>
                                </button>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>

            <!-- Pagination -->
            <div class="pagination">
                <button on:click={previousPage} disabled={currentPage === 1} class="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300">Previous</button>
                <span class="px-4 py-2">Page {currentPage} of {Math.ceil(filteredTransfers.length / transactionsPerPage)}</span>
                <button on:click={nextPage} disabled={currentPage === Math.ceil(filteredTransfers.length / transactionsPerPage)} class="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300">Next</button>
            </div>
        </div>
    </div>
</div>
<!-- transaction details modal -->
<Modal title="Transaction Details" bind:showModal={showTxModal}>
    <div class="text-center">
        {#if selectedTx}
            <div class="text-2xl font-bold mb-2">Transaction ID: <A href="https://explorer.voi.network/explorer/transaction/{selectedTx.transactionId}" target="_blank">{selectedTx.transactionId.substring(0, 6)}...{selectedTx.transactionId.substring(selectedTx.transactionId.length - 6)}</A></div>
            <div class="text-sm">Round: <A href="https://explorer.voi.network/explorer/block/{selectedTx.round.toString()}" target="_blank">{selectedTx.round}</A></div>
            <div class="text-sm">Date: {new Date(selectedTx.timestamp * 1000).toLocaleString()}</div>
            <div class="text-sm">From: <A href='/portfolio/{selectedTx.from}'>{nfdMap[selectedTx.from] ? nfdMap[selectedTx.from] : formatAddr(selectedTx.from)}</A></div>
            <div class="text-sm">To: <A href='/portfolio/{selectedTx.to}'>{nfdMap[selectedTx.to] ? nfdMap[selectedTx.to] : formatAddr(selectedTx.to)}</A></div>
            <div class="text-sm">
                {#if selectedTx.salePrice}
                    Sale Price: {selectedTx.salePrice / Math.pow(10,selectedTx.saleCurrency?.decimals??0)} {selectedTx.saleCurrency?.unitName??''}
                {:else}
                    Sale Price: -
                {/if}
            </div>
        {/if}
    </div>
</Modal>

<style>
    .pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
    }

</style>