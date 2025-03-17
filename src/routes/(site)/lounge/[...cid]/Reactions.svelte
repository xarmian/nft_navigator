<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { NMessage, NComment } from '$lib/data/types';
	import { toast } from '@zerodevx/svelte-toast';
	import { showConfetti } from '../../../../stores/collection';

    export let reactions = ['👍','👎','😂','😢','🔥','❤️'];
    export let canReact = true;
    export let message: NMessage | null = null;
    export let comment: NComment | null = null;

    let counts: { [key: number]: string } | undefined = {};
    let myReactions: number[] = [];

    $: {
        myReactions = [];
        if (comment) {
            counts = comment.reactions_json;
            comment.mcr?.forEach((mcr) => {
                myReactions = myReactions.concat(mcr.reaction);
            });
        }
        else if (message) {
            counts = message.reactions_json;
            message.mr?.forEach((mr) => {
                if (!mr.comments_id) myReactions = myReactions.concat(mr.reaction);
            });
        }
    }

    const submitReaction = async (reaction: number) => {
        // Optimistically update UI
        if (comment) {
            if (myReactions.indexOf(reaction) !== -1) {
                comment.mcr = comment.mcr?.filter((mcr) => mcr.reaction !== reaction);
                comment.reactions = comment.reactions?.map((r, i) => i === reaction ? r - 1 : r);
                if (counts) {
                    const currentCount = Number(counts[reaction] || 0);
                    counts[reaction] = Math.max(0, currentCount - 1).toString();
                }
            } else {
                comment.mcr?.push({ messages_id: message?.id, comments_id: comment?.id, reaction });
                comment.reactions = comment.reactions?.map((r, i) => i === reaction ? r + 1 : r);
                if (counts) {
                    const currentCount = Number(counts[reaction] || 0);
                    counts[reaction] = (currentCount + 1).toString();
                }
            }
            comment = comment;
        }
        else if (message) {
            if (myReactions.indexOf(reaction) !== -1) {
                message.mr = message.mr?.filter((mr) => mr.reaction !== reaction);
                message.reactions = message.reactions?.map((r, i) => i === reaction ? r - 1 : r);
                if (counts) {
                    const currentCount = Number(counts[reaction] || 0);
                    counts[reaction] = Math.max(0, currentCount - 1).toString();
                }
            } else {
                message.mr?.push({ reaction });
                message.reactions = message.reactions?.map((r, i) => i === reaction ? r + 1 : r);
                if (counts) {
                    const currentCount = Number(counts[reaction] || 0);
                    counts[reaction] = (currentCount + 1).toString();
                }
            }
            message = message;
        }

        try {
            const response = await fetch(`/api/lounge/${message?.collectionId}/reaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: message?.id,
                    commentId: comment?.id || 0,
                    reaction: reaction,
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error.message);
                // Revert optimistic update on error
                if (comment) {
                    if (myReactions.indexOf(reaction) !== -1) {
                        comment.mcr?.push({ messages_id: message?.id, comments_id: comment?.id, reaction });
                        comment.reactions = comment.reactions?.map((r, i) => i === reaction ? r + 1 : r);
                        if (counts) {
                            const currentCount = Number(counts[reaction] || 0);
                            counts[reaction] = (currentCount + 1).toString();
                        }
                    } else {
                        comment.mcr = comment.mcr?.filter((mcr) => mcr.reaction !== reaction);
                        comment.reactions = comment.reactions?.map((r, i) => i === reaction ? r - 1 : r);
                        if (counts) {
                            const currentCount = Number(counts[reaction] || 0);
                            counts[reaction] = Math.max(0, currentCount - 1).toString();
                        }
                    }
                    comment = comment;
                }
                else if (message) {
                    if (myReactions.indexOf(reaction) !== -1) {
                        message.mr?.push({ reaction });
                        message.reactions = message.reactions?.map((r, i) => i === reaction ? r + 1 : r);
                        if (counts) {
                            const currentCount = Number(counts[reaction] || 0);
                            counts[reaction] = (currentCount + 1).toString();
                        }
                    } else {
                        message.mr = message.mr?.filter((mr) => mr.reaction !== reaction);
                        message.reactions = message.reactions?.map((r, i) => i === reaction ? r - 1 : r);
                        if (counts) {
                            const currentCount = Number(counts[reaction] || 0);
                            counts[reaction] = Math.max(0, currentCount - 1).toString();
                        }
                    }
                    message = message;
                }
            } else if (data.isFirstAction) {
                showConfetti.set(true);
                toast.push(`Congratulations! The React to a Post Quest has been Completed!`);
                setTimeout(() => {
                    showConfetti.set(false)
                }, 10000);
            }
        } catch (error) {
            console.error('Error submitting reaction:', error);
            alert('Failed to submit reaction. Please try again.');
        }
    };
</script>
<div class="flex items-start gap-2">
    {#each reactions as reaction, i}
        <button
            on:click={canReact ? () => submitReaction(i) : undefined}
            class="p-1 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center space-x-2 border 
            {canReact 
                ? 'border-gray-400 dark:border-gray-500  hover:border-gray-500 dark:hover:border-gray-300' 
                : 'cursor-default border-gray-100 dark:border-gray-700'}"
            class:!bg-yellow-800={myReactions.indexOf(i) !== -1}>
            <div>{reaction}</div>
            {#if counts && (Number(counts[i]??0)) > 0}
                <div class="text-xs">{counts[i]}</div>
            {/if}
        </button>
    {/each}
</div>
<style>
</style>