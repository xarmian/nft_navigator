<script lang="ts">
    import CreatePost from './CreatePost.svelte';
    import Message from './Message.svelte';
    import { inview } from 'svelte-inview';
	import type { Collection, Token, IPoll } from "$lib/data/types";
    import { selectedWallet, verifyToken, type WalletConnectionResult } from "avm-wallet-svelte";
	import { onMount, onDestroy } from "svelte";
    import { getTokens, getCollections } from "$lib/utils/indexer";
    import { Tabs, ButtonGroup, Button, Popover, Indicator } from 'flowbite-svelte';
    import TabItem from '$lib/component/ui/TabItemCustom.svelte';
    import type { PageData } from './$types';
	import { goto, invalidateAll } from "$app/navigation";
    import Cookies from 'js-cookie';
	import { toast } from "@zerodevx/svelte-toast";
	import HoldersList from "$lib/component/ui/HoldersList.svelte";
	import TokenDetail from "$lib/component/ui/TokenDetail.svelte";
	import NautilusButton from "$lib/component/ui/NautilusButton.svelte";
	import HighforgeButton from "$lib/component/ui/HighforgeButton.svelte";
	import PixelPursuitButton from "$lib/component/ui/PixelPursuitButton.svelte";
	import NftGamesButton from "$lib/component/ui/NFTGamesButton.svelte";
	import FanIcon from "$lib/component/ui/icons/FanIcon.svelte";
	import { getImageUrl } from '$lib/utils/functions';
    
    export let data: PageData;

    let wallet: WalletConnectionResult | null = null;
    let userCollections: Collection[] = [];
    let allCollections: Collection[] = [];
    let nonUserCollections: Collection[] = [];
    let selectedView = 'Public';
    let canViewPrivate = false;
    let messages: { id: number, walletId: string, message: string, timestamp: string, avatar?: string, private: boolean, collectionId: string }[] = [];
    let postPrivacy = selectedView;
    let privateCount = 0;
    let publicCount = 0;
    //let collectionMembers: { owner: string; tokens: any[]; }[];
    let tokens: Token[] = [];
    let isLoading = false;
    let showChat = true;
    let showMembers = false;
    let showCollection = false;
    let collectionObject = allCollections.find(c => c.contractId === Number(data.params.cid[data.params.cid.length - 1]));
    let displayCountMessages = 5;
    let displayCountCollection = 10;
    let mobilePage = "chat";
    $: hasValidToken = false;
    
    $: selectedCollection = data.server_data.collectionId;
    $: {
        messages = data.server_data.messages;
        privateCount = messages.filter((message) => message.private).length;
        publicCount = messages.filter((message) => !message.private).length;

        //console.log(messages);
        if (selectedView == 'Public') {
            messages = messages.filter((message) => !message.private);
        }
        else if (selectedView == 'Private') {
            messages = messages.filter((message) => message.private);
        }
        displayCountMessages = 5;
        isLoading = false;
    }

    $: {
        if (wallet) {
            getTokens({ owner: wallet?.address, fetch }).then((userTokens) => {
                userCollections = allCollections.filter((collection) => {
                    return userTokens.some((token) => token.contractId == collection.contractId);
                });

                nonUserCollections = allCollections.filter((collection) => {
                    return !userTokens.some((token) => token.contractId == collection.contractId);
                });
            });
        }
        else {
            nonUserCollections = allCollections;
        }
    }

    const unsub = selectedWallet.subscribe((value) => {
        wallet = value;
        hasValidToken = false;

        if (wallet) {
            const token = Cookies.get(`avm-wallet-token-${wallet.address}`);
            if (token) {
                verifyToken(wallet.address, token).then((result) => {
                    hasValidToken = result;
                });
            }
        }
    });

    onMount(async () => {
        allCollections = await getCollections({fetch});

        // sort allCollections by collection.highforgeData?.title
        allCollections = allCollections.sort((a: any, b: any) => {
            return a.highforgeData?.title.localeCompare(b.highforgeData?.title??'ZZZ');
        });
    });

    onDestroy(() => {
        unsub();
    });

    $: {
        // if selectedCollection is not in userCollections, set selectedView to 'Public'
        if ((!userCollections.some((collection) => String(collection.contractId) == selectedCollection) || selectedCollection === 'all') && selectedCollection != 'myfeed') {
            selectedView = 'Public';
            canViewPrivate = false;
        }
        else {
            canViewPrivate = true;
        }

        if (selectedCollection && selectedCollection !== 'myfeed' && selectedCollection !== 'all') {
            getTokens({ contractId: selectedCollection, fetch }).then((t) => {
                tokens = t;
            });
        }
        else {
            showChat = true;
        }

    }

    function showMoreCollection() {
        displayCountCollection += 10;
    }

    function showMoreMessages() {
        displayCountMessages += 5;
    }

    function changeView(view: string) {
        selectedView = view;
        if (view != 'All') postPrivacy = view;
    }

    const onPost = async (content: string, poll: IPoll | null): Promise<boolean> => {
        const response = await fetch('?/postMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                cid: selectedCollection,
                message: content,
                privacy: postPrivacy,
                poll: poll ? JSON.stringify(poll) : '',
            })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error.message);
            return false;
        } else {
            return true;
        }
    };

    const loadCollection = async (contractId: string) => {
        isLoading = true;
        await goto(`/lounge/${contractId}`, { invalidateAll: true });
        isLoading = false;
        mobilePage = 'chat';
    };

    const loadPage = async () => {
        const response = await fetch(`/?page=1`);
        messages = await response.json();
        console.log(messages);
    };
</script>

<div class="flex flex-row mainview bg-opacity-50 text-black dark:text-gray-200">
    <div class="{mobilePage == 'groups' ? 'flex' : 'hidden'} md:flex flex-col space-y-4 min-w-48 md:w-48 overflow-x-hidden overflow-y-auto text-nowrap p-3 border-r-2 border-slate-200 dark:border-slate-600 mb-[4.5rem] md:mb-0">
        <div class="flex flex-col">
            <div class="flex flex-col ml-3 md:text-sm">
                <div on:click={() => loadCollection('all')} class:text-blue-500={selectedCollection == 'all'} class="cursor-pointer text-ellipsis">
                    # Public Feed
                 </div>
                 <div on:click={() => loadCollection('myfeed')} class:text-blue-500={selectedCollection == 'myfeed'} class="cursor-pointer text-ellipsis">
                    # My Feed
                 </div>
              </div>
        </div>
        <div class="flex flex-col">
            <div class="text-sm font-bold bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 p-1 rounded-md shadow-md">
                My Groups
            </div>
            <div class="flex flex-col ml-3 md:text-sm">
                {#each userCollections as collection, i}
                    <div on:click={() => loadCollection(String(collection.contractId))} class:text-blue-500={selectedCollection == String(collection.contractId)} class="cursor-pointer text-ellipsis">
                        # {collection.highforgeData?.title ?? collection.contractId}
                    </div>
                {/each}
            </div>
        </div>
        <div class="flex flex-col">
            <div class="text-sm font-bold bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 p-1 rounded-md shadow-md">
                Other Groups
            </div>
            <div class="flex flex-col ml-3 md:text-sm">
                {#each nonUserCollections as collection, i}
                    <div on:click={() => loadCollection(String(collection.contractId))} class:text-blue-500={selectedCollection == String(collection.contractId)} class="cursor-pointer text-ellipsis">
                        # {collection.highforgeData?.title ?? collection.contractId}
                    </div>
                {/each}
            </div>
        </div>
    </div>
    <div class="{mobilePage != 'groups' ? 'flex' : 'hidden'} md:flex flex-col flex-grow h-full mt-1" >
        <div class="md:hidden text-lg font-bold text-gray-800 dark:text-gray-200 p-1 rounded-md shadow-md">
            {selectedCollection == 'all' ? 'Public Feed' : selectedCollection == 'myfeed' ? 'My Feed' : allCollections.find(c => c.contractId === Number(selectedCollection))?.highforgeData?.title ?? selectedCollection}
        </div>
        <Tabs defaultClass="hidden md:flex flex-wrap space-x-2 rtl:space-x-reverse" contentClass="h-full" divider={false}>
            {#if selectedCollection !== 'all' && selectedCollection !== 'myfeed'}
                <TabItem title={allCollections.find(c => c.contractId === Number(selectedCollection))?.highforgeData?.title ?? selectedCollection} defaultClass="text-xl" inactiveClasses="p-4 text-gray-700 dark:text-gray-200" disabled>
                </TabItem>
            {:else}
                <TabItem title={selectedCollection === 'all' ? 'All Feeds' : 'My Feed'} defaultClass="text-2xl" inactiveClasses="p-4 text-gray-700 dark:text-gray-200" disabled>
                </TabItem>
            {/if}
            <TabItem title="Chat" bind:open={showChat} defaultClass={!selectedCollection || selectedCollection === 'all' || selectedCollection === 'myfeed' ? 'hidden' : ''} activeClasses="p-4 text-primary-600 bg-gray-100 rounded-t-lg dark:bg-slate-700 dark:text-primary-400">
                <div class="flex flex-col relative h-full -mt-1">
                    <div class="absolute -top-9 md:-top-12 right-2 flex flex-row">
                        {#if selectedCollection && selectedCollection !== 'all'}
                            <div class="flex flex-row">
                                <ButtonGroup>
                                    <Button checked={selectedView == 'Public'} on:click={() => changeView('Public')}>Public ({publicCount})</Button>
                                    <Button disabled={!canViewPrivate} checked={selectedView == 'Private'} on:click={() => changeView('Private')}>Private{canViewPrivate && privateCount > 0 ? ` (${privateCount})` : ''}</Button>
                                    <Button disabled={!canViewPrivate} checked={selectedView == 'All'} on:click={() => changeView('All')}>All</Button>
                                </ButtonGroup>
                                {#if !hasValidToken}
                                    <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-col place-items-center m-2">
                                        <button id="auth-info-trigger" class="flex">
                                            <i class="fas fa-info-circle mr-2 text-blue-600"></i>
                                        </button>
                                        <Popover
                                            triggeredBy="#auth-info-trigger"
                                            placement="bottom"
                                            class="w-64 text-sm p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow-lg"
                                            style="z-index: 1000"
                                        >
                                        To access private groups, you must authenticate your wallet. Click your wallet address and then select the "Auth" option next to the wallet.
                                        </Popover>
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    </div>
                    {#if selectedCollection}
                        <div class="flex flex-col py-2 md:py-3 md:space-y-3 mx-1 {selectedCollection == 'all' || selectedCollection == 'myfeed' ? 'mb-[4.5rem]' : 'mb-[6.75rem] md:mb-16'} overflow-auto relative border-t-2 border-slate-200 dark:border-slate-400">
                            {#if !hasValidToken}
                                <div class="text-sm bg-yellow-300 text-black dark:bg-yellow-600 dark:text-white border border-yellow-900 p-2 rounded-lg mb-1">
                                    <i class="fas fa-exclamation-triangle mr-2"></i>
                                    You must <a href="https://wind-bolt-806.notion.site/Quest-2-Authenticate-your-Wallet-bd8a312141e0403688953625e14106df" class="text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:dark:text-blue-300 underline cursor-pointer" target="_blank">authenticate your wallet</a> to post messages, react, or view private channels.
                                </div>
                            {/if}
                            {#if canViewPrivate && hasValidToken && selectedCollection !== 'all' && selectedCollection !== 'myfeed'}
                                <CreatePost onPost={onPost} postPrivacy={postPrivacy}></CreatePost>
                            {:else if selectedView == 'Private' && canViewPrivate && !hasValidToken}
                                <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-col place-items-center m-2">
                                    <div>Want to Post in or view the Private channel? Authenticate your wallet!</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">Click your wallet address and then select the "Auth" option next to the wallet.</div>
                                </div>
                            {/if}
                            <div class="flex-grow h-full m-1 w-full md:w-3/4 place-self-center space-y-2 md:space-y-3">
                                {#each messages as message, i}
                                    <Message nfds={data.server_data.nfds} {message} canComment={hasValidToken && (canViewPrivate || userCollections.find((c) => String(c.contractId) == message.collectionId) != undefined)} collectionName={allCollections.find(c => c.contractId === Number(message.collectionId))?.highforgeData?.title} showCollectionName={selectedCollection === 'all' || selectedCollection === 'myfeed'}></Message>
                                {/each}
                                {#if messages.length == 0 && (selectedView == 'Public' || (selectedView == 'Private' && hasValidToken))}
                                    <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-col place-items-center">This channel is empty! Be the change you want to see in the world.</div>
                                {/if}
                            </div>
                            {#if messages.length > displayCountMessages}
                                <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMoreMessages}></div>
                            {/if}
                        </div>
                    {:else}
                        <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-row justify-center mt-8">Welcome to the Voi Lounge <span class="text-blue-500 super text-sm">Alpha</span></div>
                        <div class="text-lg text-gray-800 dark:text-gray-200 flex flex-col place-items-center">Select a group to get started.</div>
                        <div class="text-lg text-gray-600 dark:text-yellow-500 p-4 rounded flex flex-row justify-center m-6">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            This is currently missing many features. It should be expected to change regularly, and content could be reset at any time.
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 flex flex-col place-items-center">
                            Connect your wallet to see your groups. You will automatically be added to groups for NFT collections you own.
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 flex flex-col place-items-center">
                            Authenticate your wallet to post messages and view private channels.
                        </div>
                    {/if}
                </div>
            </TabItem>
            {#if selectedCollection && selectedCollection !== 'all' && selectedCollection !== 'myfeed'}
                <TabItem bind:open={showMembers} defaultClass="" activeClasses="p-4 text-primary-600 bg-gray-100 rounded-t-lg dark:bg-slate-700 dark:text-primary-400">
                    <svelte:fragment slot="title">
                        Members
                        <Indicator size="xl" color="indigo" class="text-sm text-white" border>{[...new Set(tokens.map(token => token.owner))].length}</Indicator>
                    </svelte:fragment>

                    <div class="flex flex-col relative h-full -mt-3">
                        <div class="flex flex-col my-2 mx-1 mb-12 overflow-auto relative border-t-2 border-slate-200 dark:border-slate-400">
                            <HoldersList tokens={tokens} showDownloadCSV={false} />
                        </div>
                    </div>
                </TabItem>
                {#if selectedCollection}
                    <TabItem bind:open={showCollection} defaultClass="" activeClasses="p-4 text-primary-600 bg-gray-100 rounded-t-lg dark:bg-slate-700 dark:text-primary-400">
                        <svelte:fragment slot="title">
                            Collection
                            <Indicator size="xl" color="indigo" class="text-xs text-white" border>{tokens.length}</Indicator>
                        </svelte:fragment>
                        <div class="flex flex-col relative h-full -mt-3">
                            <div class="flex flex-col my-2 mx-1 mb-12 overflow-auto relative border-t-2 border-slate-200 dark:border-slate-400">
                                <div class="flex flex-row space-x-3 ml-2 mt-2">
                                    <a class="p-2 rounded-lg content-evenly text-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 flex flex-row" href={`/collection/${selectedCollection}`}>
                                        <div class="flex flex-col">
                                            <FanIcon />
                                            Collection
                                        </div>
                                    </a>
                                    <NautilusButton contractid={selectedCollection} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
                                    <HighforgeButton buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
                                    <PixelPursuitButton contractid={selectedCollection} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 text-black px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
                                    {#if collectionObject?.gameData}
                                        <NftGamesButton contractid={selectedCollection} buttonClass="flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer min-h-14 w-20 md:w-24"/>
                                    {/if}
                                </div>

                                <div class="flex flex-wrap flex-grow justify-center md:justify-start mt-3 md:mt-0">
                                    {#each tokens.slice(0, displayCountCollection) as token (token.tokenId)}
                                        <div class="p-1">
                                            <TokenDetail collection={collectionObject} {token} format="small" />
                                        </div>
                                    {/each}
                                </div>
                                {#if tokens.length > displayCountCollection}
                                    <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMoreCollection}></div>
                                {/if}
                            </div>
                        </div>
                </TabItem>
                {/if}
            {/if}
        </Tabs>
    </div>
</div>
{#if selectedCollection}
    <div class="absolute top-0 -z-10 h-screen w-screen opacity-30 dark:opacity-20 bgcontainer" style={`background-image: url(${getImageUrl(allCollections.find(c => c.contractId === Number(selectedCollection))?.highforgeData?.coverImageURL??'',240)});`}>
        <div class="absolute inset-0 bg-black opacity-50"></div>
    </div>
{/if}
{#if isLoading}
    <div class="loading-icon">
        <i class="fas fa-spinner fa-spin text-9xl"></i>
    </div>
{/if}
<div class="fixed md:hidden bottom-0 -left-1 right-0 bg-white dark:bg-gray-800 border border-t-slate-500 shadow-md z-50">
    <div class="flex justify-around">
        <button class="flex w-full flex-col items-center py-4 focus:outline-none {mobilePage === 'groups' ? 'bg-gray-200 dark:bg-gray-900' : ''}" on:click={() => mobilePage = 'groups'}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
            <span class="text-xs text-gray-500 dark:text-gray-400">Groups</span>
        </button>
        <button class="flex w-full flex-col items-center py-4 focus:outline-none {mobilePage == 'chat' && showChat == true ? 'bg-gray-200 dark:bg-gray-900' : ''}" on:click={() => {mobilePage = 'chat'; showChat = true;}}>
            <i class="fa-regular fa-comments h-6 w-6 text-gray-500 dark:text-gray-400"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Chat</span>
        </button>
        <button class="flex w-full flex-col items-center py-4 focus:outline-none {mobilePage == 'chat' && showMembers == true ? 'bg-gray-200 dark:bg-gray-900' : ''}" on:click={() => {mobilePage = 'chat'; showMembers = true;}}>
            <i class="fas fa-users h-6 w-6 text-gray-500 dark:text-gray-400"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Members</span>
        </button>
        <button class="flex w-full flex-col items-center py-4 focus:outline-none {mobilePage == 'chat' && showCollection == true ? 'bg-gray-200 dark:bg-gray-900' : ''}" on:click={() => {mobilePage = 'chat'; showCollection = true;}}>
            <i class="fas fa-layer-group h-6 w-6 text-gray-500 dark:text-gray-400"></i>
            <span class="text-xs text-gray-500 dark:text-gray-400">Collection</span>
        </button>
    </div>
</div>

<style>
.loading-icon {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}
.mainview {
    height: calc(100vh - 5rem);
    overflow: hidden;
}
.bgcontainer {
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    filter: blur(10px);
}
</style>
