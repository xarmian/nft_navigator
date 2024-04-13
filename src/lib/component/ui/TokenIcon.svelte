<script lang="ts">
	import type { Token } from "$lib/data/types";

    export let token: Token;
</script>
<a href="/collection/{token.contractId}/token/{token.tokenId}">
    <img src={token.metadata.image} class="w-8 h-8 rounded-full mr-2" />
</a>
