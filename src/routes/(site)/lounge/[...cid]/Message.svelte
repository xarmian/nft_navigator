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
    import ImageModal from '$lib/component/ui/ImageModal.svelte';

    export let message: NMessage;
    export let collectionName = '';
    export let showCollectionName = false;
    export let canComment = false;
    export let showComments = false;
    export let nfds: AggregatedNFD[] = [];

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
    let commentTextarea: HTMLTextAreaElement;
    let showImageModal = false;
    let selectedImage = '';

    $: if (showComments && commentTextarea) {
        commentTextarea.focus();
    }

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

        // Optimistically update UI
        if (poll) {
            const voteNum = Number(vote);
            poll.voted = voteNum;
            if (!poll.votes) {
                poll.votes = {};
            }
            if (!poll.votes[voteNum]) {
                poll.votes[voteNum] = 0;
            }
            poll.votes[voteNum]++;
            message = message;
        }

        try {
            const response = await fetch(`/api/lounge/${message.collectionId}/poll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: message.id,
                    vote: vote,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error.message);
                // Revert optimistic update on error
                if (poll) {
                    const voteNum = Number(vote);
                    poll.voted = undefined;
                    if (poll.votes && poll.votes[voteNum] > 0) {
                        poll.votes[voteNum]--;
                        if (poll.votes[voteNum] === 0) {
                            delete poll.votes[voteNum];
                        }
                    }
                    message = message;
                }
            } else if (data.isFirstAction) {
                showConfetti.set(true);
                toast.push(`Congratulations! The Poll Vote Quest has been Completed!`);
                setTimeout(() => {
                    showConfetti.set(false)
                }, 10000);
            }
        } catch (error) {
            console.error('Error submitting vote:', error);
            alert('Failed to submit vote. Please try again.');
            // Revert optimistic update on error
            if (poll) {
                const voteNum = Number(vote);
                poll.voted = undefined;
                if (poll.votes && poll.votes[voteNum] > 0) {
                    poll.votes[voteNum]--;
                    if (poll.votes[voteNum] === 0) {
                        delete poll.votes[voteNum];
                    }
                }
                message = message;
            }
        }
    };
</script>
{#if message}
    <div class="group relative flex flex-col p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 dark:border-slate-700 border">
        <div class="flex items-start gap-4">
            <!-- User Avatar with Hover Effect -->
            <button 
                on:click|stopPropagation={() => goto(`/portfolio/${message.walletId}`)} 
                on:keydown|stopPropagation={(e) => e.key === 'Enter' && goto(`/portfolio/${message.walletId}`)}
                class="relative flex-shrink-0 w-12 h-12 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-blue-500 transition-all duration-200"
            >
                <img 
                    src={getImageUrl(nfds.find(nfd => nfd.key === message.walletId)?.avatar ?? '/blank_avatar_small.png',240)} 
                    alt="User avatar"
                    class="w-full h-full object-cover"
                />
            </button>

            <div class="flex-1">
                <!-- Header Section -->
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-3">
                        <a 
                            href={`/portfolio/${message.walletId}`}
                            on:click|preventDefault|stopPropagation={() => goto(`/portfolio/${message.walletId}`)}
                            on:keydown|stopPropagation={(e) => e.key === 'Enter' && goto(`/portfolio/${message.walletId}`)}
                            class="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        >
                            {nfds.find(nfd => nfd.key === message.walletId)?.replacementValue ?? (message.walletId.slice(0, 8) + '...' + message.walletId.slice(-8))}
                        </a>
                        <span class="text-xs text-gray-500 dark:text-gray-400" title={new Date(message.timestamp).toLocaleString()}>
                            {timeSince(message.timestamp)}
                        </span>
                        {#if showCollectionName}
                            <a 
                                href="/lounge/{message.collectionId}" 
                                class="hidden sm:block text-xs text-blue-500 dark:text-blue-300 hover:underline"
                            >
                                {collectionName}
                            </a>
                        {/if}
                    </div>
                    <div class={`px-3 py-1 text-xs font-medium rounded-full ${message.private ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
                        {message.private ? 'Private' : 'Public'}
                    </div>
                </div>

                <!-- Message Content -->
                <div class="prose prose-sm dark:prose-invert max-w-none">
                    <Markdown source={message.message} renderers={{ link: ExternalLink }} />
                    {#if message.images}
                        <div class="grid gap-2 mt-4 grid-cols-3">
                            {#each message.images as image}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <div 
                                    role="button"
                                    tabindex="0"
                                    class="relative aspect-square cursor-zoom-in overflow-hidden rounded-lg"
                                    on:click={() => {
                                        selectedImage = `${supabaseImageUrl}/${image}`;
                                        showImageModal = true;
                                    }}
                                >
                                    <img 
                                        src="{supabaseImageUrl}/{image}" 
                                        alt="Message content" 
                                        class="w-full h-full object-cover transition-all duration-300"
                                    />
                                    <div class="absolute inset-0 opacity-0 hover:opacity-100 transition-all duration-300">
                                        <div class="absolute inset-0 bg-black/10"></div>
                                        <div class="absolute bottom-3 right-3">
                                            <div class="p-2 bg-black/60 rounded-full text-white/90 hover:text-white">
                                                <i class="fas fa-expand-alt"></i>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Poll Section -->
                {#if poll}
                    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 mb-4">
                        <div class="space-y-3">
                            {#each Object.entries(poll.options) as [index, option]}
                                {@const voteCount = poll.votes?.[parseInt(index)] ?? 0}
                                {@const percentage = totalVotes > 0 ? (voteCount / totalVotes * 100) : 0}
                                {@const isWinner = parseInt(index) === pollWinner}
                                {@const isVoted = poll.voted === parseInt(index)}
                                <button 
                                    class="relative w-full text-left group/option
                                        {isWinner ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''}
                                        {isVoted ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}
                                        {canVote && pollWinner === undefined ? 'hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-400' : ''}"
                                    on:click={() => handleVote(index)}
                                    disabled={!canVote || pollWinner !== undefined}
                                >
                                    <div class="relative overflow-hidden rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 p-4">
                                        {#if poll.votes}
                                            <div 
                                                class="absolute inset-0 bg-blue-50 dark:bg-blue-500/10 transition-all duration-500"
                                                style="width: {percentage}%">
                                            </div>
                                        {/if}
                                        <div class="relative flex items-center justify-between gap-4">
                                            <div class="flex-1">
                                                <p class="font-medium text-gray-900 dark:text-gray-100">{option}</p>
                                                {#if poll.votes}
                                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                        {voteCount} vote{voteCount === 1 ? '' : 's'} · {percentage.toFixed(1)}%
                                                    </p>
                                                {/if}
                                            </div>
                                            <div class="flex items-center gap-2">
                                                {#if isVoted}
                                                    <span class="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-500/20">
                                                        <i class="fas fa-check text-blue-600 dark:text-blue-400 text-sm"></i>
                                                    </span>
                                                {/if}
                                                {#if isWinner}
                                                    <span class="flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-500/20">
                                                        <i class="fas fa-trophy text-yellow-600 dark:text-yellow-400 text-sm"></i>
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            {/each}
                        </div>
                        <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{totalVotes} total vote{totalVotes === 1 ? '' : 's'}</span>
                                <span>{poll.publicVoting ? 'Public' : 'Private'} Poll</span>
                            </div>
                            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <i class="far fa-clock"></i>
                                <span>{pollWinner !== undefined ? 'Ended' : 'Ends'}: {new Date(poll.endTime).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Actions Section -->
                <div class="flex items-center justify-between mt-4">
                    <Reactions canReact={canComment} message={message} />
                    {#if canComment && !showComments}
                        <button 
                            type="button"
                            class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-500 transition-colors"
                            on:click={() => showComments = true}
                        >
                            <i class="far fa-comment"></i>
                            <span>Reply</span>
                        </button>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Comments Section -->
        {#if (message.comments && message.comments.length > 0) || (canComment && showComments)}
            <div class="mt-6 pl-16">
                <Timeline>
                    {#each message.comments ?? [] as comment}
                        <TimelineItem>
                            <div class="pb-6">
                                <div class="flex items-start gap-4">
                                    <button 
                                        on:click|stopPropagation={() => goto(`/portfolio/${comment.walletId}`)} 
                                        on:keydown|stopPropagation={(e) => e.key === 'Enter' && goto(`/portfolio/${comment.walletId}`)}
                                        class="relative flex-shrink-0 w-10 h-10 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-blue-500 transition-all duration-200"
                                    >
                                        <img 
                                            src={getImageUrl(nfds.find(nfd => nfd.key === comment.walletId)?.avatar ?? '/blank_avatar_small.png',240)} 
                                            alt="User avatar"
                                            class="w-full h-full object-cover"
                                        />
                                    </button>
                                    <div class="flex-1">
                                        <div class="flex items-center gap-3 mb-2">
                                            <a 
                                                href={`/portfolio/${comment.walletId}`}
                                                on:click|preventDefault|stopPropagation={() => goto(`/portfolio/${comment.walletId}`)}
                                                on:keydown|stopPropagation={(e) => e.key === 'Enter' && goto(`/portfolio/${comment.walletId}`)}
                                                class="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                            >
                                                {nfds.find(nfd => nfd.key === comment.walletId)?.replacementValue ?? (comment.walletId.slice(0, 8) + '...' + comment.walletId.slice(-8))}
                                            </a>
                                            <span class="text-xs text-gray-500 dark:text-gray-400" title={new Date(comment.timestamp).toLocaleString()}>
                                                {timeSince(comment.timestamp)}
                                            </span>
                                        </div>
                                        <div class="prose prose-sm dark:prose-invert max-w-none mb-3">
                                            <Markdown source={comment.comment} renderers={{ link: ExternalLink }} />
                                        </div>
                                        <Reactions comment={comment} message={message} />
                                    </div>
                                </div>
                            </div>
                        </TimelineItem>
                    {/each}

                    {#if canComment && showComments}
                        <TimelineItem>
                            <div class="relative flex flex-col gap-3">
                                <div class="flex items-start gap-4">
                                    <button 
                                        class="text-xl text-gray-400 hover:text-blue-500 transition-colors" 
                                        on:click|stopPropagation={() => showEmojiPicker = !showEmojiPicker}
                                        aria-label="Emoji picker"
                                    >
                                        <i class="far fa-smile"></i>
                                    </button>
                                    <textarea 
                                        bind:this={commentTextarea}
                                        class="flex-1 min-h-[80px] p-3 bg-gray-50 dark:bg-gray-700 rounded-lg resize-none border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                        placeholder="Add a comment..." 
                                        bind:value={messageComment}
                                    >
                                    </textarea>
                                </div>
                                <div class="flex justify-end gap-2">
                                    <Button on:click={() => showComments = false} color="alternative" size="xs">Cancel</Button>
                                    <Button on:click={handleComment} color="blue" size="xs">Reply</Button>
                                </div>
                                {#if showEmojiPicker}
                                    <div class="absolute top-full right-0 mt-2 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
                                        <EmojiPicker bind:value={messageComment}/>
                                    </div>
                                {/if}
                            </div>
                        </TimelineItem>
                    {/if}
                </Timeline>
            </div>
        {/if}
    </div>
{/if}
{#if showImageModal}
    <ImageModal 
        bind:showModal={showImageModal}
        imageUrl={selectedImage}
        altText="Message image"
    />
{/if}
<style>
    .relative:hover > div {
        --expand-opacity: 1;
    }
</style>