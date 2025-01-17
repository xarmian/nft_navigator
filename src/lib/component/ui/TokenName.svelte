<script lang="ts">
    import { reformatTokenName } from "$lib/utils/indexer";

    export let name: string;
    export let tokenId: string | undefined = undefined;
</script>
<div class="truncate max-w-64">
    {reformatTokenName(name, tokenId)}
</div>