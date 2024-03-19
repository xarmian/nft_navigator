<script lang="ts">
    import { onMount } from 'svelte';
    import { A } from 'flowbite-svelte';
    import type { Token, Transfer, Sale } from '$lib/data/types';
	import { getNFD } from '$lib/utils/nfd';
	import Modal from './Modal.svelte';
    import Switch from './Switch.svelte';
	import { getCurrency } from '$lib/utils/currency';

    export let token: Token;
    let tokenId = token.tokenId;
    let contractId = token.contractId;
    let transfers: Transfer[] = [];
    let filteredTransfers: Transfer[] = [];
    let paginatedTransfers: Transfer[] = [];
    let nfdMap: any = {};
    let showTxModal = false;
    let selectedTx: Transfer | null = null;
    let showOnlySales = false;
    let searchFrom = '';
    let searchTo = '';

    let zeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

    let currentPage = 1;
    const transactionsPerPage = 10;

    $: {
        filteredTransfers = transfers.filter((t: Transfer) => {
            return (searchFrom.length > 0 ? t.from.toLowerCase().includes(searchFrom.toLowerCase()) : true) &&
                (searchTo.length > 0 ? t.to.toLowerCase().includes(searchTo.toLowerCase()) : true) &&
                (!showOnlySales ? true : t.salePrice);
        });
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

    const getTransfers = async (contractId: string, tokenId: string): Promise<Transfer[]> => {
        if (contractId) {
            const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/transfers/?contractId=${contractId}&tokenId=${tokenId}`;
            try {
                const data = await fetch(url).then((response) => response.json());

                // reverse sort by timestamp
                return data.transfers.map((transfer: any) => {
                    return {
                        transactionId: transfer.transactionId,
                        contractId: transfer.contractId,
                        tokenId: transfer.tokenId,
                        from: transfer.fromAddr,
                        to: transfer.toAddr,
                        round: transfer.round,
                        timestamp: transfer.timestamp,
                    };
                }).sort((a: Transfer, b: Transfer) => b.timestamp - a.timestamp);
            }
            catch(err) {
                console.error(err);
            }
        }
        return [];
    }

    const formatAddr = (addr: string) => {
        return addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-8)}` : addr;
    }

    onMount(async () => {
        transfers = await getTransfers(String(contractId), String(tokenId));

        // fetch market data
        /*const marketUrl = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings?collectionId=${contractId}&tokenId=${tokenId}&active=true`;
        const marketData = await fetch(marketUrl).then((response) => response.json());
        if (marketData.listings && token) {
            token.marketData = marketData.listings;
        }*/

        // fetch sales data
        const salesUrl = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/sales?collectionId=${contractId}&tokenId=${tokenId}`;
        const salesData = await fetch(salesUrl).then((response) => response.json());
        if (salesData.sales) {
            // look for salesData.transactionId that matches transfers.transactionId. if found, set transfers.salePrice to salesData.price
            for (let t of transfers) {
                const sale = salesData.sales.find((s: Sale) => s.transactionId === t.transactionId);
                if (sale) {
                    t.salePrice = sale.price;
                    t.saleCurrency = await getCurrency(sale.currency);
                }
            }
        }

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
    });

</script>
<div class="flex flex-col md:flex-row">
    <div class="w-full overflow-hidden rounded-lg shadow-xs">
        <div class="w-full overflow-x-auto">
            <table class="w-full whitespace-no-wrap">
                <thead>
                    <tr class="text-xs font-semibold tracking-wide text-left text-gray-500 dark:text-gray-100 uppercase border-b bg-gray-50 dark:bg-gray-700">
                        <th class="px-4 py-3 align-top">Date</th>
                        <th class="px-4 py-3 align-top hidden md:block">Transaction ID</th>
                        <th class="px-4 py-3 align-top hidden md:block">Round</th>
                        <th class="px-4 py-3 align-top">
                            <div>From</div>
                            <input type="text" placeholder="Search" class="w-full border border-gray-200 rounded-lg p-1" bind:value={searchFrom} />
                        </th>
                        <th class="px-4 py-3 align-top">
                            <div>To</div>
                            <input type="text" placeholder="Search" class="w-full border border-gray-200 rounded-lg p-1" bind:value={searchTo} />
                        </th>
                        <th class="px-4 py-3 align-top">
                            <div>Sale Price</div>
                            <Switch label="" bind:checked={showOnlySales} title="Toggle only marketplace sales"></Switch> 
                        </th>
                        <th></th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-700 divide-y">
                    {#each paginatedTransfers as transfer (transfer.transactionId)}
                        {#if transfers.length === 0}
                            <tr class="text-gray-700 dark:text-gray-100">
                                <td class="px-4 py-3" colspan="6">No transfers found</td>
                            </tr>
                        {/if}
                        <tr class="text-gray-700 dark:text-gray-100">
                            <td class="px-4 py-3">{new Date(transfer.timestamp * 1000).toLocaleString()}</td>
                            <td class="px-4 py-3 hidden md:block"><A href="https://voi.observer/explorer/transaction/{transfer.transactionId}" target="_blank">{transfer.transactionId.substring(0,15)}...</A></td>
                            <td class="px-4 py-3 hidden md:block"><A href="https://voi.observer/explorer/block/{transfer.round.toString()}" target="_blank">{transfer.round}</A></td>
                            <td class="px-4 py-3">
                                {#if transfer.from == zeroAddress}
                                    <span class="text-center w-full text-sm bg-yellow-200 rounded-lg text-yellow-400 font-bold p-1 pl-2 pr-2">Minted</span>
                                {:else}
                                    <A href='/portfolio/{transfer.from}'>{nfdMap[transfer.from] ? nfdMap[transfer.from] : formatAddr(transfer.from)}</A>
                                {/if}
                            </td>
                            <td class="px-4 py-3"><A href='/portfolio/{transfer.to}'>{nfdMap[transfer.to] ? nfdMap[transfer.to] : formatAddr(transfer.to)}</A></td>
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
            <div class="pagination">
                <button on:click={previousPage} disabled={currentPage === 1}>Previous</button>
                <span>Page {currentPage} of {Math.ceil(filteredTransfers.length / transactionsPerPage)}</span>
                <button on:click={nextPage} disabled={currentPage === Math.ceil(filteredTransfers.length / transactionsPerPage)}>Next</button>
            </div>
        </div>
    </div>
</div>
<!-- transaction details modal -->
<Modal title="Transaction Details" bind:showModal={showTxModal}>
    <div class="text-center">
        {#if selectedTx}
            <div class="text-2xl font-bold mb-2">Transaction ID: <A href="https://voi.observer/explorer/transaction/{selectedTx.transactionId}" target="_blank">{selectedTx.transactionId.substring(0, 6)}...{selectedTx.transactionId.substring(selectedTx.transactionId.length - 6)}</A></div>
            <div class="text-sm">Round: <A href="https://voi.observer/explorer/block/{selectedTx.round.toString()}" target="_blank">{selectedTx.round}</A></div>
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

    .pagination button {
        padding: 10px 20px;
        font-size: 16px;
        color: white;
        background-color: #007BFF;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }

    .pagination button:disabled {
        background-color: #ccc;
        cursor: not-allowed;
    }
</style>