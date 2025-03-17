<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { onMount, onDestroy } from "svelte";
    //@ts-expect-error no types
    import EmojiPicker from "svelte-emoji-picker";
    import type { IPoll } from "$lib/data/types";

    export let onPost: (content: string, poll: null | IPoll, imageFile: File | null) => Promise<boolean>;
    export let postPrivacy: 'Public' | 'Private' | 'All' = 'Public';
    $: postPrivacyValue = postPrivacy === 'All' ? 'Public' : postPrivacy;

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

<form 
    on:submit={handleSubmit} 
    class="relative w-full sm:w-3/4 place-self-center"
>
    <div class="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border dark:border-slate-700">
        <!-- Main Input Area -->
        <div class="flex items-start gap-4">
            <!-- Action Buttons -->
            <div class="flex flex-col gap-3 pt-2">
                <button
                    type="button"
                    class="text-xl text-gray-400 hover:text-blue-500 transition-colors"
                    on:click|stopPropagation={() => showEmojiPicker = !showEmojiPicker}
                    aria-label="Add emoji"
                >
                    <i class="far fa-smile"></i>
                </button>
                <div class="relative">
                    <button
                        type="button"
                        class="text-xl text-gray-400 hover:text-blue-500 transition-colors"
                        on:click|stopPropagation={() => showAddMenu = !showAddMenu}
                        aria-label="Add content"
                    >
                        <i class="fas fa-plus-circle"></i>
                    </button>
                    {#if showAddMenu}
                        <div class="absolute top-0 left-7 z-50 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2">
                            <button 
                                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                on:click|preventDefault={() => showAddPoll = true}
                            >
                                <i class="fas fa-chart-pie"></i>
                                Add Poll
                            </button>
                            <button 
                                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                on:click|preventDefault={handleButtonClick}
                            >
                                <i class="fas fa-image"></i>
                                Add Image
                            </button>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Text Input Area -->
            <div class="flex-1">
                <textarea
                    bind:this={textarea}
                    name="message"
                    class="w-full min-h-[80px] p-3 bg-gray-50 dark:bg-gray-700 rounded-lg resize-none border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="What's on your mind?"
                    bind:value={chatInput}
                    on:input={adjustTextareaHeight}
                    on:dragover={handleDragOver}
                    on:drop={handleDrop}
                    on:paste={handlePaste}
                ></textarea>

                <!-- Image Preview -->
                {#if imageFile}
                    <div class="relative mt-4 group">
                        <div class="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                            <img 
                                bind:this={imageElement} 
                                class="max-h-64 w-full object-contain" 
                                alt="Preview"
                            />
                            <button
                                type="button"
                                class="absolute top-2 right-2 p-2 rounded-full bg-gray-900/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-900/80"
                                on:click={removeImage}
                                aria-label="Remove image"
                            >
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Post Controls -->
            <div class="flex flex-col gap-2">
                <select 
                    name="privacy" 
                    class="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    bind:value={postPrivacyValue}
                >
                    <option value="Public" disabled={postPrivacy === 'Private'}>Public</option>
                    <option value="Private" disabled={postPrivacy === 'Public'}>Private</option>
                </select>
                <button 
                    type="submit"
                    class="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                    <i class="fas fa-paper-plane"></i>
                    <span>Post</span>
                </button>
            </div>
        </div>

        <!-- Emoji Picker -->
        {#if showEmojiPicker}
            <div class="absolute top-20 left-12 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
                <EmojiPicker bind:value={chatInput}/>
            </div>
        {/if}

        <!-- Poll Interface -->
        {#if showAddPoll}
            <div class="mt-6 p-6 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Create Poll</h3>
                    <button 
                        type="button"
                        class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        on:click|preventDefault|stopPropagation={() => showAddPoll = false}
                        aria-label="Close poll creator"
                    >
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Poll Options -->
                <div class="space-y-4 mb-6">
                    {#each pollOptions as option, i}
                        <div class="flex items-center gap-2">
                            <div class="flex-1">
                                <input 
                                    type="text" 
                                    class="w-full p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                    placeholder={"Option " + (i + 1)} 
                                    bind:value={pollOptions[i]}
                                />
                            </div>
                            {#if i >= 2}
                                <button
                                    type="button"
                                    class="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                    on:click|preventDefault|stopPropagation={() => pollOptions = pollOptions.filter((_, index) => index !== i)}
                                    aria-label="Remove option"
                                >
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            {/if}
                        </div>
                    {/each}
                    <button
                        type="button"
                        class="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:text-blue-500 hover:border-blue-500 transition-colors"
                        on:click|preventDefault|stopPropagation={() => pollOptions = [...pollOptions, '']}
                    >
                        <i class="fas fa-plus mr-2"></i>
                        Add Option
                    </button>
                </div>

                <!-- Poll Settings -->
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label for="end-time" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                End Time
                            </label>
                            <input 
                                type="datetime-local" 
                                id="end-time" 
                                class="w-full p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                                bind:value={poll_endTime} 
                            />
                        </div>
                        <div class="space-y-2">
                            <label for="vote-weight" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Vote Weight
                            </label>
                            <select 
                                id="vote-weight"
                                class="w-full p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                bind:value={poll_voteWeight}
                            >
                                <option value="wallet">1 Vote per Wallet</option>
                                <!--<option value="token">1 Vote per NFT Token</option>-->
                            </select>
                        </div>
                    </div>

                    {#if postPrivacy === 'Public'}
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox" 
                                bind:checked={poll_allowPublicVoting} 
                                class="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <span class="text-sm text-gray-700 dark:text-gray-300">Allow Public Voting</span>
                        </label>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
    <input bind:this={fileInput} type="file" id="fileInput" name="fileInput" accept="image/*" class="hidden" on:change={handleFileChange} />
</form>
