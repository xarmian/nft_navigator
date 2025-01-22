<script lang="ts">
	export let showModal: boolean; // boolean
	export let title: string | null = null;
	export let focusCloseButton: boolean = true;
    export let showTopCloseButton: boolean = false;
    export let showBottomCloseButton: boolean = true;

    export let onClose: () => void = () => {};
	let dialog: HTMLDialogElement;

	$: if (dialog) {
        if (showModal) {
            dialog.showModal();
        } else {
            dialog.close();
        }
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
    class="modal-container dark:bg-gray-800 dark:text-white"
	bind:this={dialog}
	on:close={() => {
        showModal = false;
        onClose();
    }}
	on:click|self={() => dialog.close()}
>
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div on:click|stopPropagation>
        <div class="flex flex-row justify-between">
            <div class="flex flex-col place-self-center">
                {#if title}
                    <h2 class="dark:text-white">{title}</h2>
                {/if}        
                <slot name="header" />
            </div>
            {#if showTopCloseButton}
                <div class="flex flex-col">
                    <button class="close-button !px-3 !py-1 mb-1 dark:bg-blue-600 dark:hover:bg-blue-700" on:click={() => dialog.close()} aria-label="Close modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            {/if}
        </div>
        <hr class="dark:border-gray-600" />
		<slot />
        {#if showBottomCloseButton}
            <hr class="mb-3 dark:border-gray-600" />
            <!-- svelte-ignore a11y-autofocus -->
            <div class="flex justify-end">
                <button autofocus={focusCloseButton} class="close-button dark:bg-blue-600 dark:hover:bg-blue-700" on:click={() => dialog.close()}>Close</button>
            </div>
        {/if}
	</div>
</dialog>

<style lang="postcss">
    dialog {
        border-radius: 4px;
        border: none;
        padding: 0;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        background: white;
    }
    .close-button {
        padding: 10px 20px;
        font-size: 16px;
        color: white;
        background-color: #007BFF;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    .close-button:hover {
        background-color: #0056b3;
    }
    dialog::backdrop {
        background: rgba(0, 0, 0, 0.3);
    }
    dialog > div {
        padding: 1em;
    }
    dialog[open] {
        animation: zoom 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes zoom {
        from {
            transform: scale(0.95);
        }
        to {
            transform: scale(1);
        }
    }
    dialog[open]::backdrop {
        animation: fade 0.2s ease-out;
    }
    @keyframes fade {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    button {
        display: block;
    }
    .modal-container {
        overflow: visible !important;
    }
</style>
