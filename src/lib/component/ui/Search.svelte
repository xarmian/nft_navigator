<script lang="ts">
	import { goto } from '$app/navigation';
    import type { Collection } from '$lib/data/types';
    import { getCollections } from '$lib/utils/indexer';
    import { onDestroy, onMount } from 'svelte';
    import { recentSearch, userPreferences } from '../../../stores/collection';
    import { getEnvoiAddresses, searchEnvoi, type EnvoiSearchResult } from '$lib/utils/envoi';
    import { getAddressesForNFD } from '$lib/utils/nfd';
    import { page } from '$app/stores';

    let collections: Collection[] = [];
    let search = '';
    let selected = 0;
    let showRecent = false;
    let filteredCollections: Collection[] = [];
    let recentSearchValue: Collection[] = [];
	let windowDefined = false;
    let filteredWallets: EnvoiSearchResult[] = [];
    let isOpen = false;
    let viewing: 'analytics' | 'lounge' | null = null;

    onMount(async () => {
        collections = await getCollections({ fetch });

        windowDefined = typeof window !== 'undefined';
        if (windowDefined) {
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('click', handleClickOutside);
        }
    });

    const unsubP = page.subscribe(value => {
        if (value.url.pathname.includes('/analytics')) {
            viewing = 'analytics';
        }
        else if (value.url.pathname.includes('/lounge')) {
            viewing = 'lounge';
        }
        else {
            viewing = null;
        }
    });

    const unsub = recentSearch.subscribe(value => {
        recentSearchValue = value;
    });

	onDestroy(() => {
		if (windowDefined) {
            window.removeEventListener('keydown', handleKeydown);
            window.removeEventListener('click', handleClickOutside);
        }
        unsub();
	});

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.collectionSearchComponent')) {
            isOpen = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        const maxIndex = Math.max(filteredCollections.length - 1, filteredWallets.length - 1);
        if (event.key === 'ArrowDown') {
            selected = Math.min(selected + 1, maxIndex);
        } else if (event.key === 'ArrowUp') {
            selected = Math.max(selected - 1, 0);
        } else if (event.key === 'Enter') {
            if (filteredCollections.length > 0) {
                const selectedCollection = filteredCollections[selected];
                if (selectedCollection) {
                    gotoCollection(selectedCollection.contractId);
                }
            } else if (filteredWallets.length > 0) {
                gotoPortfolio(filteredWallets[selected].address);
            }
        }
    }

    function gotoCollection(contractId: number) {
        const c = collections.find(collection => collection.contractId === contractId);
    
        if (c) {
            switch(viewing) {
                case 'analytics':
                    goto(`/analytics/collection/${contractId}`);
                    break;
                case 'lounge':
                    goto(`/lounge/${contractId}`);
                    break;
                default: 
                    goto(`/collection/${contractId}`);
                    break;
            }

            search = '';
            showRecent = false;
            selected = 0;

            recentSearchValue = [c, ...recentSearchValue.filter(r => r.contractId !== c.contractId)];
            recentSearchValue = recentSearchValue.slice(0, 5);
            recentSearch.set(recentSearchValue);
            /*userPreferences.update(prefs => {
                prefs.analyticsCollectionId = contractId;
                return prefs;
            });*/
        }
    }

    function gotoPortfolio(wallet: string) {
        goto(`/portfolio/${wallet}`);
        search = '';
        showRecent = false;
        selected = 0;
        filteredWallets = [];
    }

    function doShowRecent(doshow: boolean) {
        if (recentSearchValue.length > 0) showRecent = doshow;
        if (!doshow) {
            search = '';
            selected = 0;
        }
    }

    function doClearRecent() {
        recentSearch.set([]);
        recentSearchValue = [];
        showRecent = false;
    }

    $: {
        if (showRecent && search == '') {
            filteredWallets = [];
            filteredCollections = recentSearchValue;
        } else {
            filteredCollections = (search.length >= 2) ? collections.filter(collection => collection.highforgeData?.title.toUpperCase().includes(search.toUpperCase())) : [];

            // do an NFD search
            if (search.length == 58) {
                filteredWallets = [ { address: search, name: search, metadata: {} } ];
            }
            else if (search.length >= 2) {
                searchEnvoi(search).then((data) => {
                    filteredWallets = data;
                });
            }
            else {
                filteredWallets = [];
            }
        }
    }

    function handleInputClick(event: MouseEvent) {
        event.stopPropagation();
        isOpen = true;
        doShowRecent(true);
    }
</script>

<div class="relative collectionSearchComponent">
    <input 
        type="text" 
        on:click={handleInputClick}
        bind:value={search} 
        placeholder="Search collection, enVoi..." 
        class="p-2 w-full border rounded-md bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 text-black dark:text-white" 
    />
    {#if isOpen && (filteredCollections.length > 0 || showRecent || filteredWallets.length > 0)}
        <ul class="absolute right-0 md:left-0 bg-white dark:bg-gray-800 border rounded-md mt-0.5 w-96 max-h-80 overflow-auto shadow-md z-50">
            {#each filteredCollections as collection, index (collection.contractId)}
                <li class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-black dark:text-white {selected === index ? 'bg-blue-200 dark:bg-blue-700' : ''}">
                    <button on:click={() => gotoCollection(collection.contractId)} class="flex flex-row space-x-2 w-full">
                        <img src={collection.highforgeData?.coverImageURL} class="w-8 h-8 rounded-md mr-2" alt={collection.highforgeData?.title} />
                        <div class="flex-grow inline-flex text-left">
                            {collection.highforgeData?.title}
                        </div>
                        <div class="place-items-end">
                            {collection.contractId}
                        </div>
                    </button>
                </li>
            {/each}
            {#each filteredWallets as wallet, index (wallet.address)}
                <li class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-black dark:text-white {selected === index ? 'bg-blue-200 dark:bg-blue-700' : ''}">
                    <button on:click={() => gotoPortfolio(wallet.address)} class="w-full">
                        <div class="flex items-center gap-3">
                            {#if wallet.metadata?.avatar}
                                <img 
                                    src={wallet.metadata.avatar} 
                                    alt={`${wallet.name} avatar`}
                                    class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                />
                            {:else}
                                <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                    <span class="text-gray-600 dark:text-gray-300 text-base">
                                        {wallet.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            {/if}
                            <div class="flex flex-col flex-grow min-w-0">
                                <span class="text-lg font-medium truncate self-start">{wallet.name}</span>
                                <span class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{wallet.address}</span>
                            </div>
                        </div>
                    </button>
                </li>
            {/each}
            {#if showRecent}
                <li class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-black dark:text-white">
                    <button on:click={() => doClearRecent()} class="flex flex-row space-x-2 w-full">
                        <div class="flex-grow inline-flex text-left">
                            Clear Recent
                        </div>
                    </button>
                </li>
            {/if}
        </ul>
    {/if}
</div>