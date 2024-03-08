<script lang="ts">
    import type { Sale } from '$lib/data/types';
    import { onMount } from 'svelte';
    import { copy } from 'svelte-copy';
    import { toast } from '@zerodevx/svelte-toast';
    
    export let collectionId: number;
    let sales: Sale[] = [];

    onMount(async () => {
        const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/sales/?collectionId=${collectionId}&limit=10`;
        try {
            const data = await fetch(url).then((response) => response.json());
            if (data.sales) sales = data.sales;
        }
        catch(err) {
            console.error(err);
        }
    });
    
</script>
<div class="flex flex-wrap justify-center">
    <div class="w-full m-4">
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
                {#each sales as sale}
                    <tr class="dark:border-gray-500">
                        <td class="dark:border-gray-500">{new Date(sale.timestamp*1000).toLocaleString()}</td>
                        <td class="dark:border-gray-500"><a href={'https://voi.observer/explorer/block/'+sale.round+'/transactions'} target="_blank">{sale.round}</a></td>
                        <td class="dark:border-gray-500"><a href={'https://voi.observer/explorer/transaction/'+sale.transactionId} target="_blank">{sale.transactionId.slice(0,12)}...</a></td>
                        <td class="dark:border-gray-500"><a href={`/contract/${sale.collectionId}/token/${sale.tokenId}`}>{sale.tokenId}</a></td>
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
