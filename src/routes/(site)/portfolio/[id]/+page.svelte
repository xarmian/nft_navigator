<script lang="ts">
    import { inview } from 'svelte-inview';
	import type { PageData } from './$types';
    import type { Token } from '$lib/data/types';
    import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
	import { A } from 'flowbite-svelte';
    import { Tabs, TabItem, Indicator } from 'flowbite-svelte';
    import { onMount, onDestroy } from 'svelte';
    import { selectedWallet } from 'avm-wallet-svelte';
	import { goto } from '$app/navigation';
    import { toast } from '@zerodevx/svelte-toast';
    import { copy } from 'svelte-copy';
    // @ts-ignore
    import Device from 'svelte-device-info';
    import { getWalletBalance, getCurrency } from '$lib/utils/currency';
	import TransactionTable from '$lib/component/ui/TransactionTable.svelte';
	import QuestsTable from '$lib/component/ui/QuestsTable.svelte';
    import { getImageUrl } from '$lib/utils/functions';
	// import Select from '$lib/component/ui/Select.svelte';

    export let data: PageData;
    $: walletId = data.props.walletId;
    $: walletIds = walletId.split(',');
    $: walletNFD = data.props.walletNFD;
    $: walletAvatar = data.props.walletAvatar;
    $: tokens = data.props.tokens;
    $: approvals = data.props.approvals;
    let collections = data.props.collections;
    let isMobile: boolean | null = null;
    let headerTokens: Token[] = [];
    let portfolioSort = 'mint';
    let displayCount = 10;

    $: {
        if (tokens) {
            headerTokens = tokens.slice();
            headerTokens = headerTokens.sort(() => Math.random() - 0.5).slice(0, 1);

            // sort tokens based on portfolioSort
            /*if (portfolioSort == 'name') {
                tokens = tokens.sort((a, b) => a.metadata?.name.localeCompare(b.metadata?.name));
            } else if (portfolioSort == 'mint') {
                tokens = tokens.sort((a, b) => a.mintRound - b.mintRound);
            }*/
        }
    }
    
    let voiBalance: number;
    let viaBalance: number;

    onMount(async () => {
        isMobile = Device.isMobile;
    });

    $: {
        getWalletBalance(walletIds[0],0).then((balance) => {
            voiBalance = balance;
        });
        getWalletBalance(walletIds[0],6779767).then((balance) => {
            viaBalance = balance;
        });
    }

    const unsub = selectedWallet.subscribe((value) => {
        if (walletIds && walletIds.length > 0 && value?.address && walletIds[0] != value.address) {
            goto('/portfolio/' + value.address);
        }
    });

    onDestroy(() => {
        unsub();
    });

    $: formattedWallet = (walletIds) ? (walletIds[0].length > 8
        ? `${walletIds[0].slice(0, (isMobile ? 4 : 6))}...${walletIds[0].slice((isMobile ? -4 : -6))}`
        : walletIds[0]) : '';

    let sortOptions = [
        { id: 'mint', name: 'Mint Date' },
        { id: 'name', name: 'Name/Collection' },
        //{ id: 'acquired', name: 'Acquired Date' }
    ];

    function showMore() {
        displayCount += 10;
    }
</script>
<div class="text-center">
    <div class="relative w-full h-52 overflow-visible">
        <div class="flex h-full w-full absolute blur-xsm -z-10 opacity-60">
            {#each headerTokens as token (token)}
                <div class="flex-grow bg-cover bg-center inline-block" style="background-image: url({getImageUrl(token.metadata.image,240)});">&nbsp;</div>
            {/each}
        </div>
        <div class="flex justify-center items-center w-full mx-2 absolute top-16">
            <div class="flex flex-col p-4 md:p-8 mt-2 mb-2 bg-slate-100 dark:bg-slate-700 shadow-2xl rounded-2xl opacity-90 space-y-4">
                <div class="flex flex-row space-x-4">
                    {#if walletAvatar}
                        <img src={walletAvatar} class="h-24 w-24 rounded-full place-self-center mb-2" />
                    {/if}
                    <div class="flex flex-col">
                        <div class="flex flex-row space-x-2 text-2xl font-bold mb-0">
                            <div class="text-blue dark:text-blue-100">
                            {walletNFD??formattedWallet}
                            {#if !walletNFD}
                                <i use:copy={walletIds[0]} class="fas fa-copy pointer" on:svelte-copy={() => toast.push(`Wallet Copied to Clipboard:<br/> ${walletIds[0].substring(0,20)}...`)}></i>
                            {/if}
                            </div>
                        </div>
                        {#if walletNFD}
                            <div class="text-sm font-bold mb-4 text-left">
                                {formattedWallet}
                                <i use:copy={walletIds[0]} class="fas fa-copy pointer" on:svelte-copy={() => toast.push(`Wallet Copied to Clipboard:<br/> ${walletIds[0].substring(0,20)}...`)}></i>
                            </div>
                        {/if}
                    </div>
                </div>
                <div class="flex flex-row justify-between space-x-8">
                    <div class="flex flex-col">
                        {#if voiBalance != undefined}
                            <div class="flex flex-row w-full space-x-2 items-stretch">
                                <div class="text-lg font-bold text-green-500 dark:text-green-300">{(voiBalance / Math.pow(10,6)).toLocaleString()}</div>
                                <div class="text-md font-bold text-gray-500 dark:text-gray-300 mb-2">VOI</div>
                            </div>
                        {/if}
                        {#if viaBalance != undefined}
                            <div class="flex flex-row w-full space-x-2 items-stretch">
                                <div class="text-lg font-bold text-green-500 dark:text-green-300">{(viaBalance / Math.pow(10,6)).toLocaleString()}</div>
                                <div class="text-md font-bold text-gray-500 dark:text-gray-300 mb-2">VIA</div>
                            </div>
                        {/if}
                    </div>
                    <div class="flex flex-col">
                        <div class="text-sm font-bold mb-4 text-left">
                            <a href="https://voi.observer/explorer/account/{walletIds[0]}" target="_blank" class="text-blue-500 hover:text-blue-700 underline">
                                Voi Observer
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                        <div class="text-sm font-bold mb-4 text-left">
                            <a href="https://shellyssandbox.xyz/#/account/{walletIds[0]}" target="_blank" class="text-blue-500 hover:text-blue-700 underline">
                                ARC-200 Balances
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="h-32"></div>
    <Tabs style="underline" defaultClass="flex place-items-end rounded-lg divide-x rtl:divide-x-reverse divide-gray-200 shadow dark:divide-gray-700 justify-center">
        <TabItem open>
            <div slot="title">
                <div class="inline">Portfolio</div>
                <Indicator color="blue" size="xl" class="text-xs font-bold text-white">{tokens.length}</Indicator>
            </div>
            <div class="flex flex-col">
                <!--<div class="flex justify-end">
                    <Select bind:value={portfolioSort} options={sortOptions}></Select>
                </div>-->
                <div class="flex flex-row flex-wrap justify-center">
                    {#each tokens.slice(0, displayCount) as token, i}
                        {#if token.owner === walletId}
                            <div class="m-4">
                                <TokenDetail collection={collections.find(c => c.contractId === token.contractId)} bind:token={token} showOwnerIcon={false}></TokenDetail>
                            </div>
                        {/if}
                    {/each}
                    {#if tokens.length == 0}
                        <div class="text-2xl font-bold">No tokens found! Want to get some? <A href="https://nautilus.sh/" target="_blank">Check out the ARC-72 Marketplace</A></div>
                    {/if}
                </div>
                {#if tokens.length > displayCount}
                    <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
                {/if}
            </div>
        </TabItem>
        <TabItem>
            <div slot="title">
                <div class="inline">Approvals</div>
                <Indicator color="blue" size="xl" class="text-xs font-bold text-white">{approvals.length}</Indicator>
            </div>
            <div class="flex justify-center">
                <div class="text-sm bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 max-w-fit">
                    <i class="fas fa-info-circle mr-2"></i>
                    Approvals are tokens {$selectedWallet?.address == walletId ? 'you are' : 'this wallet is'} authorized to transfer on the owner's behalf
                </div> 
            </div>
            <div class="flex flex-row flex-wrap justify-center">
                {#each approvals as token}
                    {#if token.approved === walletId}
                        <div class="m-4">
                            <TokenDetail collection={collections.find(c => c.contractId === token.contractId)} bind:token={token}></TokenDetail>
                        </div>
                    {/if}
                {/each}
                {#if approvals.length == 0}
                    <div class="text-2xl font-bold">No approvals found.</div>
                {/if}
            </div>
        </TabItem>
        <TabItem>
            <div slot="title">
                <div class="inline">Transactions</div>
            </div>
            <div class="m-4">
                <TransactionTable owner={walletId} />
            </div>
        </TabItem>
        <TabItem>
            <div slot="title">
                <div class="inline">
                    Quests
                    <div class="text-xs bg-yellow-200 text-black border-black rounded-xl inline p-1 align-super">new!</div>
                </div>
            </div>
            <div class="m-4">
                <QuestsTable wallet={walletId} />
            </div>
        </TabItem>
    </Tabs>
</div>
<style>
    .blur-xsm {
        --tw-blur: blur(2px);
       filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);
    }
</style>