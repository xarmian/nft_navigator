<script lang="ts">
    import { onMount } from 'svelte';

    export let showModal: boolean;
    export let imageUrl: string;
    export let altText: string = '';

    let dialog: HTMLDialogElement;
    let imageContainer: HTMLDivElement;

    $: if (dialog && imageContainer) {
        if (showModal) {
            dialog.showModal();
        } else {
            dialog.close();
        }
    }

    function handleClick(event: MouseEvent) {
        // Close if click is outside the image container
        const target = event.target as HTMLElement;
        if (!imageContainer.contains(target) || target === imageContainer) {
            showModal = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            showModal = false;
        }
    }

    onMount(() => {
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        };
    });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog
    class="modal-container bg-transparent p-0 m-0 max-w-none w-screen h-screen backdrop:bg-black/80"
    bind:this={dialog}
    on:click={handleClick}
>
    <div 
        bind:this={imageContainer}
        class="w-full h-full flex items-center justify-center p-4"
    >
        <div class="relative max-w-4xl max-h-[80vh] bg-transparent">
            <!-- Close button -->
            <button
                class="absolute -top-4 -right-4 z-10 w-8 h-8 bg-white dark:bg-gray-800 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                on:click|stopPropagation={() => showModal = false}
            >
                <i class="fas fa-times text-gray-600 dark:text-gray-300"></i>
            </button>

            <img 
                src={imageUrl} 
                class="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg" 
                alt={altText}
            />
        </div>
    </div>
</dialog>

<style>
    dialog {
        border: none;
    }

    dialog::backdrop {
        backdrop-filter: blur(4px);
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
</style> 