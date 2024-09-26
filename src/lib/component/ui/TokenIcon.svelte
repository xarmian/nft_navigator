<script lang="ts">
	import type { Token } from "$lib/data/types";

    export let token: Token;

    $: imageURL = (token && token.metadataURI) ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=120` : token?.metadata?.image;
</script>
<a href="/collection/{token.contractId}/token/{token.tokenId}">
    <img src={imageURL} class="w-8 h-8 rounded-full mr-2" />
</a>
