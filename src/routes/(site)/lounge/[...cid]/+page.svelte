<script lang="ts">
	import type { Collection } from "$lib/data/types";
    import { selectedWallet, verifyToken, type WalletConnectionResult } from "avm-wallet-svelte";
	import { onMount } from "svelte";
    import { getTokens, getCollections } from "$lib/utils/indexer";
    import { Tabs, ButtonGroup, Button } from 'flowbite-svelte';
    import TabItem from '$lib/component/ui/TabItemCustom.svelte';
    //@ts-expect-error no types
    import EmojiPicker from "svelte-emoji-picker";
    import type { PageData } from './$types';
	import { goto, invalidateAll } from "$app/navigation";
    import Cookies from 'js-cookie';
    export let data: PageData;

    let wallet: WalletConnectionResult | null = null;
    let userCollections: Collection[] = [];
    let allCollections: Collection[] = [];
    let nonUserCollections: Collection[] = [];
    let selectedView = 'Public';
    let showEmojiPicker = false;
    let chatInput = '';
    let canViewPrivate = false;
    let messages: { walletId: string, message: string, timestamp: string, avatar?: string, private: boolean, nfd?: any }[] = [];
    let postPrivacy = selectedView;
    $: hasValidToken = false;

    $: selectedCollection = data.server_data.collectionId;
    $: {
        messages = data.server_data.messages;
        //console.log(messages);
        if (selectedView == 'Public') {
            messages = messages.filter((message) => !message.private);
        }
        else if (selectedView == 'Private') {
            messages = messages.filter((message) => message.private);
        }
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
            return a.highforgeData?.title.localeCompare(b.highforgeData?.title??'');
        });
    });

    function timeSince(date: string) {
        const now = new Date().getTime();
        const timeElapsed = now - new Date(date).getTime();
        const days = Math.floor(timeElapsed / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeElapsed % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeElapsed % (1000 * 60 * 60)) / (1000 * 60));
        
        let result = '';
        if (days > 0) {
            result += `${days} day${days === 1 ? '' : 's'}`;
            return result + ' ago';
        }
        if (hours > 0) {
            result += `${hours} hour${hours === 1 ? '' : 's'}`;
            return result + ' ago';
        }
        if (minutes > 0) {
            result += `${minutes} minute${minutes === 1 ? '' : 's'}`;
            return result + ' ago';
        }
        
        return 'just now';
    }

    $: {
        // if selectedCollection is not in userCollections, set selectedView to 'Public'
        if (!userCollections.some((collection) => String(collection.contractId) == selectedCollection)) {
            selectedView = 'Public';
            canViewPrivate = false;
        }
        else {
            canViewPrivate = true;
        }
    }

    function changeView(view: string) {
        selectedView = view;
        if (view != 'All') postPrivacy = view;
    }

    const handleSubmit = async (event: Event) => {
        event.preventDefault();

        const response = await fetch('?/postMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                cid: selectedCollection,
                message: chatInput,
                privacy: postPrivacy
            })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error.message);
        } else {
            chatInput = '';
            invalidateAll();
        }
    };
</script>

<div class="flex flex-row mainview dark:bg-gray-900 text-black dark:text-gray-200">
    <div class="flex flex-col space-y-4 w-48 overflow-x-hidden overflow-y-auto text-nowrap p-3 border-r-2 border-slate-200 dark:border-slate-700">
        <div class="flex flex-col">
            <div class="text-sm font-bold bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 p-1 rounded-md shadow-md">
                My Groups
            </div>
            <div class="flex flex-col ml-3 text-sm">
                {#each userCollections as collection, i}
                    <div on:click={() => goto(`/lounge/${collection.contractId}`)} class:text-blue-500={selectedCollection == String(collection.contractId)} class="cursor-pointer text-ellipsis">
                        # {collection.highforgeData?.title}
                    </div>
                {/each}
            </div>
        </div>
        <div class="flex flex-col">
            <div class="text-sm font-bold bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 p-1 rounded-md shadow-md">
                Other Groups
            </div>
            <div class="flex flex-col ml-3 text-sm">
                {#each nonUserCollections as collection, i}
                    <div on:click={() => goto(`/lounge/${collection.contractId}`)} class:text-blue-500={selectedCollection == String(collection.contractId)} class="cursor-pointer text-ellipsis">
                        # {collection.highforgeData?.title}
                    </div>
                {/each}
            </div>
        </div>
    </div>
    <div class="flex flex-col flex-grow h-full">
        <Tabs contentClass="h-full">
            <TabItem title="Overview" open={true} defaultClass="hidden">
                <div class="flex flex-col relative h-full mt-16">
                    <div class="absolute -top-12 right-2">
                        <ButtonGroup>
                            <Button checked={selectedView == 'Public'} on:click={() => changeView('Public')}>Public</Button>
                            {#if canViewPrivate}
                                <Button checked={selectedView == 'Private'} on:click={() => changeView('Private')}>Private</Button>
                                <Button checked={selectedView == 'All'} on:click={() => changeView('All')}>All</Button>
                            {/if}
                        </ButtonGroup>
                    </div>
                    {#if selectedCollection}
                        <div class="flex flex-col my-4 mx-1 mb-12 overflow-auto relative">
                            {#if canViewPrivate && hasValidToken}
                                <form on:submit={handleSubmit} class="h-16 p-2 py-16 mb-4 mx-1 w-full sm:w-3/4 place-self-center flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl shadow relative">
                                    <div class="text-xl mr-2 pointer" on:click|stopPropagation={() => showEmojiPicker = !showEmojiPicker}>
                                        <i class="far fa-smile"></i>
                                    </div>
                                    <textarea name="message" class="flex-grow bg-gray-100 dark:bg-gray-700 rounded-lg p-2 mr-2" placeholder="Type a message..." bind:value={chatInput} ></textarea>
                                    <div class="flex flex-col place-items-start space-y-1">
                                        <select name="privacy" class="text-xs bg-gray-100 dark:bg-gray-700 rounded-lg" bind:value={postPrivacy}>
                                            <option value="Public">Public</option>
                                            <option value="Private">Private</option>
                                        </select>
                                        <button class="flex items-center justify-center bg-blue-500 hover:bg-blue-700 text-white py-1 px-4 rounded-lg w-full">
                                            <i class="fas fa-paper-plane mr-2"></i>
                                            Post
                                        </button>
                                    </div>
                                </form>
                            {:else if canViewPrivate && !hasValidToken}
                                <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-col place-items-center m-2">
                                    <div>Want to Post or view the Private channel? Authenticate your wallet!</div>

                                </div>
                            {/if}
                            {#if showEmojiPicker}
                                <div class="absolute top-20 right-0 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 border-2 p-2 rounded-lg">
                                    <EmojiPicker bind:value={chatInput}/>
                                </div>
                            {/if}
                            <div class="flex-grow h-full m-1 w-full md:w-3/4 place-self-center">
                                {#each messages as message}
                                    <div class="flex flex-row items-start p-6 bg-gray-50 dark:bg-gray-800 rounded-xl shadow mb-4">
                                        <div class="w-12 h-12 bg-gray-500 rounded-full overflow-hidden"><img src={message.nfd?.avatar ?? '/blank_avatar_small.png'}/></div>
                                        <div class="ml-4 flex flex-row w-full justify-between">
                                            <div class="flex flex-col">
                                                <div class="text-sm font-bold text-blue-500 dark:text-blue-300">
                                               {#if message.nfd}
                                                   {message.nfd.replacementValue}
                                               {:else}
                                                   {message.walletId.slice(0, 8)}...{message.walletId.slice(-8)}
                                               {/if}
                                           </div>
                                           <div class="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-line">{message.message}</div>
                                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 hover:text-blue-500 cursor-pointer" title={new Date(message.timestamp).toLocaleString()}>
                                                    {timeSince(message.timestamp)}
                                                </div>
                                            </div>
                                            <div class={`place-self-start text-xs px-2 py-1 rounded-lg mt-2 ${message.private ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                                                {message.private ? 'Private' : 'Public'}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                                {#if messages.length == 0 && (selectedView == 'Public' || (selectedView == 'Private' && !hasValidToken))}
                                    <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-col place-items-center">This channel is empty! Be the change you want to see in the world.</div>
                                {/if}
                            </div>
                        </div>
                    {:else}
                        <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-row justify-center">Welcome to the Voi Lounge <span class="text-blue-500 super text-sm">Alpha</span></div>
                        <div class="text-lg text-gray-800 dark:text-gray-200 flex flex-col place-items-center">Select a group to get started.</div>
                        <div class="text-lg text-gray-600 dark:text-yellow-500 p-4 rounded flex flex-row justify-center m-6">
                            <i class="fas fa-exclamation-circle mr-2"></i>
                            This is currently missing many features. It should be expected to change regularly, and content could be reset at any time.
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 flex flex-col place-items-center">
                            Connect your wallet to see your groups. You will will automatically be added to groups for NFT collections you own.
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 flex flex-col place-items-center">
                            Authenticate your wallet to post messages and view private channels.
                        </div>
                    {/if}
                </div>
            </TabItem>
            <TabItem title="Members" defaultClass="hidden">
                <div>Members</div>
            </TabItem>
            <TabItem title="Activity" defaultClass="hidden">
                <div>Activity</div>
            </TabItem>
        </Tabs>
    </div>
</div>
<style>
.mainview {
    height: calc(100vh - 5rem);
    overflow: hidden;
}
</style>
