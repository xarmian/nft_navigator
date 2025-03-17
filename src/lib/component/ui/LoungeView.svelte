<script lang="ts">
    import { selectedWallet, verifyToken } from "avm-wallet-svelte";
    import Message from '../../../routes/(site)/lounge/[...cid]/Message.svelte';
    import CreatePost from '../../../routes/(site)/lounge/[...cid]/CreatePost.svelte';
    import { inview } from 'svelte-inview';
    import Cookies from 'js-cookie';
    import type { NMessage } from '$lib/data/types';
    import { ButtonGroup, Button } from 'flowbite-svelte';
    import { invalidateAll } from '$app/navigation';
    import { getTokens, getCollection } from '$lib/utils/indexer';

    export let collectionId: number;
    export let sortDirection: 'asc' | 'desc';
    export let searchText: string = '';

    let messages: NMessage[] = [];
    let displayCount = 5;
    let isLoading = false;
    let selectedView: 'All' | 'Public' | 'Private' = 'All';
    let hasValidToken = false;
    let wallet: any = null;
    let nfds: any[] = [];
    let ownsToken = false;
    let collectionName = '';

    // Subscribe to wallet changes
    selectedWallet.subscribe((value) => {
        wallet = value;
        hasValidToken = false;

        if (wallet) {
            const token = Cookies.get(`avm-wallet-token-${wallet.address}`);
            if (token) {
                try {
                    verifyToken(wallet.address, token).then((result) => {
                        hasValidToken = result;
                        // Reload messages when auth state changes to get private messages if authorized
                        loadMessages();
                    });
                }
                catch(err) {
                    console.error(err);
                }
            }
            else {
                loadMessages();
            }
        }
    });

    // Function to load messages
    async function loadMessages() {
        isLoading = true;
        try {
            const response = await fetch(`/api/lounge/${collectionId}`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            
            const data = await response.json();
            messages = data.messages || [];
            nfds = data.nfds || [];

            // Get collection name
            const collection = await getCollection({ contractId: collectionId });
            collectionName = collection?.highforgeData?.title ?? String(collectionId);

            // Check if user owns a token in this collection
            if (wallet?.address) {
                const tokens = await getTokens({ owner: wallet.address, contractId: collectionId });
                const ownedTokens = tokens.filter(t => t.owner === wallet.address);
                ownsToken = ownedTokens.length > 0;
            } else {
                ownsToken = false;
            }

            // Filter messages based on privacy setting
            if (selectedView === 'Public') {
                messages = messages.filter(m => !m.private);
            } else if (selectedView === 'Private' && hasValidToken) {
                messages = messages.filter(m => m.private);
            }
            // For 'All' view, show all messages if authenticated, otherwise only public
            else if (selectedView === 'All') {
                if (!hasValidToken) {
                    messages = messages.filter(m => !m.private);
                }
                // If authenticated, show all messages (no filter needed)
            }

            // Store the unfiltered messages after privacy filtering
            unfilteredMessages = [...messages];

            // Sort messages
            messages.sort((a, b) => {
                const dateA = new Date(a.timestamp).getTime();
                const dateB = new Date(b.timestamp).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            });

        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            isLoading = false;
        }
    }

    function showMore() {
        displayCount += 5;
    }

    // Store the original unfiltered messages
    let unfilteredMessages: NMessage[] = [];

    // Load messages when collection changes
    $: {
        if (collectionId) {
            messages = [];  // Reset messages when collection changes
            unfilteredMessages = [];  // Reset unfiltered messages
            displayCount = 5;  // Reset display count
            loadMessages();
        }
    }

    // Handle view changes separately
    $: {
        if (selectedView && unfilteredMessages.length > 0) {
            // Filter messages based on privacy setting
            if (selectedView === 'Public') {
                messages = unfilteredMessages.filter(m => !m.private);
            } else if (selectedView === 'Private' && hasValidToken) {
                messages = unfilteredMessages.filter(m => m.private);
            } else if (selectedView === 'All') {
                messages = hasValidToken ? [...unfilteredMessages] : unfilteredMessages.filter(m => !m.private);
            }
        }
    }

    // Add a reactive statement specifically for search filtering
    $: {
        if (unfilteredMessages.length > 0) {
            if (searchText) {
                const searchLower = searchText.toLowerCase();
                messages = unfilteredMessages.filter(m => 
                    m.message.toLowerCase().includes(searchLower) ||
                    m.walletId.toLowerCase().includes(searchLower) ||
                    (nfds.find(nfd => nfd.key === m.walletId)?.replacementValue?.toLowerCase().includes(searchLower) ?? false)
                );
            } else {
                messages = [...unfilteredMessages];
            }
        }
    }

    // Add a reactive statement specifically for sorting
    $: {
        if (messages.length > 0 && sortDirection) {
            messages = messages.sort((a, b) => {
                const dateA = new Date(a.timestamp).getTime();
                const dateB = new Date(b.timestamp).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            });
        }
    }

    $: filteredMessages = messages.slice(0, displayCount);
</script>

<div class="flex flex-col w-full space-y-4">
    <!-- View Toggle -->
    <div class="{hasValidToken ? 'flex' : 'hidden'} justify-between items-center place-self-end px-4">
        <ButtonGroup>
            <Button
                color={selectedView === 'All' ? 'blue' : 'light'}
                on:click={() => selectedView = 'All'}>
                All
            </Button>
            <Button
                color={selectedView === 'Public' ? 'blue' : 'light'}
                on:click={() => selectedView = 'Public'}>
                Public
            </Button>
            <Button
                color={selectedView === 'Private' ? 'blue' : 'light'}
                disabled={!hasValidToken}
                on:click={() => selectedView = 'Private'}>
                Private
            </Button>
        </ButtonGroup>
    </div>

    <!-- Create Post Section -->
    {#if hasValidToken}
        <div class="bg-white dark:bg-gray-800 rounded-lg pt-4">
            <CreatePost 
                postPrivacy={selectedView}
                onPost={async (content, poll, imageFile) => {
                    const formData = new FormData();
                    formData.append('message', content);
                    formData.append('privacy', selectedView === 'All' ? 'Public' : selectedView);
                    if (poll) formData.append('poll', JSON.stringify(poll));
                    if (imageFile) formData.append('image', imageFile);

                    const response = await fetch(`/api/lounge/${collectionId}`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        alert(data.error.message);
                        return false;
                    }

                    await loadMessages();
                    return true;
                }} />
        </div>
    {/if}

    <!-- Messages List -->
    <div class="flex flex-col md:py-3 md:space-y-3 mx-1 mb-[6.75rem] md:mb-16 overflow-auto">
        <div class="flex-grow h-full m-1 w-full md:w-3/4 place-self-center space-y-2 md:space-y-3">
            {#if !hasValidToken}
                <div class="text-center bg-yellow-100 dark:bg-yellow-800 border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded relative mb-4">
                    {#if ownsToken}
                        <p>Authenticate your address to post, react, and view private posts.</p>
                    {:else}
                        <p>Obtain one or more <span class="font-bold text-yellow-700 dark:text-yellow-200">{collectionName}</span> to post, react, and view private posts.</p>
                    {/if}
                </div>
            {/if}
            {#if isLoading}
                <div class="text-center py-4">Loading messages...</div>
            {:else if filteredMessages.length === 0}
                <div class="text-center py-4">No messages found</div>
            {:else}
                {#each filteredMessages as message, i}
                    <Message {nfds} {message} canComment={hasValidToken && (message.private ? hasValidToken : true)}></Message>
                {/each}
                {#if messages.length == 0 && (selectedView == 'Public' || (selectedView == 'Private' && hasValidToken))}
                    <div class="text-2xl font-bold text-gray-800 dark:text-gray-200 flex flex-col place-items-center">This channel is empty! Be the change you want to see in the world.</div>
                {/if}
                {#if messages.length > displayCount}
                    <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
                {/if}
            {/if}
        </div>
    </div>
</div>

<style>
    .sentinel {
        height: 1px;
        width: 100%;
    }
</style> 