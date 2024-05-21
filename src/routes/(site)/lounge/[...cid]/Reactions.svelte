<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { NMessage, NComment } from '$lib/data/types';

    export let reactions = ['👍','👎','😂','😢','🔥'];
    export let canReact = true;
    export let message: NMessage | null = null;
    export let comment: NComment | null = null;

    let counts: number[] | undefined;
    let myReactions: number[] = [];

    $: {
        myReactions = [];
        if (comment) {
            counts = comment.reactions;
            comment.mcr?.forEach((mcr) => {
                myReactions = myReactions.concat(mcr.reaction);
            });
        }
        else if (message) {
            counts = message.reactions;
            message.mr?.forEach((mr) => {
                if (!mr.comments_id) myReactions = myReactions.concat(mr.reaction);
            });
        }
    }

    const submitReaction = async (reaction: number) => {
        if (comment) {
            if (myReactions.indexOf(reaction) !== -1) {
                comment.mcr = comment.mcr?.filter((mcr) => mcr.reaction !== reaction);
                comment.reactions = comment.reactions?.map((r, i) => i === reaction ? r - 1 : r);
            } else {
                comment.mcr?.push({ messages_id: message?.id, comments_id: comment?.id, reaction });
                comment.reactions = comment.reactions?.map((r, i) => i === reaction ? r + 1 : r);
            }
            comment = comment;
        }
        else if (message) {
            if (myReactions.indexOf(reaction) !== -1) {
                message.mr = message.mr?.filter((mr) => mr.reaction !== reaction);
                message.reactions = message.reactions?.map((r, i) => i === reaction ? r - 1 : r);
            } else {
                message.mr?.push({ reaction });
                message.reactions = message.reactions?.map((r, i) => i === reaction ? r + 1 : r);
            }
            message = message;
        }

        const response = await fetch('?/postReaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                messageId: String(message?.id??''),
                commentId: String(comment?.id??''),
                reaction: String(reaction),
            })
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error.message);
        } else {
            invalidateAll();
        }
    };
</script>
{#each reactions as reaction, i}
    <button
     on:click={canReact ? () => submitReaction(i) : undefined}
     class="p-1 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center space-x-2 border 
        {canReact 
            ? 'border-gray-400 dark:border-gray-500  hover:border-gray-500 dark:hover:border-gray-300' 
            : 'cursor-default border-gray-100 dark:border-gray-700'}"
     class:!bg-yellow-800={myReactions.indexOf(i) !== -1}>
        <div>{reaction}</div>
        {#if counts && (counts[i]??0) > 0}
            <div class="text-xs">{counts[i]}</div>
        {/if}
    </button>
{/each}
<style>
</style>