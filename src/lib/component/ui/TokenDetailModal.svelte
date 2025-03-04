<!-- TokenDetailModal.svelte -->
<script lang="ts">
    import type { Token, Collection, Listing } from '$lib/data/types';
    import TokenDetailPage from './TokenDetailPage.svelte';
    import { fade, scale } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { onMount } from 'svelte';

    export let showModal = false;
    export let token: Token;
    export let collection: Collection | undefined;
    export let listing: Listing | null = null;
    export let showMenuIcon = true;

    let modalContent: HTMLElement;
    let scrollY: number;

    function closeModal() {
        showModal = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    function handleClickOutside(event: MouseEvent) {
        if (modalContent && !modalContent.contains(event.target as Node)) {
            closeModal();
        }
    }

    onMount(() => {
        document.addEventListener('keydown', handleKeydown);
        if (typeof window !== 'undefined') {
            scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        }

        return () => {
            document.removeEventListener('keydown', handleKeydown);
            if (typeof window !== 'undefined') {
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                window.scrollTo(0, scrollY);
            }
        };
    });
</script>

{#if showModal}
    <div class="fixed inset-0 z-50" 
         transition:fade={{ duration: 200 }}
         on:click={handleClickOutside}>
        <!-- Backdrop with blur -->
        <div class="fixed inset-0 bg-black/80 backdrop-blur-sm"
             transition:fade={{ duration: 150 }}>
        </div>

        <!-- Modal Container with padding and scrolling -->
        <div class="fixed inset-0 overflow-y-auto">
            <div class="flex min-h-full items-center justify-center p-4">
                <!-- Modal Content -->
                <div class="relative w-full max-w-5xl bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
                     bind:this={modalContent}
                     transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}>
                    
                    <!-- Header Bar with controls - Now sticky -->
                    <div class="sticky top-0 z-20 px-4 py-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
                        <!-- Full Page Link -->
                        <a href="/collection/{token.contractId}/token/{token.tokenId}"
                           class="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/90 hover:bg-purple-700/90 text-white rounded-lg transition-colors">
                            <i class="fas fa-external-link-alt"></i>
                            <span>View Full Page</span>
                        </a>

                        <!-- Close Button -->
                        <button 
                            class="p-2 text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            on:click={closeModal}>
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>

                    <!-- Scrollable Content Area -->
                    <div class="max-h-[85vh] overflow-y-auto">
                        <TokenDetailPage 
                            {token}
                            {collection}
                            {listing}
                            isModal={true}
                            {showMenuIcon}
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Hide scrollbar for Chrome, Safari and Opera */
    .overflow-y-auto::-webkit-scrollbar {
        display: none;
    }

    /* Hide scrollbar for IE, Edge and Firefox */
    .overflow-y-auto {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }
</style> 