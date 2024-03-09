<script lang="ts">
	import type { PageData } from './$types';
    import { filters, saleSort as sort } from '../../../stores/collection';
    import type { Token } from '$lib/data/types';
    import TokenCard from '$lib/component/ui/TokenCard.svelte';
    import Switch from '$lib/component/ui/Switch.svelte';
    import Select from '$lib/component/ui/Select.svelte';
    import { onMount } from 'svelte';
    import { inview } from 'svelte-inview';
    // @ts-ignore
    import Device from 'svelte-device-info';
    
    export let data: PageData;
    let displayCount = 12;
    let voiGames: object[] = data.voiGames;
    let tokens: Token[] = data.tokens;
    let filterTokens: Token[] = [];
    let textFilter = '';
    let currencyList = [ { id: '0', name: 'VOI' }, { id: '6779767', name: 'VIA' } ];
    let isMobile = false;

    onMount(() => {
        isMobile = Device.isMobile;
    });

    $: {
        filterTokens = tokens.filter((t: Token) => {
            return (textFilter == ''
                || t.metadata?.name?.toLowerCase().includes(textFilter.toLowerCase())
                || t.traits?.some(trait => trait.toLowerCase().includes(textFilter.toLowerCase())))
                && ($filters.currency == '*' || t.marketData?.currency === Number($filters.currency));
        });

        if ($filters.voiGames) {
            filterTokens = filterTokens.filter((t: Token) => voiGames.find((v: any) => v.applicationID === t.contractId));
        }

        // apply sort
        if ($sort.by === 'Randomize') {
            filterTokens = filterTokens.sort(() => Math.random() - 0.5);
        }
        else {
            if ($sort.by === 'Name') {
                filterTokens = filterTokens.sort((a: Token, b: Token) => a.metadata.name.localeCompare(b.metadata.name));
            } else if ($sort.by === 'Price') {
                filterTokens = filterTokens.sort((a: Token, b: Token) => {
                    if (a.marketData?.price && b.marketData?.price) {
                        return a.marketData.price - b.marketData.price;
                    } else if (a.marketData?.price) {
                        return -1;
                    } else if (b.marketData?.price) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
            } else if ($sort.by === 'Rank') {
                filterTokens = filterTokens.sort((a: Token, b: Token) => {
                    if (a.rank && b.rank) {
                        return a.rank - b.rank;
                    } else if (a.rank) {
                        return -1;
                    } else if (b.rank) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
            }
            else if ($sort.by === 'List') {
                filterTokens = filterTokens.sort((a: Token, b: Token) => {
                    if (a.marketData?.createTimestamp && b.marketData?.createTimestamp) {
                        return a.marketData.createTimestamp - b.marketData.createTimestamp;
                    } else if (a.marketData?.createTimestamp) {
                        return -1;
                    } else if (b.marketData?.createTimestamp) {
                        return 1;
                    } else {
                        return 0;
                    }
                });
            }

            if ($sort.direction === 'Descending') {
            filterTokens = filterTokens.reverse();
            }
        }
    }

    function showMore() {
        displayCount += 12;
    }

    let inputElement: HTMLInputElement;
</script>

<div class="flex justify-between {isMobile ? 'flex-col' : 'flex-row'}">
    <div class="flex justify-start flex-wrap {isMobile ? 'text-xs' : 'text-md'}">
        <Select options={[{id: 'Name', name: 'Name'}, {id: 'Price', name: 'Price'}, {id: 'Rank', name: 'Rank'},{id: 'List', name: 'List Date'},{id:'Randomize', name:'Randomize'}]} bind:value={$sort.by} containerClass="m-1"></Select>
        <Select options={[{id: 'Ascending', name: 'Ascending'}, {id: 'Descending', name: 'Descending'}]} bind:value={$sort.direction} containerClass="m-1"></Select>
        <Select options={[{id:"*",name:"Any Token"},...currencyList]} bind:value={$filters.currency} containerClass="m-1"></Select>
    </div>
    <div class="flex {isMobile ? 'm-1 justify-center' : 'm-4 justify-end'}">
        <div class="relative self-start mr-6">
            <input type="text" placeholder="Search" bind:value={textFilter} bind:this={inputElement} class="p-2 border border-gray-300 rounded-lg dark:bg-gray-600 w-full {isMobile ? 'pr-1' : 'pr-8'}"/>
            {#if textFilter}
                <button class="absolute inset-y-0 right-0 pr-3 flex items-center" on:click={() => { textFilter = ''; inputElement.focus(); }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            {/if}
        </div>
        <Switch bind:checked={$filters.voiGames} label="Voi Games"></Switch>
    </div>
</div>
<div class="pb-16">
    <div class="flex flex-wrap justify-center">
        {#each filterTokens.slice(0, displayCount) as token (String(token.contractId) + '_' + String(token.tokenId))}
            <div class="inline-block m-2">
                <TokenCard token={token} includeCollection={true}></TokenCard>
            </div>
        {/each}
    </div>
    {#if tokens.length > displayCount}
        <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
    {/if}
</div>
<style>
    .sentinel {
        height: 1px;
        width: 100%;
    }
</style>