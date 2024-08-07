<script lang="ts">
	import type { PageData } from './$types';
    import Select from '$lib/component/ui/Select.svelte';
	import type { Collection, Sale } from '$lib/data/types';
    import { goto } from '$app/navigation';
	import DatePeriodSelector from '$lib/component/ui/DatePeriodSelector.svelte';
    import SalesTable from '$lib/component/ui/SalesTable.svelte';
    import SalesChart from '$lib/component/ui/SalesChart.svelte';
    import { userPreferences, recentSearch } from '../../../../stores/collection';
    import { onDestroy, onMount } from 'svelte';
    import { indexerBaseURL } from '$lib/utils/indexer';

    import { TabItem, Tabs } from 'flowbite-svelte';
    import { format } from 'date-fns';
	import CollectionSingle from '$lib/component/ui/CollectionSingle.svelte';

    export let data: PageData;

    let collectionOptions = data.collectionOptions;
    $: collection = data.collection

    $: chartData = [];

    $: voiVolume = null as number | null;
    $: viaVolume = null as number | null;
    $: totalSales = null as number | null;
    $: newListings = null as number | null;
    let sales: Sale[] = [];
    $: startTime = undefined as undefined | Date;
    $: endTime = undefined as undefined | Date;

    const unsub = userPreferences.subscribe((value: any) => {
        if (value.analyticsStart) startTime = value.analyticsStart;
        if (value.analyticsEnd) endTime = value.analyticsEnd;
    });

    onDestroy(unsub);
    
    onMount(async () => {
        startTime = $userPreferences.analyticsStart??new Date(new Date().setDate(new Date().getDate() - 1));
        endTime = $userPreferences.analyticsEnd??new Date();

        //getData(collection?.contractId, startTime, endTime);
    });

    $: {
        /*if (selectedCollection) {
			let recentSearchValue = get(recentSearch) as Collection[];
			recentSearchValue = [selectedCollection, ...recentSearchValue.filter((r) => r.contractId !== selectedCollection?.contractId)].slice(0,5);
			recentSearch.set(recentSearchValue);
        }*/

        if (collection?.contractId !== null && startTime != null && endTime != null) {
            chartData = [];
            voiVolume = null;
            viaVolume = null;
            totalSales = null;
            newListings = null;
            
            getData(collection?.contractId, startTime, endTime);
        }
    }

    async function getData(contractId: number | undefined, startTime: Date, endTime: Date) {
        if (!startTime || !endTime) return;
        let salesURL = `${indexerBaseURL}/mp/sales?min-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            salesURL += `&collectionId=${contractId}`;
        }
        const salesResp = await fetch(salesURL);
        const salesData = await salesResp.json();
        const s: Sale[] = salesData.sales;
        sales = s.reverse();

        // calculate voi volume
        voiVolume = sales.reduce((acc, sale) => {
            if (sale.currency === 0) {
                return acc + sale.price;
            }
            return acc;
        }, 0);

        // calculate via volume
        viaVolume = s.reduce((acc, sale) => {
            if (sale.currency === 6779767) {
                return acc + sale.price;
            }
            return acc;
        }, 0);

        // based on period, calculate chart data broken into 60 segments between startTime and endTime
        let segment = (endTime.getTime() - startTime.getTime()) / 30;
        let date: Date = new Date(startTime.getTime());
        let chartDataMap = new Map<string, { value: number, voi: number, via: number, salesCount: number }>();
        for (let i = 0; i < 30; i++) {
            let nextDate = new Date(date.getTime() + segment);
            let result = s.reduce((acc, sale) => {
                if (sale.timestamp * 1000 >= date.getTime() && sale.timestamp * 1000 < nextDate.getTime()) {
                    return { value: acc.value + sale.price, 
                             voi: acc.voi + (sale.currency == 0 ? sale.price : 0),
                             via: acc.via + (sale.currency == 6779767 ? sale.price : 0),
                             salesCount: acc.salesCount + 1 
                            };
                }
                return acc;
            }, { value: 0, salesCount: 0, voi: 0, via: 0 });
            chartDataMap.set(date.toISOString(), result);
            date = nextDate;
        }
        chartData = [];
        chartDataMap.forEach((result, key) => {
            chartData.push({ date: key, value: (result.value / Math.pow(10,6)), salesCount: result.salesCount, voi: (result.voi / Math.pow(10,6)), via: (result.via / Math.pow(10,6)) } as never);
        });

        // calculate total sales
        totalSales = s.length;

        let listURL = `${indexerBaseURL}/mp/listings?min-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            listURL += `&collectionId=${contractId}`;
        }
        const listResp = await fetch(listURL);
        const listData = await listResp.json();
        const listings: any[] = listData.listings;
        newListings = listings.length;
    }

    function resetSelectedCollection() {
        /*userPreferences.update((value) => {
            value.analyticsCollectionId = 0;
            return value;
        });*/
        //selectedCollectionId = 0;
        goto(`/analytics`);
    }

    function gotoCollectionPage(contractId: number) {
        goto(`/collection/${contractId}`);
    }

    function gotoAnalyticsPage(contractId: number) {
        goto(`/analytics/collections/${contractId}`);
    }
</script>
<div class="flex flex-col m-6 space-y-4">
    <div class="flex flex-col md:flex-row space-y-2 md:space-y-0 justify-between items-center">
        <div class="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 items-center">
            <Select value={collection?.contractId??0} options={collectionOptions} containerClass='w-64' onchange={(v) => gotoAnalyticsPage(Number(v))} />
            {#if collection}
                <div class="flex flex-row space-x-2 items-center">
                    <button class="bg-blue-500 text-white rounded-lg p-2" on:click={resetSelectedCollection}>
                        Reset
                        <i class="fas fa-undo ml-2"></i>
                    </button>
                    <button class="bg-blue-500 text-white rounded-lg p-2" on:click={() => gotoCollectionPage(collection?.contractId??0)}>
                        Go to Collection
                        <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            {/if}
        </div>
        <div class="flex flex-row space-x-4 place-items-center items-stretch">
            {#if startTime && endTime}
                <div class="text-sm text-gray-500 dark:text-gray-400 place-self-center">{format(startTime, 'M/d h:mmaaa')} - {format(endTime, 'M/d h:mmaaa')}</div>
            {/if}
            <DatePeriodSelector bind:startTime={$userPreferences.analyticsStart} bind:endTime={$userPreferences.analyticsEnd}></DatePeriodSelector>
        </div>
    </div>
    <div class="flex flex-col md:flex-row space-y-2 md:space-y-0 place-items-center">
        {#if collection}
            <div class="flex">
                <CollectionSingle collection={collection} viewType='grid' />
            </div>
        {/if}
        <div class="flex flex-row justify-evenly w-full space-x-2 md:space-x-0 text-md md:text-2xl">
            <div class="flex flex-col justify-between p-4 bg-blue-500 text-white shadow-lg rounded-xl space-y-1">
                <div class="font-bold">
                    <div>
                        {voiVolume!==null ? (voiVolume / Math.pow(10,6)).toLocaleString() : '-'} VOI
                    </div>
                    <div>
                        {viaVolume!==null ? (viaVolume / Math.pow(10,6)).toLocaleString() : '-'} VIA
                    </div>
                </div>
                <h2 class="text-sm uppercase tracking-wider">Total Volume</h2>
            </div>
            <div class="flex flex-col justify-between p-4 bg-green-500 text-white shadow-lg rounded-xl space-y-1">
                <div class="font-bold">{totalSales!==null ? totalSales : '-'}</div>
                <h2 class="text-sm uppercase tracking-wider">Total Sales</h2>
            </div>
            <div class="flex flex-col justify-between p-4 bg-red-500 text-white shadow-lg rounded-xl space-y-1">
                <div class="font-bold">{newListings!==null ? newListings : '-'}</div>
                <h2 class="text-sm uppercase tracking-wider">New Listings</h2>
            </div>
        </div>
    </div>
        <Tabs style="underline" defaultClass="flex place-items-end rounded-lg divide-x rtl:divide-x-reverse divide-gray-200 shadow dark:divide-gray-700 justify-center">
            <TabItem open>
                <div slot="title">Chart</div>
                    <SalesChart data={chartData}></SalesChart>
                    <div class="text-sm p-1">
                        NOTE: This chart combines VOI and VIA at a 1=1 value and does not adjust for current DEX exchange rates.
                    </div>
            </TabItem>
            <TabItem>
                <div slot="title">Transactions</div>
                <SalesTable collectionId={collection?.contractId??0} sales={sales} />
            </TabItem>
        </Tabs>
</div>
<slot />