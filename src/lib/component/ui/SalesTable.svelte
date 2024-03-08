<script lang="ts">
    import type { Sale } from '$lib/data/types';
    import { onMount } from 'svelte';
    import { copy } from 'svelte-copy';
    import { toast } from '@zerodevx/svelte-toast';
    
    export let collectionId: number;
    let sales: Sale[] = [];

    let currentPage = 1;
    let itemsPerPage = 10;

    $: paginatedSales = sales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    $: totalPages = Math.ceil(sales.length / itemsPerPage);

    function nextPage() {
        if (currentPage < totalPages) currentPage++;
    }

    function previousPage() {
        if (currentPage > 1) currentPage--;
    }

    function downloadCSV() {
        const headers = ['Date/Time', 'Block', 'Transaction ID', 'Token', 'Seller', 'Buyer', 'Amount', 'Currency'];
        const rows = sales.map(sale => [
            new Date(sale.timestamp*1000).toLocaleString().replace(',',''),
            sale.round,
            sale.transactionId,
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

    onMount(async () => {
        const estimatedRowHeight = 50; // Replace with your estimated row height
        itemsPerPage = Math.max(10,Math.floor(window.innerHeight / estimatedRowHeight));

        const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/sales/?collectionId=${collectionId}`;
        try {
            const data = await fetch(url).then((response) => response.json());
            if (data.sales) sales = data.sales.reverse();
        }
        catch(err) {
            console.error(err);
        }
    });
    
</script>
<div class="flex flex-wrap justify-center">
    <div class="w-full m-4">
        <div class="flex justify-between items-center mb-4">
            <div class="dark:bg-gray-800 p-4">
                <button on:click={() => (currentPage = 1)} disabled={currentPage === 1} class="px-4 py-2 mr-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40">«</button>
                <button on:click={previousPage} disabled={currentPage === 1} class="px-4 py-2 mr-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40">‹</button>
                <button on:click={nextPage} disabled={currentPage === totalPages} class="px-4 py-2 ml-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40">›</button>
                <button on:click={() => (currentPage = totalPages)} disabled={currentPage === totalPages} class="px-4 py-2 ml-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40">»</button>
                <button on:click={downloadCSV} class="px-4 py-2 ml-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 dark:bg-gray-700 dark:hover:bg-gray-600">Download CSV</button>
            </div>
            <div class="text-lg font-bold">
                Page {currentPage} of {totalPages}
            </div>
        </div>
        <table class="w-full border-collapse">
            <thead>
                <tr class="bg-gray-200 dark:bg-gray-700 rounded-lg">
                    <th class="text-left">Date/Time</th>
                    <th class="text-left">Block</th>
                    <th class="text-left">Transaction ID</th>
                    <th class="text-left">Token</th>
                    <th class="text-left">Seller</th>
                    <th class="text-left">Buyer</th>
                    <th class="text-left">Amount</th>
                </tr>
            </thead>
            <tbody>
                {#each paginatedSales as sale}
                    <tr class="dark:border-gray-500">
                        <td class="dark:border-gray-500">{new Date(sale.timestamp*1000).toLocaleString()}</td>
                        <td class="dark:border-gray-500"><a href={'https://voi.observer/explorer/block/'+sale.round+'/transactions'} target="_blank">{sale.round}</a></td>
                        <td class="dark:border-gray-500"><a href={'https://voi.observer/explorer/transaction/'+sale.transactionId} target="_blank">{sale.transactionId.slice(0,12)}...</a></td>
                        <td class="dark:border-gray-500"><a href={`/collection/${sale.collectionId}/token/${sale.tokenId}`}>{sale.tokenId}</a></td>
                        <td class="dark:border-gray-500">
                            {sale.seller.slice(0,8)}...{sale.seller.slice(-8)}
                            <i use:copy={sale.seller} class="fas fa-copy pointer" on:svelte-copy={() => toast.push(`Wallet Copied to Clipboard:<br/> ${sale.seller.substring(0,20)}...`)}></i>
                        </td>
                        <td class="dark:border-gray-500">
                            {sale.buyer.slice(0,8)}...{sale.buyer.slice(-8)}
                            <i use:copy={sale.buyer} class="fas fa-copy pointer" on:svelte-copy={() => toast.push(`Wallet Copied to Clipboard:<br/> ${sale.buyer.substring(0,20)}...`)}></i>
                        </td>
                        <td class="dark:border-gray-500">{(sale.price/1000000).toLocaleString()} {sale.currency == 0 ? 'VOI' : 'VIA'}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>
