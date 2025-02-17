<script lang="ts">
    import type { Token, Collection } from '$lib/data/types';
    import Modal from './Modal.svelte';
    import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
    import { onMount, onDestroy } from 'svelte';
    
    export let showModal: boolean;
    export let tokens: Token[] = [];
    export let collectionName: string;
    export let collection: Collection | undefined;
    export let onClose: () => void = () => {};

    let currentPage = 1;
    let itemsPerPage = 12;
    let modalContent: HTMLElement;
    $: totalPages = Math.ceil(tokens.length / itemsPerPage);
    $: contractId = tokens[0]?.contractId;

    function handleScroll(event: WheelEvent) {
        const { deltaY } = event;
        const { scrollTop, scrollHeight, clientHeight } = modalContent;
        
        // Prevent scroll propagation when:
        // 1. Scrolling up and we're at the top
        // 2. Scrolling down and we're at the bottom
        if (
            (deltaY < 0 && scrollTop <= 0) ||
            (deltaY > 0 && scrollTop + clientHeight >= scrollHeight)
        ) {
            event.preventDefault();
        }
    }

    onMount(() => {
        if (modalContent) {
            modalContent.addEventListener('wheel', handleScroll, { passive: false });
        }
    });

    onDestroy(() => {
        if (modalContent) {
            modalContent.removeEventListener('wheel', handleScroll);
        }
    });

    function handlePageChange(newPage: number) {
        if (newPage >= 1 && newPage <= totalPages) {
            currentPage = newPage;
            // Scroll to top of modal content
            if (modalContent) {
                modalContent.scrollTop = 0;
            }
        }
    }

    function getPageNumbers() {
        const pages = [];
        const showPages = 5;
        
        let start = Math.max(1, currentPage - Math.floor(showPages / 2));
        let end = Math.min(totalPages, start + showPages - 1);
        
        if (end - start + 1 < showPages) {
            start = Math.max(1, end - showPages + 1);
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        return pages;
    }
</script>

<Modal bind:showModal title="{collectionName} - {tokens.length} Items" {onClose} showBottomCloseButton={false}>
    <div class="flex flex-col">
        <div class="modal-content w-full max-w-6xl mx-auto max-h-[calc(90vh-12rem)] overflow-y-auto" bind:this={modalContent}>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {#each tokens.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) as token (String(token.contractId) + '_' + String(token.tokenId))}
                    <TokenDetail {token} collection={collection} />
                {/each}
            </div>
        </div>

        <div class="flex flex-col items-center gap-4 pt-4 mt-4 border-t dark:border-gray-600">
            {#if totalPages > 1}
                <div class="flex justify-center gap-2">
                    <button 
                        class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                        disabled={currentPage === 1}
                        on:click={() => handlePageChange(currentPage - 1)}
                    >
                        Previous
                    </button>
                    
                    {#each getPageNumbers() as pageNum}
                        <button 
                            class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 
                                   {currentPage === pageNum ? 'bg-blue-500 text-white' : ''}"
                            on:click={() => handlePageChange(pageNum)}
                        >
                            {pageNum}
                        </button>
                    {/each}
                    
                    <button 
                        class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-50"
                        disabled={currentPage === totalPages}
                        on:click={() => handlePageChange(currentPage + 1)}
                    >
                        Next
                    </button>
                </div>
            {/if}

            <div class="flex items-center gap-4">
                <a 
                    href="/collection/{contractId}" 
                    class="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                    on:click={() => showModal = false}
                >
                    View Collection
                </a>
                <button 
                    class="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors duration-200"
                    on:click={() => showModal = false}
                >
                    Close
                </button>
            </div>
        </div>
    </div>
</Modal>

<style>
    .modal-content {
        scrollbar-width: thin;
        scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
    }
    .modal-content::-webkit-scrollbar {
        width: 6px;
    }
    .modal-content::-webkit-scrollbar-track {
        background: transparent;
    }
    .modal-content::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 3px;
    }
</style> 