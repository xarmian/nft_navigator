<!-- TokenDetailModal.svelte -->
<script lang="ts">
    import type { Token, Collection, Listing } from '$lib/data/types';
    import TokenDetailPage from './TokenDetailPage.svelte';
    import { scale } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { onMount, onDestroy, tick } from 'svelte';

    export let showModal = false;
    export let token: Token;
    export let collection: Collection | undefined;
    export let listing: Listing | null = null;
    export let showMenuIcon = true;

    let dialog: HTMLDialogElement;
    let contentArea: HTMLElement;
    let scrollY: number;
    
    // Detect scroll direction and limits
    let lastScrollTop = 0;
    let isScrollingUp = false;
    let isAtTop = true;
    let isAtBottom = false;
    
    function handleScroll(event: Event) {
        if (!contentArea) return;
        
        const scrollTop = contentArea.scrollTop;
        isScrollingUp = scrollTop < lastScrollTop;
        isAtTop = scrollTop <= 0;
        isAtBottom = scrollTop + contentArea.clientHeight >= contentArea.scrollHeight;
        
        lastScrollTop = scrollTop;
    }

    function closeModal() {
        showModal = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    function handleBackdropClick(event: MouseEvent) {
        // Only close if clicked directly on the dialog backdrop
        if (event.target === dialog) {
            closeModal();
        }
    }

    // Lock body scroll when modal is open
    function lockBodyScroll() {
        if (typeof window !== 'undefined') {
            scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.overflow = 'hidden';
        }
    }

    // Unlock body scroll when modal is closed
    function unlockBodyScroll() {
        if (typeof window !== 'undefined') {
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.top = '';
            document.body.style.overflow = '';
            window.scrollTo(0, scrollY);
        }
    }

    // Watch showModal changes and open/close dialog
    $: if (dialog) {
        if (showModal) {
            dialog.showModal();
            lockBodyScroll();
            
            // Reset scroll state
            lastScrollTop = 0;
            isScrollingUp = false;
            isAtTop = true;
            isAtBottom = false;
            
            // Wait for the DOM to update, then add scroll listener
            tick().then(() => {
                if (contentArea) {
                    contentArea.addEventListener('scroll', handleScroll, { passive: true });
                }
            });
        } else {
            dialog.close();
            unlockBodyScroll();
            
            if (contentArea) {
                contentArea.removeEventListener('scroll', handleScroll);
            }
        }
    }

    onMount(() => {
        document.addEventListener('keydown', handleKeydown);
    });

    onDestroy(() => {
        document.removeEventListener('keydown', handleKeydown);
        
        if (contentArea) {
            contentArea.removeEventListener('scroll', handleScroll);
        }
        
        unlockBodyScroll();
    });
</script>

<!-- 
  Using the HTML dialog element for proper modal behavior and stacking context
-->
<dialog 
    bind:this={dialog}
    class="token-detail-dialog"
    on:click={handleBackdropClick}
    on:close={() => { showModal = false; }}
>
    <div class="dialog-container">
        <!-- Modal Content -->
        <div 
            class="modal-content bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
            transition:scale={{ duration: 300, easing: quintOut, start: 0.95 }}
        >
            <!-- Header Bar with controls -->
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
                    on:click|stopPropagation={closeModal}
                    aria-label="Close">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>

            <!-- Scrollable Content Area -->
            <div 
                class="content-area h-[85vh] overflow-y-auto"
                bind:this={contentArea}
            >
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
</dialog>

<style>
    /* Dialog styles */
    dialog {
        max-width: 100vw;
        max-height: 100vh;
        height: 100vh;
        width: 100vw;
        padding: 0;
        margin: 0;
        border: none;
        background: transparent;
        overflow: hidden;
    }

    /* Backdrop styling */
    dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(4px);
    }

    /* Container for modal */
    .dialog-container {
        width: 100%;
        height: 100%;
        padding: 1rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Modal content sizing */
    .modal-content {
        width: 100%;
        max-width: 1280px; /* 5xl in Tailwind */
    }

    /* Set up the scrollable content area */
    .content-area {
        /* Enhanced touch scrolling */
        -webkit-overflow-scrolling: touch;
        /* Smooth scrolling on modern browsers */
        scroll-behavior: smooth;
        /* Keep scroll within this element */
        overscroll-behavior: contain;
        /* Prevent content from being selected during scroll */
        user-select: text;
    }

    /* Hide scrollbar for Chrome, Safari and Opera */
    .content-area::-webkit-scrollbar {
        display: none;
    }

    /* Hide scrollbar for IE, Edge and Firefox */
    .content-area {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }

    /* For browsers that don't fully support dialog::backdrop */
    @supports not (dialog::backdrop) {
        dialog {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
        }

        dialog:before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(4px);
            z-index: -1;
        }
    }
</style> 