<script lang="ts">
    import { onMount } from 'svelte';
    import type { Sale } from '$lib/data/types';
    import algosdk from 'algosdk';
    import { algodIndexer, algodClient } from '$lib/utils/algod';


    let sales: Sale[] = [];
    let sellers: any[] = [];
    let allsellers: any[] = [];
    let sellerStatus = new Map<string, string>();
    let sellerHealth = new Map<string, boolean>();
    let winner: string | null = null;
    let onlyUnique = false;

    let selectedDate: string | null = null;

    async function handleDateChange(event: Event) {
        // @ts-expect-error - target does exist
        selectedDate = event.target?.value ?? null;

        if (selectedDate != null) {
            // start time -- first minute of selectedDate, format YYYY-MM-DD
            const start = new Date(selectedDate);
            start.setUTCHours(0, 0, 0, 0);

            // end time -- last minute of selectedDate
            const end = new Date(selectedDate);
            end.setUTCHours(23, 59, 59, 999);

            // fetch sales between start and end unix timestamps
            const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/sales/?min-time=${start.getTime() / 1000}&max-time=${end.getTime() / 1000}`;
            const response = fetch(url);
            const data = await response.then((response) => response.json());
            sales = data.sales;

            // get unique sellers
            sellers = Array.from(new Set(sales.map((sale) => sale.seller)));
            
            // get sellers but don't remove duplicates
            allsellers = sales.map((sale) => sale.seller);

            for (const seller of sellers) {
                const accountInfo = await algodClient.accountInformation(seller).do();
                sellerStatus.set(seller, accountInfo.status);
            }

            sellerStatus = sellerStatus;

            const hurl = `https://analytics.testnet.voi.nodly.io/v0/network/nodes/day`;
            const hresponse = fetch(hurl);
            const hdata = await hresponse.then((response) => response.json());

            // hdata.data is an array of arrays, each array is a node's health data. map over each array and get the node's address and health
            hdata.data.map((node: any) => {
                const id = node[0];
                const health = node[2];
                const addresses = node[11];
                const ver = node[13];

                const isHealthy = (health >= 5.0 && ver === "3.22.1");

                // map over each address and add the node's health to the sellerHealth map
                addresses.map((address: any) => {
                    if (sellerHealth.has(address) && isHealthy) {
                        sellerHealth.set(address, true);
                    }
                    else {
                        sellerHealth.set(address, isHealthy);
                    }
                });
            });

            sellerHealth = sellerHealth;
        }
    }

    function pickWinner() {
        // get list of sellers that are both Online and Healthy
        if (onlyUnique) {
            const qualifying = sellers.filter((seller) => sellerStatus.get(seller) === 'Online' && sellerHealth.get(seller) === true);
            winner = qualifying[Math.floor(Math.random() * qualifying.length)];
            console.log(qualifying.length);
        }
        else {
            const qualifying = allsellers.filter((seller) => sellerStatus.get(seller) === 'Online' && sellerHealth.get(seller) === true);
            winner = qualifying[Math.floor(Math.random() * qualifying.length)];
            console.log(qualifying.length);
        }
    }

</script>
<div class="flex flex-col items-center">
    <div class="flex flex-row space-x-10">
        <div class="flex flex-col">
            <h1 class="text-3xl font-bold dark:text-white">Sales</h1>
            <p class="dark:text-white">Select a date to view sales</p>
            <input type="date" on:change={handleDateChange} class="dark:text-black" />
        </div>
        <div class="flex flex-col justify-end">
            <input type="checkbox" bind:checked={onlyUnique} class="" />
            <label for="unique" class="dark:text-white items-end">Only Unique Sellers</label>
        </div>
        <div class="flex flex-row items-end">
            <button on:click={pickWinner} class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded h-10">Pick a Winner</button>
        </div>
    </div>
    {#if sales.length > 0}
    <div class="flex flex-row space-x-10 mt-4">
        <div>
            <h2 class="text-2xl font-bold dark:text-white">Sales</h2>
            <p class="dark:text-white">{sales.length}</p>
        </div>
        <div>
            <h2 class="text-2xl font-bold dark:text-white">Unique Sellers</h2>
            <p class="dark:text-white">{sellers.length}</p>
        </div>
        <div>
            <h2 class="text-2xl font-bold dark:text-white">Qualifying Sales</h2>
            <p class="dark:text-white">{allsellers.filter((seller) => sellerStatus.get(seller) === 'Online' && sellerHealth.get(seller) === true).length}</p>
        </div>
        <div>
            <h2 class="text-2xl font-bold dark:text-white">Qualifying Unique Sellers</h2>
            <p class="dark:text-white">{sellers.filter((seller) => sellerStatus.get(seller) === 'Online' && sellerHealth.get(seller) === true).length}</p>
        </div>
    </div>
    {/if}
    {#if winner}
        <div class="flex flex-col items-center mt-4">
            <h2 class="text-2xl font-bold dark:text-white">Winner</h2>
            <p class="dark:text-white">{winner}</p>
        </div>
    {/if}

    {#if sales.length > 0}
        <div class="flex flex-col items-center text-gray-800 dark:text-gray-100">
            <table class="table-auto border-collapse border border-gray-800 w-full mt-4">
                <thead>
                    <tr>
                        <th class="border border-gray-600 px-4 py-2">Date/Time</th>
                        <th class="border border-gray-600 px-4 py-2">Transaction ID</th>
                        <th class="border border-gray-600 px-4 py-2">Buyer</th>
                        <th class="border border-gray-600 px-4 py-2">Seller</th>
                        <th class="border border-gray-600 px-4 py-2">Amount</th>
                        <th class="border border-gray-600 px-4 py-2">Status</th>
                        <th class="border border-gray-600 px-4 py-2">Healthy?</th>
                    </tr>
                </thead>
                <tbody>
                    {#each sales as sale}
                        <tr>
                            <td class="border border-gray-600 px-4 py-2">{new Date(sale.timestamp*1000).toLocaleString()}</td>
                            <td class="border border-gray-600 px-4 py-2">{sale.transactionId.substring(0,8)}...</td>
                            <td class="border border-gray-600 px-4 py-2">{sale.buyer.substring(0,8)}...</td>
                            <td class="border border-gray-600 px-4 py-2">{sale.seller.substring(0,8)}...</td>
                            <td class="border border-gray-600 px-4 py-2">{sale.price / Math.pow(10,6)}</td>
                            <td class="border border-gray-600 px-4 py-2">{sellerStatus.has(sale.seller) ? (sellerStatus.get(sale.seller)??'') : '-'}</td>
                            <td class="border border-gray-600 px-4 py-2">{sellerHealth.has(sale.seller) ? (sellerHealth.get(sale.seller) ? 'Yes' : 'No') : '-'}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <p class="dark:text-white mt-4">No sales found</p>
    {/if}    
</div>