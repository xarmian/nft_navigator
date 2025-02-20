<script lang="ts">
    import { inview } from 'svelte-inview';
	import type { PageData } from './$types';
    import type { Token } from '$lib/data/types';
    import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
	import { A } from 'flowbite-svelte';
    import { Tabs, TabItem, Indicator } from 'flowbite-svelte';
    import { onMount, onDestroy, type EventDispatcher } from 'svelte';
    import { selectedWallet } from 'avm-wallet-svelte';
	import { goto, invalidateAll } from '$app/navigation';
    import { toast } from '@zerodevx/svelte-toast';
    import { copy } from 'svelte-copy';
    // @ts-ignore
    import Device from 'svelte-device-info';
    import { getWalletBalance, getCurrency } from '$lib/utils/currency';
	import TransactionTable from '$lib/component/ui/TransactionTable.svelte';
	import QuestsTable from '$lib/component/ui/QuestsTable.svelte';
    import { getImageUrl } from '$lib/utils/functions';
	// import Select from '$lib/component/ui/Select.svelte';
    import SendTokenModal from '$lib/component/ui/SendTokenModal.svelte';
    import Share from '$lib/component/ui/Share.svelte';
    import { page } from '$app/stores';

    export let data: PageData;
    $: walletId = data.props.walletId;
    $: walletEnvoi = data.props.walletEnvoi;
    $: console.log(walletEnvoi);   
    //$: walletAvatar = data.props.walletAvatar;
    $: tokens = data.props.tokens;
    $: approvals = data.props.approvals;
    let collections = data.props.collections;
    let isMobile: boolean | null = null;
    let headerTokens: Token[] = [];
    let portfolioSort = 'mint';
    let displayCount = 10;
    $: multiselectMode = false;
    let didLongPress = false;
    $: selectedTokens = [] as Token[];
    $: showSendTokenModal = false;
    let searchQuery = '';
    let showListedOnly = false;
    let sortDirection: 'asc' | 'desc' = 'asc';
    let containerRef: HTMLDivElement;
    let isLoading = true;

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

    onMount(async () => {
        isMobile = Device.isMobile;
        // Set loading to false after a short delay to prevent flash
        setTimeout(() => {
            isLoading = false;
        }, 500);
    });

    $: {
        if (walletId) {
            getWalletBalance(walletId,0).then((balance) => {
                voiBalance = balance;
            });
        }
    }

    const unsub = selectedWallet.subscribe((value) => {
        console.log('selectedWallet', value);
        if (value?.address) {
        }
        if (walletId && walletId != value?.address) {
            //goto('/portfolio/' + value?.address);
            //invalidateAll();
        }
    });

    onDestroy(() => {
        unsub();
    });

    $: formattedWallet = (walletId) ? (walletId.length > 8
        ? `${walletId.slice(0, (isMobile ? 4 : 6))}...${walletId.slice((isMobile ? -4 : -6))}`
        : walletId) : '';

    // Filter and sort tokens based on user preferences
    $: filteredTokens = tokens.filter(token => {
        if (!token) return false;
        
        // Filter by search query
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery || 
            token.metadata?.name?.toLowerCase().includes(searchLower) ||
            token.metadata?.collection?.name?.toLowerCase().includes(searchLower) ||
            // Search by token number if name contains a number
            (token.metadata?.name && /\d+/.test(searchQuery) && token.metadata.name.includes(searchQuery)) ||
            // Search by traits/properties
            Object.entries(token.metadata?.properties || {}).some(([key, value]) => 
                key.toLowerCase().includes(searchLower) ||
                (typeof value === 'string' && value.toLowerCase().includes(searchLower))
            );

        // Filter by listed status if enabled
        const matchesListed = !showListedOnly || token.marketData;

        return matchesSearch && matchesListed;
    }).sort((a, b) => {
        let comparison = 0;
        if (portfolioSort === 'name') {
            comparison = (a.metadata?.name || '').localeCompare(b.metadata?.name || '');
        } else if (portfolioSort === 'collection') {
            comparison = (a.metadata?.collection?.name || '').localeCompare(b.metadata?.collection?.name || '');
        } else {
            comparison = a.mintRound - b.mintRound;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
    });

    let sortOptions = [
        { id: 'mint', name: 'Mint Date' },
        { id: 'name', name: 'Name' },
        { id: 'collection', name: 'Collection' }
    ];

    function showMore() {
        displayCount += 10;
    }

    function handleLongPress(event: MouseEvent | TouchEvent) {
        console.log('long press?');
        let longPressDuration = 1000;
        let pressTimer: null | NodeJS.Timeout = null;
        didLongPress = false;

        pressTimer = setTimeout(() => {
            console.log('longpress.');
            multiselectMode = !multiselectMode; // Toggle multiselectMode
            didLongPress = true;
            cancelPress();
        }, longPressDuration);

        const cancelPress = () => {
            // Clear the timeout if the press is released early
            console.log('cancelpress.');
            if (pressTimer) {
                clearTimeout(pressTimer);
                pressTimer = null;
            }

            // remove event listeners
            if (event.target) {
                event.target.removeEventListener('mouseup', cancelPress);
                event.target.removeEventListener('mouseleave', cancelPress);
                event.target.removeEventListener('touchend', cancelPress);
                event.target.removeEventListener('touchcancel', cancelPress);
            }
        };

        if (event.target) {
            // Attach event listeners
            event.target.addEventListener('mouseup', cancelPress);
            event.target.addEventListener('mouseleave', cancelPress);
            event.target.addEventListener('touchend', cancelPress);
            event.target.addEventListener('touchcancel', cancelPress);
        }

    }

    function checkStopPropagation(event: MouseEvent) {
        if (multiselectMode || didLongPress) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        }
    }

    function toggleSelectedTokens(token: Token) {
        if (selectedTokens.includes(token)) {
            selectedTokens = selectedTokens.filter(t => t !== token);
        } else {
            selectedTokens = [...selectedTokens, token];
        }
    }

    function clearMultiSelectMode(token?: Token) {
        multiselectMode = false;
        selectedTokens = [];
        if (token) {
            invalidateAll();
        }
    }

    // Add this near the top of the script section
    $: shareUrl = `https://nftnavigator.xyz/portfolio/${walletId}`;
    $: shareText = `Check out this sweet NFT portfolio on Voi Network! #Voiagers #VoiNFTs`;

    $: {
        if (containerRef) {
            containerRef.style.setProperty('--token-area-width', `${containerRef.querySelector('.token-area')?.clientWidth ?? 100}px`);
        }
    }
</script>
<div>
    {#if isLoading}
        <div class="relative w-full h-52 overflow-visible">
            <div class="flex h-full w-full absolute blur-xsm -z-10 opacity-60 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            <div class="flex justify-center items-center w-full mx-2 absolute top-8">
                <div class="flex flex-col p-4 md:p-8 mt-2 mb-2 bg-slate-100 dark:bg-slate-800/95 shadow-2xl rounded-2xl space-y-4 max-w-3xl w-full">
                    <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 h-36">
                        <div class="flex flex-row space-x-4 flex-grow">
                            <div class="h-24 w-24 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
                            <div class="flex flex-col flex-grow space-y-2">
                                <div class="h-8 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                                <div class="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            </div>
                        </div>
                        <div class="flex flex-col justify-between space-y-2 md:w-48">
                            <div class="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                            <div class="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="h-16"></div>
        <div class="flex justify-center">
            <div class="w-full max-w-3xl p-4">
                <div class="h-8 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse mb-4"></div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {#each Array(8) as _, i}
                        <div class="h-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                    {/each}
                </div>
            </div>
        </div>
    {:else if walletId}
        <div class="relative w-full h-52 overflow-visible">
            <div class="flex h-full w-full absolute blur-xsm -z-10 opacity-60">
                {#each headerTokens as token (token)}
                    {#if token.metadata}
                        <div class="flex-grow bg-cover bg-center inline-block" style="background-image: url({getImageUrl(token.metadata.image,480)});">&nbsp;</div>
                    {/if}
                {/each}
            </div>
            <div class="flex justify-center items-center w-full mx-2 absolute top-8">
                <div class="flex flex-col p-4 md:p-8 mt-2 mb-2 bg-slate-100 dark:bg-slate-800/95 shadow-2xl rounded-2xl space-y-4 max-w-3xl w-full">
                    <div class="flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0 h-36">
                        <div class="flex flex-row space-x-4 flex-grow">
                            {#if walletEnvoi?.metadata?.avatar}
                                <img src={walletEnvoi.metadata.avatar} alt={walletEnvoi.metadata.name??formattedWallet} class="h-24 w-24 rounded-full place-self-start" />
                            {/if}
                            <div class="flex flex-col flex-grow">
                                <div class="flex flex-row space-x-2 text-2xl font-bold mb-0">
                                    <div class="text-blue dark:text-blue-100">
                                        {walletEnvoi?.name??formattedWallet}
                                        {#if !walletEnvoi?.name}
                                            <i use:copy={walletId} 
                                               class="fas fa-copy ml-2 cursor-pointer transition-all duration-200 hover:text-blue-500 active:scale-125" 
                                               on:svelte-copy={() => {
                                                   toast.push({
                                                       msg: `<div class="flex items-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Address copied to clipboard</div>`,
                                                       theme: {
                                                           '--toastBackground': '#48BB78',
                                                           '--toastBarBackground': '#2F855A'
                                                       }
                                                   });
                                               }}></i>
                                        {/if}
                                    </div>
                                </div>
                                {#if walletEnvoi?.name}
                                    <div class="text-sm font-bold mb-4 text-left">
                                        {formattedWallet}
                                        <i use:copy={walletId} 
                                           class="fas fa-copy ml-2 cursor-pointer transition-all duration-200 hover:text-blue-500 active:scale-125" 
                                           on:svelte-copy={() => {
                                               toast.push({
                                                   msg: `<div class="flex items-center"><i class="fas fa-check-circle text-green-500 mr-2"></i>Address copied to clipboard</div>`,
                                                   theme: {
                                                       '--toastBackground': '#48BB78',
                                                       '--toastBarBackground': '#2F855A'
                                                   }
                                               });
                                           }}></i>
                                    </div>
                                {/if}
                                <!-- Add Envoi metadata if available -->
                                {#if walletEnvoi?.metadata}
                                        <div class="flex flex-col space-y-2">
                                            {#if walletEnvoi.metadata.url}
                                                <div class="flex items-center space-x-2">
                                                    <i class="fas fa-globe text-gray-600 dark:text-gray-300"></i>
                                                    <a href={walletEnvoi.metadata.url} target="_blank" rel="noopener noreferrer" 
                                                        class="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm">{walletEnvoi.metadata.url}</a>
                                                </div>
                                            {/if}
                                            {#if walletEnvoi.metadata.location}
                                                <div class="flex items-center space-x-2">
                                                    <i class="fas fa-map-marker-alt text-gray-600 dark:text-gray-300"></i>
                                                    <span class="text-gray-600 dark:text-gray-300 text-sm">{walletEnvoi.metadata.location}</span>
                                                </div>
                                            {/if}
                                            {#if walletEnvoi.metadata['com.twitter']}
                                                <div class="flex items-center space-x-2">
                                                    <i class="fab fa-x-twitter text-gray-600 dark:text-gray-300"></i>
                                                    <a href="https://x.com/{walletEnvoi.metadata['com.twitter']}" target="_blank" 
                                                        class="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm">@{walletEnvoi.metadata['com.twitter']}</a>
                                                </div>
                                            {/if}
                                            {#if walletEnvoi.metadata['com.github']}
                                                <div class="flex items-center space-x-2">
                                                    <i class="fab fa-github text-gray-600 dark:text-gray-300"></i>
                                                    <a href="https://github.com/{walletEnvoi.metadata['com.github']}" target="_blank" 
                                                        class="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm">{walletEnvoi.metadata['com.github']}</a>
                                                </div>
                                            {/if}
                                        </div>
                                {/if}
                            </div>
                        </div>
                        <div class="flex flex-col justify-between space-y-2 md:w-48">
                            {#if voiBalance != undefined}
                                <div class="flex flex-row items-center justify-end space-x-2">
                                    <div class="text-lg font-bold text-green-500 dark:text-green-300">{(voiBalance / Math.pow(10,6)).toLocaleString()}</div>
                                    <div class="text-md font-bold text-gray-500 dark:text-gray-300">VOI</div>
                                </div>
                            {/if}
                            <div class="flex flex-col space-y-2">
                                <a href="https://explorer.voi.network/explorer/account/{walletId}" target="_blank" class="text-blue-500 hover:text-blue-700 underline text-sm text-right">
                                    Voi Explorer
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                                <a href="https://voirewards.com/wallet/{walletId}" target="_blank" class="text-blue-500 hover:text-blue-700 underline text-sm text-right">
                                    Voirewards Portfolio
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                                <div class="hidden">
                                    <a href="https://shellyssandbox.xyz/#/account/{walletId}" target="_blank" class="text-blue-500 hover:text-blue-700 underline text-sm">
                                        ARC-200 Balances
                                        <i class="fas fa-external-link-alt"></i>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="h-16"></div>
        <div class="justify-center mb-4 hidden">
            <Share url={shareUrl} text={shareText} />
        </div>
        <div>
            <Tabs style="underline" defaultClass="flex place-items-end rounded-lg divide-x rtl:divide-x-reverse divide-gray-200 shadow dark:divide-gray-700 justify-center relative">
                <TabItem open>
                    <div slot="title">
                        <div class="inline">Portfolio</div>
                        <Indicator color="blue" size="xl" class="text-xs font-bold text-white">
                            {tokens.length}
                        </Indicator>
                    </div>
                    <div class="flex flex-col" bind:this={containerRef}>
                        <div class="flex justify-center w-full">
                            <div class="flex flex-col md:flex-row justify-between items-center gap-4 p-4" style="width: var(--token-area-width, 100%);">
                                <div class="w-full md:w-auto flex-grow">
                                    <input
                                        type="text"
                                        placeholder="Search by name, collection, or traits..."
                                        class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                                        bind:value={searchQuery}
                                    />
                                </div>
                                <div class="flex flex-row gap-4 items-center w-full md:w-auto">
                                    <div class="flex items-center gap-2 w-full md:w-auto">
                                        <select
                                            bind:value={portfolioSort}
                                            class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 w-full md:w-auto"
                                        >
                                            {#each sortOptions as option}
                                                <option value={option.id}>{option.name}</option>
                                            {/each}
                                        </select>
                                        <button
                                            on:click={() => sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'}
                                            class="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
                                            title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                                            aria-label={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                                        >
                                            <i class="fas fa-sort-{sortDirection === 'asc' ? 'up' : 'down'}"></i>
                                        </button>
                                    </div>
                                    <label class="flex items-center gap-2 hidden">
                                        <input
                                            type="checkbox"
                                            bind:checked={showListedOnly}
                                            class="form-checkbox h-5 w-5 text-blue-600"
                                        />
                                        <span>Listed Only</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-row flex-wrap justify-center token-area" style="max-width: fit-content; margin: 0 auto;">
                            {#each filteredTokens.slice(0, displayCount) as token, i}
                                {#if token.owner === walletId}
                                    <div class="m-4 relative" 
                                        on:mousedown={handleLongPress} 
                                        on:touchstart={handleLongPress} 
                                        on:click={() => toggleSelectedTokens(token)} 
                                        on:click|stopPropagation={checkStopPropagation}>
                                        <TokenDetail collection={collections.find(c => c.contractId === token.contractId)} bind:token={token} showOwnerIcon={false} showMenuIcon={!multiselectMode}></TokenDetail>
                                        {#if multiselectMode}
                                            <input type="checkbox" 
                                                class="absolute top-3 left-1 h-8 w-8" 
                                                on:click|stopPropagation={() => toggleSelectedTokens(token)} 
                                                checked={selectedTokens.some(t => t.tokenId === token.tokenId && t.contractId === token.contractId)} />
                                        {/if}
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
                <!--<TabItem>
                    <div slot="title">
                        <div class="inline">
                            Quests
                            <div class="text-xs bg-yellow-200 text-black border-black rounded-xl inline p-1 align-super">new!</div>
                        </div>
                    </div>
                    <div class="m-4">
                        <QuestsTable wallet={walletId} />
                    </div>
                </TabItem>-->
                <a
                    href="#"
                    on:click|preventDefault={() => multiselectMode = !multiselectMode}
                    class="text-blue-500 hover:text-blue-700 underline flex items-center absolute right-4 bottom-2"
                >
                    <i class="fas fa-check-square mr-2"></i>
                    {multiselectMode ? 'Exit Select' : 'Select Multiple'}
                </a>

            </Tabs>
        </div>
        {#if multiselectMode}
            <div class="fixed bottom-0 right-0 p-4 flex space-x-2">
                <button class="bg-blue-500 text-white rounded-lg p-2" on:click={() => clearMultiSelectMode()}>
                    Cancel
                </button>
                <div class="bg-blue-500 text-white rounded-lg p-2">
                    <button on:click={() => selectedTokens = []}>
                        Clear Selection
                    </button>
                    |
                    <button on:click={() => selectedTokens = tokens.filter(t => t.owner === walletId)}>
                        All
                    </button>
                </div>
                <button class="bg-blue-500 text-white rounded-lg p-2" on:click={() => showSendTokenModal = true}>Send ({selectedTokens.length})</button>
            </div>
            {#if showSendTokenModal}
                <SendTokenModal bind:showModal={showSendTokenModal} tokens={selectedTokens} fromAddr={walletId} onClose={() => showSendTokenModal = false} onAfterSend={() => clearMultiSelectMode()} />
            {/if}
        {/if}
    {:else}
        <div class="flex flex-col items-center justify-center mt-20">
            <div class="text-2xl font-bold mb-4">Connect your wallet to view your NFT portfolio</div>
            <div class="relative">
                <i class="fas fa-arrow-up text-4xl text-blue-500 absolute -top-16 -right-40 transform rotate-45"></i>
                <div class="text-lg text-gray-600">Click the "Connect Wallet" button in the upper right corner</div>
            </div>
        </div>
    {/if}
</div>
<style>
    .blur-xsm {
        --tw-blur: blur(2px);
       filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);
    }
</style>