<script lang="ts">
    import Reactions from './Reactions.svelte';
	import { goto, invalidateAll } from "$app/navigation";
    import { Timeline, TimelineItem, Button } from 'flowbite-svelte';
    import { ArrowRightOutline } from 'flowbite-svelte-icons';
    import type { AggregatedNFD } from "$lib/utils/nfd";
    //@ts-expect-error no types
    import EmojiPicker from "svelte-emoji-picker";
	import { onDestroy, onMount } from "svelte";
    import type { IPoll, NMessage } from "$lib/data/types";
    import Markdown from 'svelte-markdown';
    import { getImageUrl } from '$lib/utils/functions';
    import { supabaseImageUrl } from '$lib/data/constants';
    import ExternalLink from '$lib/component/ExternalLink.svelte';
	import { showConfetti } from '../../../../stores/collection';
	import { toast } from '@zerodevx/svelte-toast';

    export let message: NMessage;
    export let collectionName = '';
    export let showCollectionName = false;
    export let canComment = false;
    export let showComments = false;
    export let nfds: AggregatedNFD[] = [];
    export let singleMessageView = false;

    $: poll = message.poll;
    $: canVote = (poll && poll.voted === undefined && (!poll.endTime || new Date(poll.endTime) > new Date()) && (canComment || poll.publicVoting));

    let totalVotes = 0;
    let pollWinner: number | null | undefined = undefined;

    $: {
        if (poll && poll.votes) {
            totalVotes = Object.values(poll.votes).reduce((sum, vote) => sum + vote, 0);
        }
        else {
            totalVotes = 0;
        }
        
        if (poll?.endTime && new Date(poll.endTime) < new Date()) {
            if (poll.votes) {
                // pollWinner = record with highest number in poll.votes
                pollWinner = Number(Object.entries(poll.votes).reduce((a, b) => a[1] > b[1] ? a : b)[0]);
            }
            else {
                pollWinner = null;
            }
        }
        else {
            pollWinner = undefined;
        }
    }

    let messageComment = '';
    let showEmojiPicker = false;

    function handleClick(event: MouseEvent) {
        if (showEmojiPicker && !(event.target as Element)?.closest('.emoji-picker')) {
            showEmojiPicker = false;
        }
    }

    onMount(async () => {
        if (typeof window !== 'undefined') {
            window.addEventListener('click', handleClick);
        }
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('click', handleClick);
        }
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

    const handleComment = async (event: Event) => {
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

    const handleVote = async (vote: string) => {
        if (!canVote) {
            return;
        }

        const response = await fetch('?/postPollVote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                messageId: String(message.id),
                vote,
            })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error.message);
        } else {
            const data = JSON.parse((await response.json()).data);
            if (false && data[data[0]['isFirstAction']]) {
                showConfetti.set(true);
                toast.push(`Congratulations! The React to a Post Quest has been Completed!`);
                setTimeout(() => {
                    invalidateAll();
                    showConfetti.set(false)
                }, 10000);
            }
            else {
                invalidateAll();
            }
        }
    };
</script>
{#if message}
    <div class="flex flex-col pb-6 px-4 bg-gray-50 dark:bg-gray-800 rounded-xl shadow dark:border-slate-700 border">
        <div class="flex flex-row items-start pt-4" class:cursor-pointer={!singleMessageView} on:click={() => goto(`/lounge/${message.collectionId}/${message.id}`, { replaceState: (!singleMessageView ? false : true) })}>
            <div on:click|stopPropagation={() => goto(`/portfolio/${message.walletId}`)} class="cursor-pointer flex-shrink-0 w-12 h-12 bg-gray-500 rounded-full overflow-hidden"><img src={getImageUrl(nfds.find(nfd => nfd.key === message.walletId)?.avatar ?? '/blank_avatar_small.png',240)}/></div>
            <div class="ml-4 flex flex-row w-full justify-between">
                <div class="flex flex-col">
                    <a on:click|stopPropagation={() => goto(`/portfolio/${message.walletId}`)} class="text-sm font-bold text-blue-500 dark:text-blue-300 cursor-pointer w-min">
                        {nfds.find(nfd => nfd.key === message.walletId)?.replacementValue ?? (message.walletId.slice(0, 8) + '...' + message.walletId.slice(-8))}
                    </a>
                    <div class="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-line markdown max-w-48 md:max-w-full cursor-auto" on:click|stopPropagation>
                        <Markdown source={message.message} renderers={{ link: ExternalLink }} />
                        {#if message.images}
                            {#each message.images as image}
                                <img src="{supabaseImageUrl}/{image}" class="w-full mt-2 rounded-lg max-h-64 max-w-64"/>
                            {/each}
                        {/if}
                    </div>
                    {#if poll}
                        <div class="flex flex-col mt-2 space-y-2 cursor-auto" on:click|stopPropagation>
                            <div class="sm:table mt-2 w-full text-left sm:text-sm">
                                {#each Object.entries(poll.options) as [index, option]}
                                    <div class="{parseInt(index) === pollWinner ? 'bg-yellow-100 text-black' : ''} sm:table-row rounded-xl p-4 px-6">
                                        <div class="inline-block sm:table-cell align-middle sm:p-4 sm:px-6 sm:rounded-l-xl">{parseInt(index) + 1}.</div>
                                        <div class="inline-block sm:table-cell align-middle w-11/12 sm:w-full">
                                            <button class="bg-gray-200 text-black px-2 sm:px-4 py-1 sm:py-2 text-start no-underline inline-block
                                                text-xs sm:text-sm m-1 rounded-full transition-colors duration-200 cursor-not-allowed w-full
                                                {canVote && pollWinner === undefined ? 'cursor-pointer hover:bg-green-500 hover:text-white' : ''}
                                                {poll.voted !== undefined && poll.voted === parseInt(index) ? 'bg-yellow-400' : ''}" on:click={() => handleVote(index)}
                                                >
                                                {option}
                                            </button>
                                        </div>
                                        {#if poll.votes}
                                            <div class="sm:table-cell align-middle inline-block">
                                                <div class="w-20 sm:w-40 bg-gray-200 rounded-full overflow-hidden ml-3">
                                                    <div class="bg-green-500 rounded-full h-4" style={`width: ${Math.max((poll.votes?.[parseInt(index)]??0) / totalVotes * 100, 3)}%`}></div>
                                                </div>
                                            </div>
                                            <div class="sm:table-cell align-middle inline-block">
                                                <div class="text-xs text-gray-500 dark:text-gray-400={parseInt(index) !== pollWinner} ml-2">
                                                    {poll.votes?.[parseInt(index)] ?? 0} vote{poll.votes?.[parseInt(index)] === 1 ? '' : 's'}
                                                </div>
                                            </div>
                                            <div class="sm:table-cell align-middle inline-block sm:p-4 sm:px-6 sm:rounded-r-xl">
                                                {#if poll.voted === parseInt(index)}
                                                    <div class="text-xs text-gray-500 dark:text-gray-400 ml-2 flex place-items-end items-center">
                                                        <i class="fas fa-check text-blue-800 text-lg"></i>
                                                        Your Vote
                                                    </div>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Total Votes: {totalVotes} | {pollWinner !== undefined ? 'Ended' : 'Ends'}: {new Date(poll.endTime).toLocaleString()} | {poll.publicVoting ? 'Public' : 'Private'} Poll
                            </div>
                        </div>
                    {/if}
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 hover:text-blue-500 cursor-pointer" title={new Date(message.timestamp).toLocaleString()}>
                        {timeSince(message.timestamp)}
                    </div>
                    {#if showCollectionName}
                        <div class='block sm:hidden text-xs text-blue-500 dark:text-blue-300'>
                            <a href="/lounge/{message.collectionId}">{collectionName}</a>
                        </div>
                    {/if}
                    <div class="place-self-start text-md flex space-x-2 mt-4 z-10" on:click|stopPropagation>
                        <Reactions canReact={canComment} message={message}></Reactions>
                    </div>
                </div>
                <div class="flex flex-col space-y-4">
                    <div class={`place-self-end text-xs px-2 py-1 rounded-lg ${message.private ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {message.private ? 'Private' : 'Public'}
                    </div>
                    {#if showCollectionName}
                        <div class='hidden sm:block place-self-end text-xs text-blue-500 dark:text-blue-300'>
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
                        <div on:click={() => goto(`/portfolio/${comment.walletId}`)} class="cursor-pointer flex-shrink-0 w-12 h-12 bg-gray-500 rounded-full overflow-hidden"><img src={getImageUrl(nfds.find(nfd => nfd.key === comment.walletId)?.avatar ?? '/blank_avatar_small.png',240)}/></div>
                        <div class="ml-4 flex flex-row w-full justify-between">                    
                            <div class="flex flex-col">
                                <a on:click={() => goto(`/portfolio/${comment.walletId}`)} class="text-sm font-bold text-blue-500 dark:text-blue-300 cursor-pointer">
                                    {nfds.find(nfd => nfd.key === comment.walletId)?.replacementValue ?? (comment.walletId.slice(0, 8) + '...' + comment.walletId.slice(-8))}
                                </a>
                                <div class="text-sm text-gray-800 dark:text-gray-200 mt-1 whitespace-pre-line markdown"><Markdown source={comment.comment} renderers={{ link: ExternalLink }} /></div>
                                <div class="text-xs text-gray-500 dark:text-gray-400 mt-2 hover:text-blue-500 cursor-pointer" title={new Date(comment.timestamp).toLocaleString()}>
                                    {timeSince(comment.timestamp)}
                                </div>
                                <div class="place-self-start text-md flex space-x-2 mt-4 z-10">
                                    <Reactions comment={comment} message={message}></Reactions>
                                </div>
                            </div>
                        </div>
                    </div>
                </TimelineItem>
            {/each}
            {#if canComment && showComments}
                <TimelineItem>
                    <div class="flex flex-col w-full pl-8 pr-16 mt-8 relative">
                        <div class="flex flex-row">
                            <div class="text-xl mr-2 pointer" on:click|stopPropagation={() => showEmojiPicker = !showEmojiPicker}>
                                <i class="far fa-smile"></i>
                            </div>
                            <textarea class="w-full h-16 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none" placeholder="Add a comment" bind:value={messageComment}></textarea>
                        </div>
                        <div class="flex flex-row-reverse justify-start mt-2 space-x-2">
                            <Button on:click={handleComment}  color="purple" size="xs" icon={ArrowRightOutline}>Reply</Button>
                            <Button on:click={() => showComments = false} color="none" size="xs" icon={ArrowRightOutline}>Cancel</Button>
                        </div>
                        {#if showEmojiPicker}
                            <div class="absolute top-20 right-0 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 border-2 p-2 rounded-lg">
                                <EmojiPicker bind:value={messageComment}/>
                            </div>
                        {/if}
                    </div>
                </TimelineItem>
            {/if}
        </Timeline>
        {#if canComment && !showComments}
            <div class="flex flex-row -mt-6 justify-end">
                <a on:click={() => showComments = true} class="z-10 text-xs text-gray-500 dark:text-gray-400 hover:!text-blue-500 cursor-pointer">Add Reply</a>
            </div>
        {/if}
    </div>
{/if}