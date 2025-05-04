<script lang="ts">
  // Button components
  import LoungeButton from '$lib/component/ui/LoungeButton.svelte';
  import NautilusButton from '$lib/component/ui/NautilusButton.svelte';
  import HighforgeButton from '$lib/component/ui/HighforgeButton.svelte';
  import PixelPursuitButton from '$lib/component/ui/PixelPursuitButton.svelte';
  import { getImageUrl } from '$lib/utils/functions';
  import type { Collection } from '$lib/data/types';

  export let collection: Collection;
  export let collectionDescription: string;
  export let creatorEnvoiMetadata: any;

  $: contractId = collection?.contractId;
  $: collectionName = collection?.name ?? collection?.highforgeData?.title;
</script>

{#if collection}
<div class="banner_container h-96 justify-between overflow-hidden relative flex flex-row text-white">
    {#if collection?.imageUrl}
        <img src="{getImageUrl(collection?.imageUrl,480)}" alt="Collection Banner" class="banner_img object-cover" />
        <img src="{getImageUrl(collection?.imageUrl,480)}" alt="Collection Banner" class="banner_img2 w-1/2 object-cover" />
    {/if}
    <div class="mask_dark flex justify-center h-full absolute w-full content-center">
        <div class="collection_detail w-1/2 flex justify-center content-center md:space-x-10 pr-2">
            <div class="flex h-full place-items-center space-between flex-col space-y-1 w-full sm:w-3/4 md:flex-grow">
                <div class="p-0 sm:p-4 overflow-auto mb-auto">
                    {#if collectionDescription}
                        <div class="text-4xl font-bold md:text-left text-center">{collection?.highforgeData?.title??collectionName}</div>
                        <div class="text-md md:text-left text-center">{collectionDescription}</div>
                    {/if}
                    <!-- Add creator's Envoi metadata if available -->
                    {#if collection?.creatorName?.endsWith('.voi') && creatorEnvoiMetadata}
                        <div class="flex flex-col space-y-2 mt-4">
                            {#if creatorEnvoiMetadata.url}
                                <div class="flex items-center space-x-2">
                                    <i class="fas fa-globe text-gray-300"></i>
                                    <a href={creatorEnvoiMetadata.url} target="_blank" rel="noopener noreferrer" 
                                       class="text-blue-400 hover:text-blue-300 text-sm">{creatorEnvoiMetadata.url}</a>
                                </div>
                            {/if}
                            {#if creatorEnvoiMetadata.location}
                                <div class="flex items-center space-x-2">
                                    <i class="fas fa-map-marker-alt text-gray-300"></i>
                                    <span class="text-gray-300 text-sm">{creatorEnvoiMetadata.location}</span>
                                </div>
                            {/if}
                            {#if creatorEnvoiMetadata['com.twitter']}
                                <div class="flex items-center space-x-2">
                                    <i class="fab fa-x-twitter text-gray-300"></i>
                                    <a href="https://twitter.com/{creatorEnvoiMetadata['com.twitter']}" target="_blank" 
                                       class="text-blue-400 hover:text-blue-300 text-sm">@{creatorEnvoiMetadata['com.twitter']}</a>
                                </div>
                            {/if}
                            {#if creatorEnvoiMetadata['com.github']}
                                <div class="flex items-center space-x-2">
                                    <i class="fab fa-github text-gray-300"></i>
                                    <a href="https://github.com/{creatorEnvoiMetadata['com.github']}" target="_blank" 
                                       class="text-blue-400 hover:text-blue-300 text-sm">{creatorEnvoiMetadata['com.github']}</a>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
                <!-- Integrated buttons section for desktop -->
                <div class="hidden md:flex flex-row gap-2 mb-4 p-4">
                    <LoungeButton contractid={String(contractId)} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer text-black hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200 space-x-2"/>
                    <NautilusButton contractid={String(contractId)} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200"/>
                    <HighforgeButton contractid={String(contractId)} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200"/>
                    <PixelPursuitButton contractid={String(contractId)} buttonClass="w-32 flex flex-row items-center justify-center bg-gray-100 bg-opacity-90 dark:bg-gray-100 text-black dark:text-black px-2 py-1.5 rounded-lg cursor-pointer hover:bg-opacity-100 transition-all hover:scale-105 hover:bg-gray-200"/>
                </div>
            </div>
        </div>
    </div>
</div>
<!-- Mobile buttons container -->
<div class="flex md:hidden justify-between gap-2 p-4 bg-black bg-opacity-50">
    <LoungeButton contractid={String(contractId)} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 px-2 py-2 rounded-md cursor-pointer text-black min-w-0"/>
    <NautilusButton contractid={String(contractId)} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 px-2 py-2 rounded-md cursor-pointer min-w-0"/>
    <HighforgeButton contractid={String(contractId)} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 px-2 py-2 rounded-md cursor-pointer min-w-0"/>
    <PixelPursuitButton contractid={String(contractId)} buttonClass="flex-1 flex flex-row items-center justify-center bg-gray-100 dark:bg-gray-100 text-black dark:text-black px-2 py-2 rounded-md cursor-pointer min-w-0"/>
</div>
{/if}

<style>
    .mask_dark {
        background: radial-gradient(circle at center, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.9), rgba(0,0,0,0), rgba(0,0,0,1) 100%);
    }
    .banner_img {
        width: calc(50%);
    }
    .collection_detail {
        width: 50%;
    }
    @media (max-width: 768px) {
        .mask_dark {
            background: linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.8));
        }
        .banner_img {
            filter: blur(2px);
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .banner_img2 {
            display: none;
        }
        .collection_detail {
            width: 100%;
            padding: 1rem;
            padding-bottom: 0;
        }
    }
</style> 