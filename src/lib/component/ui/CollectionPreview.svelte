<script lang="ts">
    import type { Token } from '$lib/data/types';
    import { getTokenImageUrl } from '$lib/utils/functions';
    
    export let tokens: Token[];
    export let maxDisplay = 3;

    // Only show up to maxDisplay tokens
    $: displayTokens = tokens.slice(0, maxDisplay);
</script>

<div class="relative h-44 w-44">
    {#each displayTokens as token, i}
        <div 
            class="absolute top-0 left-0 transition-all duration-200"
            style="transform: rotate({(i - 1) * 15}deg) translateX({i * 8}px);"
        >
            <img 
                src={getTokenImageUrl(token, 176)} 
                alt={token.metadata?.name ?? String(token.tokenId)}
                class="h-44 w-44 object-contain rounded-lg shadow-lg"
            />
        </div>
    {/each}
</div> 