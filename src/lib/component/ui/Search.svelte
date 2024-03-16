<script lang="ts">
	import { goto } from '$app/navigation';
    import type { Collection } from '$lib/data/types';
    import { getCollections } from '$lib/utils/indexer';
    import { onDestroy, onMount } from 'svelte';
    import { recentSearch, userPreferences } from '../../../stores/collection';
    import { getAddressesForNFD } from '$lib/utils/nfd';
    import { page } from '$app/stores';

    let collections: Collection[] = [];
    let search = '';
    let selected = 0;
    let showRecent = false;
    let filteredCollections: Collection[] = [];
    let recentSearchValue: Collection[] = [];
	let windowDefined = false;
    let filteredWallets: string[] = [];
    $: hideDropdown = true;
    $: viewingAnalytics = false;

    onMount(async () => {
        collections = await getCollections({ fetch });

        windowDefined = typeof window !== 'undefined';
        if (windowDefined) {
            window.addEventListener('keydown', handleKeydown);
            window.addEventListener('click', handleClickOutside);
        }
    });

    const unsubP = page.subscribe(value => {
        viewingAnalytics = (value.url.pathname.includes('/analytics'));
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
        // @ts-expect-error - event
        if (!event.target.closest('.collectionSearchComponent')) {
            hideDropdown = true;
        }
        else {
            hideDropdown = false;
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
                gotoPortfolio(filteredWallets[selected]);
            }
        }
    }

    function gotoCollection(contractId: number) {
        const c = collections.find(collection => collection.contractId === contractId);
    
        if (c) {
            if (viewingAnalytics) {
                goto(`/analytics/collection/${contractId}`);
            }
            else {
                goto(`/collection/${contractId}`);
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
            if (search.includes('.algo')) {
                getAddressesForNFD(search).then((data) => {
                    filteredWallets = data;
                });
            }
            else if (search.length == 58) {
                filteredWallets = [ search ];
            }
            else {
                filteredWallets = [];
            }
        }
    }
</script>

<div class="relative collectionSearchComponent">
    <input type="text" on:focus={() => doShowRecent(true)} bind:value={search} placeholder="Search collection, NFD..." class="p-2 w-full border rounded-md bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 text-black dark:text-white" />
    {#if hideDropdown != true && (filteredCollections.length > 0 || showRecent || filteredWallets.length > 0)}
        <ul class="absolute right-0 md:left-0 bg-white dark:bg-gray-800 border rounded-md mt-0.5 w-80 max-h-80 overflow-auto shadow-md z-50">
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
            {#each filteredWallets as wallet, index (wallet)}
                <li class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-black dark:text-white {selected === index ? 'bg-blue-200 dark:bg-blue-700' : ''}">
                    <button on:click={() => gotoPortfolio(wallet)} class="flex flex-row space-x-2 w-full">
                        <i class="fas fa-wallet place-self-center"></i>
                        <div class="flex-grow inline-flex text-left">
                            {wallet}
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