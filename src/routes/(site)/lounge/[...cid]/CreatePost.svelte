<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { onMount, onDestroy } from "svelte";
    //@ts-expect-error no types
    import EmojiPicker from "svelte-emoji-picker";
    import type { IPoll } from "$lib/data/types";

    export let onPost: (content: string, poll: null | IPoll, imageFile: File | null) => Promise<boolean>;
    export let postPrivacy = 'Public';

    let showEmojiPicker = false;
    let showAddMenu = false;
    let chatInput = '';
    let textarea: HTMLTextAreaElement;

    let showAddPoll = false;
    let pollOptions = ['', ''];

    let imageFile: File | null = null;
    let fileInput: HTMLInputElement;
    let imageElement: HTMLImageElement;

    let getPollEndTime = () => {
        let endTime = new Date();
        endTime.setDate(endTime.getDate() + 1);

        let year = endTime.getFullYear();
        let month = String(endTime.getMonth() + 1).padStart(2, '0'); // months are 0-indexed in JavaScript
        let date = String(endTime.getDate()).padStart(2, '0');
        let hours = String(endTime.getHours()).padStart(2, '0');
        let minutes = String(endTime.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${date}T${hours}:${minutes}`;
    }
    let poll_endTime = getPollEndTime();
    let poll_voteWeight: 'wallet' | 'token' = 'wallet';
    let poll_allowPublicVoting = false;

    const handleSubmit = async (event: Event) => {
        event.preventDefault();
        let poll: IPoll | null = null;

        if (chatInput.trim() === '' && !imageFile) {
            alert(`${showAddPoll ? 'Question' : 'Message'} cannot be empty`);
            return;
        }

        // convert poll end time from user's local time to UTC
        let utc_poll_endTime = new Date(poll_endTime).toISOString();

        if (showAddPoll) {
            console.log(pollOptions);
            if (pollOptions.filter((option) => option.trim() !== '').length < 2) {
                alert('Poll must have at least 2 options');
                return;
            }

            if (new Date(poll_endTime).getTime() < Date.now()) {
                alert('Poll end time must be in the future');
                return;
            }

            // serialize poll options, end time, and vote weight
            poll = {
                options: Object.fromEntries(pollOptions.map((option, index) => [index, option.trim()]).filter(([_, option]) => option !== '')),
                endTime: utc_poll_endTime,
                voteWeight: poll_voteWeight,
                publicVoting: poll_allowPublicVoting,
            };
        }

        const success = await onPost(chatInput, poll, imageFile);

        if (success) {
            chatInput = '';
            pollOptions = ['', ''];
            poll_endTime = getPollEndTime();
            poll_voteWeight = 'wallet';
            poll_allowPublicVoting = false;
            showAddPoll = false;
            removeImage();
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

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    async function handleDrop(event: DragEvent) {
        event.preventDefault();

        if (event.dataTransfer && event.dataTransfer.items) {
            for (var i = 0; i < event.dataTransfer.items.length; i++) {
                if (event.dataTransfer.items[i].kind === 'file') {
                    imageFile = event.dataTransfer.items[i].getAsFile();
                    displayImage();
                    break;
                }
            }
        }
    }

    async function handlePaste(event: ClipboardEvent) {
        if (event.clipboardData && event.clipboardData.items) {
            for (var i = 0; i < event.clipboardData.items.length; i++) {
                if (event.clipboardData.items[i].type.indexOf('image') === 0) {
                    imageFile = event.clipboardData.items[i].getAsFile();
                    displayImage();
                    break;
                }
            }
        }
    }

    function displayImage() {
        const reader = new FileReader();
        reader.onload = (event) => {
            imageElement.src = String(event.target?.result);
        };
        if (imageFile) {
            reader.readAsDataURL(imageFile);
        }
    }

    function removeImage() {
        imageFile = null;
        if (imageElement && imageElement.src) imageElement.src = '';
    }

    function handleButtonClick() {
        setTimeout(() => {
            showAddMenu = false;
        },100);
        fileInput.click();
    }

    function handleFileChange() {
        if (fileInput.files && fileInput.files.length > 0) {
            imageFile = fileInput.files[0];
            displayImage();
        }
    }

</script>

<form on:submit={handleSubmit} class="p-2 py-5 mx-1 w-full sm:w-3/4 place-self-center flex flex-col bg-gray-50 dark:bg-gray-800 rounded-xl shadow relative border dark:border-slate-700">
    <div class="flex items-center">
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
                    <div class="absolute top-0 left-7 bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-600 border-2 rounded-lg text-sm whitespace-nowrap">
                        <ul class="space-y-1">
                            <li>
                                <button class="w-full text-left hover:bg-gray-200 hover:dark:bg-gray-800 py-1 px-2" on:click|preventDefault={() => showAddPoll = true}>Add Poll</button>
                            </li>
                            <li>
                                <button class="w-full text-left hover:bg-gray-200 hover:dark:bg-gray-800 py-1 px-2" on:click|preventDefault={handleButtonClick}>Add Image</button>
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
            placeholder="Type a {showAddPoll ? 'question' : 'message'}..."
            bind:value={chatInput}
            on:input={adjustTextareaHeight}
            on:dragover={handleDragOver}
            on:drop={handleDrop}
            on:paste={handlePaste}
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
        <input bind:this={fileInput} type="file" id="fileInput" name="fileInput" accept="image/*" class="hidden" on:change={handleFileChange} />
    </div>
    {#if imageFile}
        <div class="group relative flex self-center h-64 w-64 bg-black">
            <img bind:this={imageElement} class="mt-2 h-64 max-w-64 object-contain" />
            <div class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <i class="cursor-pointer rounded-full fas fa-times text-xl bg-gray-200 bg-opacity-60 hover:bg-opacity-70 p-2 text-black" on:click={removeImage}></i>
            </div>
        </div>
    {/if}
    {#if showAddPoll}
        <div class="flex flex-col mt-2 sm:m-4 p-2 border border-gray-500 rounded-lg relative space-y-2">
            <div class="text-lg">Add Poll</div>
            <button class="absolute top-2 right-2 p-1 border border-gray-500 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full w-8 h-8" on:click|preventDefault|stopPropagation={() => showAddPoll = false}>
                <i class="fas fa-times"></i>
            </button>
            <div class="flex flex-row space-x-2">
                <div class="flex flex-col space-y-2 flex-grow">
                    {#each pollOptions as option, i}
                        <input type="text" class="w-full p-2 bg-gray-100 dark:bg-gray-700 rounded-lg" placeholder={"Option " + (i + 1)} bind:value={pollOptions[i]}/>
                    {/each}
                </div>
                <div class="flex items-end mb-1">
                    <button class="bg-blue-500 hover:bg-blue-700 text-white py-1 px-4 rounded-lg" on:click|preventDefault|stopPropagation={() => pollOptions = [...pollOptions, '']}>+</button>
                </div>
            </div>
            <hr class="border-gray-300 dark:border-gray-600" />
            <div class="flex flex-col space-y-2">
                <div class="flex space-x-2 items-center">
                    <label for="end-time" class="text-sm w-28 text-end">End Time:</label>
                    <input type="datetime-local" id="end-time" class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg" bind:value={poll_endTime} />
                </div>
                <div class="flex items-center space-x-2">
                    <label for="vote-weight" class="text-sm w-28 text-end">Vote Weight:</label>
                    <select class="bg-gray-100 dark:bg-gray-700 rounded-lg" bind:value={poll_voteWeight}>
                        <option value="wallet">1 Vote per Wallet</option>
                        <!--<option value="token">1 Vote per NFT Token</option>-->
                    </select>
                </div>
                {#if postPrivacy == 'Public'}
                    <div class="flex items-center space-x-2">
                        <div class="w-32">&nbsp;</div>
                        <input type="checkbox" id="public-voting" bind:checked={poll_allowPublicVoting} class="rounded-lg" />
                        <label for="public-voting" class="text-sm">Allow Public Voting</label>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
</form>
