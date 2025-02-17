<script lang="ts">
	import type { PageData } from './$types';
	import TokenDetailPage from '$lib/component/ui/TokenDetailPage.svelte';
    import FanIcon from '$lib/component/ui/icons/FanIcon.svelte';
    import Share from '$lib/component/ui/Share.svelte';

    export let data: PageData;
    let token = data.token;
    let collection = data.collection;
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Breadcrumb Navigation -->
    <div class="bg-white/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center h-16 justify-between">
                <nav class="flex" aria-label="Breadcrumb">
                    <ol class="flex items-center space-x-4">
                        <li>
                            <div>
                                <a href="/" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                                    <i class="fas fa-home"></i>
                                    <span class="sr-only">Home</span>
                                </a>
                            </div>
                        </li>
                        <li>
                            <div class="flex items-center">
                                <i class="fas fa-chevron-right text-gray-400 text-sm"></i>
                                <a href="/collection/{token?.contractId}" class="ml-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-2 whitespace-nowrap">
                                    <FanIcon />
                                    <span>{collection?.highforgeData?.title || 'Collection'}</span>
                                </a>
                            </div>
                        </li>
                        <li>
                            <div class="flex items-center">
                                <i class="fas fa-chevron-right text-gray-400 text-sm"></i>
                                <span class="ml-4 text-gray-700 dark:text-gray-200 font-medium whitespace-nowrap">
                                    {token?.metadata?.name || `Token ${token?.tokenId}`}
                                </span>
                            </div>
                        </li>
                    </ol>
                </nav>
                <div class="flex items-center">
                    {#if token}
                        <Share url={`https://nftnavigator.xyz/collection/${token.contractId}/token/${token.tokenId}`} 
                               text="Check out {token.metadata?.name??String(token.tokenId)} on NFT Navigator @voinftnavigator! #Voiagers #VoiNFTs" />
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {#if token && collection}
            <TokenDetailPage {token} {collection} format="large" />
        {/if}
    </div>
</div>

<style>
    /* Smooth transitions */
    .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 300ms;
    }

    /* Sticky header backdrop blur */
    .backdrop-blur-md {
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }
</style>
