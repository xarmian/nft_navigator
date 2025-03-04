<script lang="ts">
	import type { Token } from "$lib/data/types";

    export let token: Token;

    $: imageURL = (token && token.metadataURI) ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=120` : token?.metadata?.image;
</script>
<a href="/collection/{token.contractId}/token/{token.tokenId}" aria-label={token.metadata?.name ?? 'View Token'}>
    <img src={imageURL} alt={token.metadata?.name ?? 'View Token'} />
</a>
