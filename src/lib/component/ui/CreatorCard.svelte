<script lang="ts">
    import { goto } from '$app/navigation';
    import { getImageUrl } from '$lib/utils/functions';
    import type { Collection } from '$lib/data/types';

    export let creator: {
        address: string;
        name?: string;
        metadata?: {
            avatar?: string;
            description?: string;
            url?: string;
            'com.twitter'?: string;
        };
        collections: Collection[];
    };

    function handleClick() {
        goto(`/creator/${creator.address}`);
    }

    $: totalNFTs = creator.collections.reduce((sum, collection) => sum + collection.totalSupply, 0);
    $: totalOwners = creator.collections.reduce((sum, collection) => sum + (collection.uniqueOwners || 0), 0);
</script>

<button 
    on:click={handleClick}
    class="group relative w-full bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-200"
>
    <!-- Background Image -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30">
        {#if creator.metadata?.avatar}
            <img 
                src={getImageUrl(creator.metadata.avatar, 100)} 
                alt="Background" 
                class="w-full h-full object-cover opacity-20 dark:opacity-30 blur-sm"
            >
        {/if}
    </div>

    <!-- Content -->
    <div class="relative p-6">
        <!-- Creator Info -->
        <div class="flex items-center gap-4 mb-4">
            <!-- Avatar -->
            <div class="relative">
                {#if creator.metadata?.avatar}
                    <img 
                        src={getImageUrl(creator.metadata.avatar, 100)} 
                        alt={creator.name || creator.address} 
                        class="w-16 h-16 rounded-full object-cover border-4 border-white/10"
                    >
                {:else}
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                        <i class="fas fa-palette text-2xl text-white"></i>
                    </div>
                {/if}
            </div>

            <!-- Name and Address -->
            <div class="flex-1 min-w-0">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {creator.name || creator.address.slice(0, 6) + '...' + creator.address.slice(-4)}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    {creator.address.slice(0, 6) + '...' + creator.address.slice(-4)}
                </p>
            </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="text-center">
                <div class="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {creator.collections.length}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300">Collections</div>
            </div>
            <div class="text-center">
                <div class="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                    {totalNFTs}
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-300">Tokens Created</div>
            </div>
        </div>

        <!-- Description -->
        {#if creator.metadata?.description}
            <p class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-4">
                {creator.metadata.description}
            </p>
        {/if}

        <!-- Social Links -->
        {#if creator.metadata}
            <div class="flex flex-wrap gap-2">
                {#if creator.metadata.url}
                    <a 
                        href={creator.metadata.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        on:click|stopPropagation
                        class="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all"
                    >
                        <i class="fas fa-globe text-purple-600 dark:text-purple-400"></i>
                        <span class="text-xs text-gray-700 dark:text-gray-300">Website</span>
                    </a>
                {/if}
                {#if creator.metadata['com.twitter']}
                    <a 
                        href="https://twitter.com/{creator.metadata['com.twitter']}" 
                        target="_blank"
                        rel="noopener noreferrer"
                        on:click|stopPropagation
                        class="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 transition-all"
                    >
                        <i class="fab fa-x-twitter text-purple-600 dark:text-purple-400"></i>
                        <span class="text-xs text-gray-700 dark:text-gray-300">@{creator.metadata['com.twitter']}</span>
                    </a>
                {/if}
            </div>
        {/if}
    </div>
</button> 