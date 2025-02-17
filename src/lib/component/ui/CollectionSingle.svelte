<script lang="ts">
    import type { Collection } from '$lib/data/types';
    import voiGamesImage from '$lib/assets/voi-games-small.png';
	import NftGamesButton from './NFTGamesButton.svelte';
	import { getImageUrl } from '$lib/utils/functions';
    import { goto } from '$app/navigation';

    interface EnvoiMetadata {
        url?: string;
        location?: string;
        'com.twitter'?: string;
        'com.github'?: string;
    }

    interface TokenMetadata {
        name?: string;
        description?: string;
        image?: string;
        envoiMetadata?: EnvoiMetadata;
    }

    export let collection: Collection;
    export let viewType: string = 'row';
    $: token = collection.firstToken;

    $: metadata = (token && token.metadata) ? JSON.parse(token?.metadata??'{}') as TokenMetadata : {} as TokenMetadata;
    $: metadataName = metadata?.name ?? '';
    $: imageUrl = metadata?.image ?? '';

    let isMintable = false;
    let totalMinted = 0;
    let maxSupply = 0;
    let isExpanded = false;

    $: if (collection.globalState) {
        const launchStart = Number(collection.globalState.find((gs) => gs.key === 'launchStart')?.value);
        const launchEnd = Number(collection.globalState.find((gs) => gs.key === 'launchEnd')?.value);
        totalMinted = Number(collection.globalState.find((gs) => gs.key === 'totalMinted')?.value);
        maxSupply = Number(collection.globalState.find((gs) => gs.key === 'maxSupply')?.value);

        const currentTime = Math.floor(Date.now() / 1000);
        isMintable = (launchStart === 0 || currentTime >= launchStart) && (launchEnd === 0 || currentTime <= launchEnd) && totalMinted < maxSupply;
    }
    else {
        isMintable = false;
    }

    $: data = [
        {
            "icon": "fas fa-id-card",
            "name": "ID",
            "value": collection.contractId,
            "tooltip": "Collection ID"
        },
        {
            "icon": "fas fa-cubes",
            "name": "Supply",
            "value": collection.totalSupply-collection.burnedSupply + (collection.globalState?.find(gs => gs.key === 'maxSupply')?.value ? '/' + collection.globalState?.find(gs => gs.key === 'maxSupply')?.value : ''),
            "tooltip": "Total Supply"
        },
        {
            "icon": "fas fa-users",
            "name": "Holders",
            "value": collection.uniqueOwners,
            "tooltip": "Unique Holders"
        }
    ];

    function toggleExpanded(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        isExpanded = !isExpanded;
    }

    function handleLinkClick(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        const href = (e.currentTarget as HTMLAnchorElement).getAttribute('href');
        if (href) {
            goto(href);
        }
    }

    $: description = metadata?.description ?? '';
    $: isNFD = collection.creatorName && collection.creatorName.endsWith('.voi');
    $: creatorMetadata = isNFD && metadata?.envoiMetadata ? metadata.envoiMetadata : null;
</script>

{#if viewType == 'row'}
    <div class="flex flex-wrap border-b border-gray-200 py-2 mr-0 ml-0 md:mr-4 md:ml-4 place-items-center">
        <div class="w-2/5 md:w-1/5">
            <a href="/collection/{collection.contractId}" 
               on:click={handleLinkClick}
               class="w-full flex flex-col items-center">
                <img src={metadata.image ?? ''} alt={metadataName} title={metadataName.replace(/[1#]/g, '')} class="h-20 w-20 object-contain rounded-md"/>
                <div class="md:hidden">{collection.highforgeData?.title ?? metadataName.replace(/[1#]/g, '')}</div>
            </a>
        </div>
        <div class="w-1/5 hidden md:block">
            <a href="/collection/{collection.contractId}" 
               on:click={handleLinkClick}>
                {collection.highforgeData?.title ?? metadataName.replace(/[1#]/g, '')}
            </a>
        </div>
        <div class="w-1/5 hidden md:block">
            <a href="/portfolio/{collection.creator}" 
               on:click={handleLinkClick}>
                {collection.creatorName ?? collection.creator.slice(0,6)+'...'+collection.creator.slice(-8)}
            </a>
        </div>
        <div class="w-2/5 md:w-1/5">
            <div class="flex flex-wrap gap-2">
                {#each data as item}
                    <div class="flex items-center gap-1.5 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" title={item.tooltip}>
                        <div class="flex items-center gap-1">
                            <i class={item.icon + ' text-gray-600 dark:text-gray-400 text-xs'}></i>
                            <span class="text-xs text-gray-500 dark:text-gray-400">{item.name}:</span>
                        </div>
                        <span class="text-sm font-medium">{item.value}</span>
                    </div>
                {/each}
            </div>
        </div>
        <div class="w-1/5">
            {#if collection.gameData && false}
                <NftGamesButton contractid={collection.contractId} buttonClass='w-16 md:w-20 object-contain' />
            {/if}
        </div>
    </div>
{:else}
    <div class="shadow-md rounded-xl bg-opacity-10 bg-slate-400 dark:bg-white dark:bg-opacity-10 relative overflow-hidden w-72 h-72 place-self-center">
        <div class="relative overflow-hidden place-self-center rounded-xl group block w-72 h-72">
            <div class="w-72 h-72 relative">
                <a href="/collection/{collection.contractId}" 
                   on:click={handleLinkClick}
                   class="block w-full h-full">
                    <img src={getImageUrl(imageUrl, 480)} 
                         alt={metadataName} 
                         title={metadataName.replace(/[1#]/g, '')} 
                         class="w-72 h-72 object-cover transition-transform duration-300 {!isExpanded && 'group-hover:scale-105'}" />
                </a>
                
                {#if isMintable}
                    <div class="absolute top-2 left-2 transition-opacity duration-300 {isExpanded ? 'opacity-0' : 'opacity-90'}">
                        <div class="flex items-center gap-2 bg-gradient-to-r from-green-600/90 to-green-800/90 rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-sm">
                            <i class="fas fa-fire text-white/90"></i>
                            <div class="flex flex-col">
                                <span class="text-white/90 text-xs font-medium">Mintable</span>
                                {#if collection.globalState?.find((m) => m.key === 'price')?.value !== undefined}
                                    <span class="text-white font-bold text-sm">
                                        {(Number(collection.globalState?.find((m) => m.key === 'price')?.value) / Math.pow(10,6)).toLocaleString()} Voi
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>
                {/if}

                <!-- Permanent collection name that fades out on hover -->
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3 transition-opacity duration-300 {isExpanded ? 'opacity-0' : ''}">
                    <div class="flex items-center gap-3">
                        <div class="flex-1">
                            <a href="/collection/{collection.contractId}" class="block">
                                <h3 class="text-white font-bold text-lg typewriter-effect">
                                    {collection.highforgeData?.title ?? metadata?.name?.replace(/[1#]/g, '')}
                                </h3>
                            </a>
                            <a href="/portfolio/{collection.creator}" 
                               class="text-purple-400 hover:text-purple-300 text-sm transition-colors">
                                {collection.creatorName ?? collection.creator.slice(0,6)+'...'+collection.creator.slice(-8)}
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Quick Action Buttons -->
                <div class="absolute top-2 right-2 z-[5]">
                    <button 
                        class="p-2 bg-gray-900/70 hover:bg-gray-900/90 rounded-lg transition-colors duration-150 backdrop-blur-sm"
                        on:click={toggleExpanded}
                        aria-label="Toggle Details">
                        <i class="fas {isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-white/90"></i>
                    </button>
                </div>

                <!-- Info Overlay -->
                <div class="absolute inset-0 bg-black/70 {isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} transition-opacity duration-300 flex flex-col justify-between p-4 overflow-hidden z-[2]"
                     on:click|stopPropagation|preventDefault>
                    <div class="flex-1 flex flex-col justify-between">
                        <!-- Top Section with Title -->
                        <div class="space-y-2">
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-200">
                                <a href="/collection/{collection.contractId}" class="block">
                                    <h3 class="text-white font-bold mb-2">
                                        {collection.highforgeData?.title ?? metadata?.name?.replace(/[1#]/g, '')}
                                    </h3>
                                </a>
                            </div>
                            
                            <!-- Creator Info with NFD -->
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-250">
                                <div class="flex flex-col gap-2">
                                    <p class="text-white/80 text-sm flex items-center gap-2">
                                        <i class="fas fa-user"></i>
                                        <span>Creator:</span>
                                        <a href="/portfolio/{collection.creator}" 
                                           on:click={handleLinkClick}
                                           class="text-purple-400 hover:text-purple-300 transition-colors">
                                            {collection.creatorName ?? collection.creator.slice(0,6)+'...'+collection.creator.slice(-8)}
                                        </a>
                                    </p>

                                    {#if isNFD && creatorMetadata}
                                        <div class="space-y-1.5 pl-6">
                                            {#if creatorMetadata.url}
                                                <a href={creatorMetadata.url} 
                                                   target="_blank" 
                                                   rel="noopener noreferrer"
                                                   on:click|stopPropagation
                                                   class="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm">
                                                    <i class="fas fa-globe w-4"></i>
                                                    <span class="truncate">{creatorMetadata.url}</span>
                                                </a>
                                            {/if}
                                            {#if creatorMetadata.location}
                                                <div class="flex items-center gap-2 text-white/80 text-sm">
                                                    <i class="fas fa-map-marker-alt w-4"></i>
                                                    <span>{creatorMetadata.location}</span>
                                                </div>
                                            {/if}
                                            {#if creatorMetadata['com.twitter']}
                                                <a href="https://twitter.com/{creatorMetadata['com.twitter']}" 
                                                   target="_blank"
                                                   rel="noopener noreferrer" 
                                                   class="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm">
                                                    <i class="fab fa-twitter w-4"></i>
                                                    <span>@{creatorMetadata['com.twitter']}</span>
                                                </a>
                                            {/if}
                                            {#if creatorMetadata['com.github']}
                                                <a href="https://github.com/{creatorMetadata['com.github']}" 
                                                   target="_blank"
                                                   rel="noopener noreferrer" 
                                                   class="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm">
                                                    <i class="fab fa-github w-4"></i>
                                                    <span>{creatorMetadata['com.github']}</span>
                                                </a>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <!-- Description -->
                            {#if description}
                                <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-275">
                                    <div class="text-white/80 text-sm">
                                        <p class="line-clamp-3">
                                            {description}
                                        </p>
                                    </div>
                                </div>
                            {/if}
                            <a href="/collection/{collection.contractId}" 
                                on:click={handleLinkClick}
                                class="text-purple-400 hover:text-purple-300 text-sm inline-block">
                            {#if description && description.length > 150}
                                Read more <i class="fas fa-arrow-right"></i>
                            {:else}
                                View collection <i class="fas fa-arrow-right"></i>
                            {/if}
                        </a>
                    </div>

                        <!-- Collection Stats -->
                        <div class="space-y-3">
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-300">
                                <div class="flex items-center justify-between gap-2">
                                    {#each data as item}
                                        <div class="flex flex-col text-white/80 px-2 py-1.5 bg-white/5 rounded-lg backdrop-blur-sm items-center" title={item.tooltip}>
                                            <div class="flex items-center gap-1 text-xs text-white/60">
                                                <i class={item.icon + ' w-3 text-purple-400'}></i>
                                                <span>{item.name}</span>
                                            </div>
                                            <span class="font-medium text-sm">{item.value}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>

                            {#if isMintable}
                                <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-350">
                                    <div class="mt-4">
                                        <div class="flex justify-between text-sm text-white/90 mb-1">
                                            <span>Minting Progress</span>
                                            <span>{totalMinted} / {maxSupply}</span>
                                        </div>
                                        <div class="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                                            <div class="h-full bg-green-500 transition-all duration-300"
                                                 style="width: {(totalMinted / maxSupply) * 100}%"></div>
                                        </div>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style lang="postcss">
    .typewriter-effect {
        overflow: hidden;
        border-right: 2px solid transparent;
        white-space: nowrap;
        animation: typing 1s steps(40, end), blink-caret 0.75s step-end infinite;
        animation-play-state: paused;
    }

    .group:hover .typewriter-effect {
        animation-play-state: running;
    }

    @keyframes typing {
        from { width: 0 }
        to { width: 100% }
    }

    @keyframes blink-caret {
        from, to { border-color: transparent }
        50% { border-color: white }
    }

    @media (hover: none) {
        .group:active .opacity-0 {
            opacity: 0;
        }
        .group:active .translate-y-4 {
            transform: translateY(4px);
        }
        .group:active .typewriter-effect {
            animation-play-state: paused;
        }
    }

    .backdrop-blur-sm {
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    }
</style>