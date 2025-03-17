<script lang="ts">
	import { invalidateAll } from "$app/navigation";
	import { onMount, onDestroy } from "svelte";
    //@ts-expect-error no types
    import EmojiPicker from "svelte-emoji-picker";
    import type { IPoll } from "$lib/data/types";

    export let onPost: (content: string, poll: null | IPoll, imageFiles: File[]) => Promise<boolean>;
    export let postPrivacy: 'Public' | 'Private' | 'All' = 'Public';
    export let postPrivacyValue = postPrivacy === 'All' ? 'Public' : postPrivacy;

    let showEmojiPicker = false;
    let showAddMenu = false;
    let chatInput = '';
    let textarea: HTMLTextAreaElement;
    let isDraggingOver = false;

    let showAddPoll = false;
    let pollOptions = ['', ''];

    let imageFiles: File[] = [];
    let fileInput: HTMLInputElement;
    let imageElements: HTMLImageElement[] = [];

    const MAX_IMAGES = 3;

    let isSubmitting = false;

    // Function to generate a unique identifier for a file
    function getFileIdentifier(file: File): string {
        return `${file.name}-${file.size}-${file.lastModified}`;
    }

    // Function to check if a file is already added
    function isFileAlreadyAdded(file: File): boolean {
        const newFileId = getFileIdentifier(file);
        return imageFiles.some(existingFile => getFileIdentifier(existingFile) === newFileId);
    }

    // Function to add new files, preventing duplicates
    async function addNewFiles(files: File[]) {
        const newFiles: File[] = [];
        const duplicates: string[] = [];

        for (const file of files) {
            if (imageFiles.length + newFiles.length >= MAX_IMAGES) break;
            
            if (!isFileAlreadyAdded(file)) {
                newFiles.push(file);
            } else {
                duplicates.push(file.name);
            }
        }

        if (duplicates.length > 0) {
            alert(`The following images are already added:\n${duplicates.join('\n')}`);
        }

        if (newFiles.length > 0) {
            imageFiles = [...imageFiles, ...newFiles];
            await displayImages();
        }
    }

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

        if (chatInput.trim() === '' && imageFiles.length === 0) {
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

        try {
            isSubmitting = true;
            const success = await onPost(chatInput, poll, imageFiles);

            if (success) {
                chatInput = '';
                pollOptions = ['', ''];
                poll_endTime = getPollEndTime();
                poll_voteWeight = 'wallet';
                poll_allowPublicVoting = false;
                showAddPoll = false;
                imageFiles = [];
                invalidateAll();
            }
        } catch (error) {
            console.error('Error submitting post:', error);
        } finally {
            isSubmitting = false;
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
        // Only show drag feedback if files are being dragged
        if (event.dataTransfer?.types.includes('Files')) {
            isDraggingOver = true;
        }
    }

    function handleDragLeave(event: DragEvent) {
        // Only reset drag feedback if we're leaving the form (not entering a child element)
        const form = event.currentTarget as HTMLFormElement;
        const relatedTarget = event.relatedTarget as Node | null;
        if (form && relatedTarget && !form.contains(relatedTarget)) {
            isDraggingOver = false;
        }
    }

    async function handleDrop(event: DragEvent) {
        event.preventDefault();
        isDraggingOver = false;

        if (event.dataTransfer && event.dataTransfer.items) {
            const files: File[] = [];
            for (let i = 0; i < event.dataTransfer.items.length; i++) {
                if (event.dataTransfer.items[i].kind === 'file') {
                    const file = event.dataTransfer.items[i].getAsFile();
                    if (file) files.push(file);
                }
            }
            await addNewFiles(files);
        }
    }

    async function handlePaste(event: ClipboardEvent) {
        if (event.clipboardData && event.clipboardData.items) {
            const files: File[] = [];
            for (let i = 0; i < event.clipboardData.items.length; i++) {
                if (event.clipboardData.items[i].type.indexOf('image') === 0) {
                    const file = event.clipboardData.items[i].getAsFile();
                    if (file) {
                        files.push(file);
                        break;
                    }
                }
            }
            await addNewFiles(files);
        }
    }

    async function displayImages() {
        for (let i = 0; i < imageFiles.length; i++) {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (imageElements[i]) {
                    imageElements[i].src = String(event.target?.result);
                }
            };
            reader.readAsDataURL(imageFiles[i]);
        }
    }

    function removeImage(index: number) {
        imageFiles = imageFiles.filter((_, i) => i !== index);
        if (imageElements[index]) {
            imageElements[index].src = '';
        }
    }

    function handleButtonClick() {
        setTimeout(() => {
            showAddMenu = false;
        }, 100);
        fileInput.click();
    }

    function handleFileChange() {
        if (fileInput.files && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            addNewFiles(files);
        }
        // Reset file input to allow selecting the same file again
        fileInput.value = '';
    }

</script>

<form 
    on:submit={handleSubmit}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    class="relative w-full sm:w-3/4 place-self-center"
>
    <div class="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 border dark:border-slate-700 relative {isDraggingOver ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}">
        {#if isSubmitting}
            <div class="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-2xl backdrop-blur-sm z-50">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-gray-600 dark:text-gray-300 font-medium">Submitting post...</p>
                </div>
            </div>
        {/if}
        {#if isDraggingOver}
            <div class="absolute inset-0 flex items-center justify-center bg-blue-500/10 rounded-2xl backdrop-blur-sm z-10">
                <div class="text-xl font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <span>Drop images here</span>
                </div>
            </div>
        {/if}
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
                        <div class="absolute top-0 left-7 z-50 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 messages-add-menu">
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
                    on:paste={handlePaste}
                ></textarea>

                <!-- Image Preview -->
                {#if imageFiles.length > 0}
                    <div class="relative mt-4">
                        <div class="overflow-x-auto">
                            <div class="flex gap-4 min-w-0">
                                {#each imageFiles as _, i (i)}
                                    <div class="relative group flex-shrink-0 w-48">
                                        <div class="relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                                            <img 
                                                bind:this={imageElements[i]} 
                                                class="h-48 w-48 object-cover" 
                                                alt="Preview {i + 1}"
                                            />
                                            <button
                                                type="button"
                                                class="absolute top-2 right-2 p-2 rounded-full bg-gray-900/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-900/80"
                                                on:click={() => removeImage(i)}
                                                aria-label="Remove image"
                                            >
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                        {#if imageFiles.length < MAX_IMAGES}
                            <button
                                type="button"
                                class="mt-4 w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:text-blue-500 hover:border-blue-500 transition-colors"
                                on:click={handleButtonClick}
                            >
                                <i class="fas fa-plus mr-2"></i>
                                Add Another Image ({MAX_IMAGES - imageFiles.length} remaining)
                            </button>
                        {/if}
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
    <input bind:this={fileInput} type="file" id="fileInput" name="fileInput" accept="image/*" class="hidden" on:change={handleFileChange} multiple />
</form>

<style>
    /* Add a smooth transition for the drag feedback */
    form > div {
        transition: all 0.2s ease-in-out;
    }
</style>
