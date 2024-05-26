<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { onMount, onDestroy } from "svelte";
    //@ts-expect-error no types
    import EmojiPicker from "svelte-emoji-picker";

    export let onPost: (content: string) => Promise<boolean>;
    export let postPrivacy = 'Public';

    let showEmojiPicker = false;
    let showAddMenu = false;
    let chatInput = '';
    let textarea: HTMLTextAreaElement;

    const handleSubmit = async (event: Event) => {
        event.preventDefault();
        const success = await onPost(chatInput);

        if (success) {
            chatInput = '';
            invalidateAll();
        }
    };

    function handleClick(event: MouseEvent) {
        if (showEmojiPicker && !(event.target as Element)?.closest('.emoji-picker')) {
            showEmojiPicker = false;
        }
        else if (showAddMenu && !(event.target as Element)?.closest('.messages-add-menu')) {
            showAddMenu = false;
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


    const adjustTextareaHeight = () => {
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };
</script>

<form on:submit={handleSubmit} class="p-2 py-5 mb-4 mx-1 w-full sm:w-3/4 place-self-center flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl shadow relative border dark:border-slate-700">
    <div class="flex flex-col justify-between">
        <div class="relative text-xl mr-2 cursor-pointer" on:click|stopPropagation={() => showEmojiPicker = !showEmojiPicker}>
            <i class="far fa-smile"></i>
            {#if showEmojiPicker}
                <div class="absolute top-0 left-7 w-96 z-20 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 border-2 p-2 rounded-lg">
                    <EmojiPicker bind:value={chatInput}/>
                </div>
            {/if}
        </div>
        <div class="relative text-xl mr-2 cursor-pointer" on:click|stopPropagation={() => showAddMenu = !showAddMenu}>
            <i class="fas fa-plus-circle"></i>
            {#if showAddMenu}
                <div class="absolute top-0 left-7 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 border-2 p-2 rounded-lg text-sm whitespace-nowrap">
                    <ul class="space-y-2">
                        <li>
                            <button class="w-full text-left">Add Poll</button>
                        </li>
                    </ul>
                </div>
            {/if}
        </div>
    </div>
    <textarea
        bind:this={textarea}
        name="message"
        class="flex-grow bg-gray-100 dark:bg-gray-700 rounded-lg p-2 mr-2"
        placeholder="Type a message..."
        bind:value={chatInput}
        on:input={adjustTextareaHeight}
    ></textarea>
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
