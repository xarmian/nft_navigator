<script lang="ts">
	import type { PageData } from './$types';
    import Select from '$lib/component/ui/Select.svelte';
	import type { Collection, Sale } from '$lib/data/types';
    import { goto } from '$app/navigation';
	import DatePeriodSelector from '$lib/component/ui/DatePeriodSelector.svelte';
    import SalesTable from '$lib/component/ui/SalesTable.svelte';
    import { userPreferences, recentSearch } from '../../../stores/collection';
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';

    import { TabItem, Tabs } from 'flowbite-svelte';
    import { Chart, Svg, Axis, Bars } from 'layerchart';
    import { Highlight, RectClipPath, Tooltip, TooltipItem } from 'layerchart';
    // @ts-ignore
    import { scaleBand } from 'd3-scale';
    import { format } from 'date-fns';

    export let data: PageData;
    let selectedCollection: Collection | null;
    $: selectedCollectionId = 0;
    let selectedPeriod = 'D';
    $: collections = data.collections.sort((a, b) => (a.highforgeData?.title ?? String(a.contractId)).localeCompare(b.highforgeData?.title ?? String(b.contractId)) as number)?? [] as Collection[];

    $: chartData = [];

    $: voiVolume = 0;
    $: viaVolume = 0;
    $: totalSales = 0;
    $: newListings = 0;
    let sales: Sale[] = [];

    const unsub = userPreferences.subscribe((value: any) => {
        if (value.analyticsPeriod) selectedPeriod = value.analyticsPeriod;
        if (value.analyticsCollectionId) selectedCollectionId = value.analyticsCollectionId;
    });

    onDestroy(() => {
        unsub();
    });


    let collectionOptions = [ { id: 0, name: 'All Collections' } ];
    $: {
        if (collections) {
            collections.forEach((collection) => {
                collectionOptions.push({ id: collection.contractId, name: collection.highforgeData?.title ?? String(collection.contractId) });
            });
        }

        selectedCollection = collections.find((collection) => collection.contractId === selectedCollectionId) ?? null;

        if (selectedCollection) {
			let recentSearchValue = get(recentSearch) as Collection[];
			recentSearchValue = [selectedCollection, ...recentSearchValue.filter((r) => r.contractId !== selectedCollection?.contractId)].slice(0,5);
			recentSearch.set(recentSearchValue);
        }
    }

    function getPeriod(period: string) {
        let startTime = new Date();
        let endTime = new Date();
        switch(period) {
            case 'D':
                startTime.setDate(startTime.getDate() - 1);
            break;
            case 'W':
                startTime.setDate(startTime.getDate() - 7);
            break;
            case 'M':
                startTime.setMonth(startTime.getMonth() - 1);
            break;
        }
        return { startTime, endTime };        
    }

    function getSalesData(contractId: number | undefined, period: string) {
        let { startTime, endTime } = getPeriod(period);
        let url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/sales?min-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            url += `&collectionId=${contractId}`;
        }
        fetch(url)
        .then((response) => response.json())
        .then((data) => {
            sales = data.sales;

            // calculate voi volume
            voiVolume = sales.reduce((acc, sale) => {
                if (sale.currency === 0) {
                    return acc + sale.price;
                }
                return acc;
            }, 0);

            // calculate via volume
            viaVolume = sales.reduce((acc, sale) => {
                if (sale.currency === 6779767) {
                    return acc + sale.price;
                }
                return acc;
            }, 0);

            // based on period, calculate chart data broken into 60 segments between startTime and endTime
            let segment = (endTime.getTime() - startTime.getTime()) / 60;
            let date: Date = new Date(startTime.getTime());
            let chartDataMap = new Map<string, number>();
            for (let i = 0; i < 60; i++) {
                let nextDate = new Date(date.getTime() + segment);
                let value = sales.reduce((acc, sale) => {
                    if (sale.timestamp * 1000 >= date.getTime() && sale.timestamp * 1000 < nextDate.getTime()) {
                        return acc + sale.price;
                    }
                    return acc;
                }, 0);
                chartDataMap.set(date.toISOString(), value);
                date = nextDate;
            }
            chartData = [];
            chartDataMap.forEach((value, key) => {
                chartData.push({ date: key, value: (value / Math.pow(10,6)) } as never);
            });
            console.log(chartData);

            
            // calculate total sales
            totalSales = data.sales.length;
        });
    }

    function getListingData(contractId: number | undefined, period: string) {
        let { startTime, endTime } = getPeriod(period);
        let url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings?min-time=${Math.floor(startTime.getTime() / 1000)}`;
        if (contractId) {
            url += `&collectionId=${contractId}`;
        }
        fetch(url)
        .then((response) => response.json())
        .then((data) => {
            const listings: any[] = data.listings;
            newListings = listings.length;
        });
    }

    function gotoCollection(contractId: number) {
        selectedCollectionId = contractId;
    }

    function gotoCollectionPage(contractId: number) {
        goto(`/collection/${contractId}`);
    }

    function gotoTokenPage(contractId: string, tokenId: string) {
        goto(`/collection/${contractId}/token/${tokenId}`);
    }

    $: {
        getSalesData(selectedCollection?.contractId, selectedPeriod);
        getListingData(selectedCollection?.contractId, selectedPeriod);
    }
</script>
<div class="flex flex-col m-6 space-y-4">
    <div class="flex flex-row justify-between place-items-center">
        <div class="flex flex-row space-x-4 place-items-center items-stretch">
            <Select bind:value={$userPreferences.analyticsCollectionId} options={collectionOptions} containerClass='w-64'>
            </Select>
            {#if $userPreferences.analyticsCollectionId != 0}
            <button class="bg-blue-500 text-white rounded-lg p-0 px-2" on:click={() => gotoCollectionPage($userPreferences.analyticsCollectionId)}>
                Go to Collection
                <i class="fas fa-arrow-right ml-2"></i>
            </button>
            {/if}
        </div>
        <DatePeriodSelector bind:period={selectedPeriod}></DatePeriodSelector>
    </div>
    <div class="flex flex-row justify-evenly">
        <div class="flex flex-col justify-between p-4 bg-blue-500 text-white shadow-lg rounded-xl space-y-1">
            <div class="text-2xl font-bold">
                <div>{(voiVolume / Math.pow(10,6)).toLocaleString()} VOI</div>
                <div>{(viaVolume / Math.pow(10,6)).toLocaleString()} VIA</div>
            </div>
            <h2 class="text-sm uppercase tracking-wider">Total Volume</h2>
        </div>
        <div class="flex flex-col justify-between p-4 bg-green-500 text-white shadow-lg rounded-xl space-y-1">
            <div class="text-2xl font-bold">{totalSales}</div>
            <h2 class="text-sm uppercase tracking-wider">Total Sales</h2>
        </div>
        <div class="flex flex-col justify-between p-4 bg-red-500 text-white shadow-lg rounded-xl space-y-1">
            <div class="text-2xl font-bold">{newListings}</div>
            <h2 class="text-sm uppercase tracking-wider">New Listings</h2>
        </div>
    </div>
        <Tabs style="underline" defaultClass="flex place-items-end rounded-lg divide-x rtl:divide-x-reverse divide-gray-200 shadow dark:divide-gray-700 justify-center">
            <TabItem open>
                <div slot="title">Chart</div>
                    <div>
                        <div class="h-[300px] p-4 border rounded group w-full bg-gray-100 dark:bg-gray-700 shadow-lg">
                            <Chart
                            data={chartData}
                            x="date"
                            xScale={scaleBand().padding(0.4)}
                            y="value"
                            yDomain={[0, null]}
                            yNice
                            padding={{ left: 16, bottom: 24 }}
                            tooltip={{ mode: "band" }}
                        >
                            <Svg>
                            <Axis placement="left" grid={{ style: "stroke-dasharray: 2" }}
                            format={(v) => v.toLocaleString()}
                            labelProps={{
                                class: "fill-black stroke-white dark:fill-gray-200 dark:stroke-gray-800",
                            }}
                            />
                            <Axis
                            placement="bottom"
                            rule
                            format={(d) => {
                                        return format(new Date(d), 'M/d haaa')
                                    }
                                }
                            labelProps={{
                                rotate: 315,
                                textAnchor: "end",
                                class: "fill-black stroke-white dark:fill-gray-200 dark:stroke-gray-800",
                            }}
                            />
                            <Bars
                                radius={4}
                                strokeWidth={1}
                                class="fill-accent-500 group-hover:fill-gray-300 transition-colors"
                            />
                            <Highlight area>
                                <svelte:fragment slot="area" let:area>
                                <RectClipPath
                                    x={area.x}
                                    y={area.y}
                                    width={area.width}
                                    height={area.height}
                                    spring
                                >
                                    <Bars radius={4} strokeWidth={1} class="fill-accent-500" />
                                </RectClipPath>
                                </svelte:fragment>
                            </Highlight>
                            </Svg>
                            <Tooltip header={(data) => format(new Date(data.date),'MM/dd/yyyy hh:ss a')} let:data>
                            <TooltipItem label="value" value={data.value.toLocaleString()+' VOI/VIA'} />
                            </Tooltip>
                        </Chart>
                    </div>
                    <div class="text-sm p-1">
                        NOTE: This chart combines VOI and VIA at a 1=1 value and does not adjust for current DEX exchange rates.</div>
                    </div>
            </TabItem>
            <TabItem>
                <div slot="title">Sales</div>
                <SalesTable sales={sales} />
            </TabItem>
        </Tabs>
</div>