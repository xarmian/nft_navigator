<script lang="ts">
	import { goto, invalidateAll } from "$app/navigation";
    import { Timeline, TimelineItem, Button } from 'flowbite-svelte';
    import { ArrowRightOutline } from 'flowbite-svelte-icons';
    import type { AggregatedNFD } from "$lib/utils/nfd";

    type NMessage = {
        id?: number;
        walletId: string;
        message: string;
        timestamp: string;
        private: boolean;
        collectionId: string;
        nfd?: any;
        comments?: NComment[];
    };

    type NComment = {
        walletId: string;
        comment: string;
        timestamp: string;
        nfd?: any;
    };

    export let message: NMessage;
    export let collectionName = '';
    export let showCollectionName = false;
    export let canComment = false;
    export let showComments = false;
    export let nfds: AggregatedNFD[] = [];

    let messageComment = '';

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

    const submitComment = async (event: Event) => {
        event.preventDefault();

        const response = await fetch('?/postComment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                messageId: String(message.id),
                comment: messageComment,
            })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error.message);
        } else {
            messageComment = '';
            invalidateAll();
        }
    };
</script>
{#if message}
    <div class="flex flex-col p-6 mb-4 bg-gray-50 dark:bg-gray-800 rounded-xl shadow dark:border-slate-700 border">
        <div class="flex flex-row items-start">
            <div on:click={() => goto(`/portfolio/${message.walletId}`)} class="cursor-pointer flex-shrink-0 w-12 h-12 bg-gray-500 rounded-full overflow-hidden"><img src={nfds.find(nfd => nfd.key === message.walletId)?.avatar ?? '/blank_avatar_small.png'}/></div>
            <div class="ml-4 flex flex-row w-full justify-between">
                <div class="flex flex-col">
                    <a on:click={() => goto(`/portfolio/${message.walletId}`)} class="text-sm font-bold text-blue-500 dark:text-blue-300 cursor-pointer">
                        {nfds.find(nfd => nfd.key === message.walletId)?.replacementValue ?? (message.walletId.slice(0, 8) + '...' + message.walletId.slice(-8))}
                    </a>
                    <div class="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-line">{message.message}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 hover:text-blue-500 cursor-pointer" title={new Date(message.timestamp).toLocaleString()}>
                        {timeSince(message.timestamp)}
                    </div>
                </div>
                <div class="flex flex-col justify-between">
                    <div class={`place-self-end text-xs px-2 py-1 rounded-lg mt-2 ${message.private ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {message.private ? 'Private' : 'Public'}
                    </div>
                    {#if showCollectionName}
                        <div class={`place-self-end text-xs text-blue-500 dark:text-blue-300`}>
                            <a href="/lounge/{message.collectionId}">{collectionName}</a>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
        <Timeline>
            {#each message.comments??[] as comment}
                <TimelineItem>
                    <div class="flex flex-row items-start mt-8 ml-8">
                        <div on:click={() => goto(`/portfolio/${comment.walletId}`)} class="cursor-pointer flex-shrink-0 w-12 h-12 bg-gray-500 rounded-full overflow-hidden"><img src={nfds.find(nfd => nfd.key === comment.walletId)?.avatar ?? '/blank_avatar_small.png'}/></div>
                        <div class="ml-4 flex flex-row w-full justify-between">                    
                            <div class="flex flex-col">
                                <a on:click={() => goto(`/portfolio/${comment.walletId}`)} class="text-sm font-bold text-blue-500 dark:text-blue-300 cursor-pointer">
                                    {nfds.find(nfd => nfd.key === comment.walletId)?.replacementValue ?? (comment.walletId.slice(0, 8) + '...' + comment.walletId.slice(-8))}
                                </a>
                                <div class="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-line">{comment.comment}</div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 hover:text-blue-500 cursor-pointer" title={new Date(comment.timestamp).toLocaleString()}>
                                    {timeSince(comment.timestamp)}
                                </div>
                            </div>
                        </div>
                    </div>
                </TimelineItem>
            {/each}
            {#if canComment && showComments}
                <TimelineItem>
                    <div class="flex flex-col w-full pl-8 pr-16 mt-8">
                        <textarea class="w-full h-16 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none" placeholder="Add a comment" bind:value={messageComment}></textarea>
                        <div class="flex flex-row-reverse justify-start mt-2 space-x-2">
                            <Button on:click={submitComment}  color="purple" size="xs" icon={ArrowRightOutline}>Comment</Button>
                            <Button on:click={() => showComments = false} color="none" size="xs" icon={ArrowRightOutline}>Cancel</Button>
                        </div>
                    </div>
                </TimelineItem>
            {/if}
        </Timeline>
        {#if canComment && !showComments}
            <div class="flex flex-row mt-2 justify-end">
                <a on:click={() => showComments = true} class="text-xs text-gray-500 dark:text-gray-400 hover:!text-blue-500 cursor-pointer">Add Comment</a>
            </div>
        {/if}
    </div>
{/if}
<style>
</style>