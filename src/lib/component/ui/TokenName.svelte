<script lang="ts">
    import { reformatTokenName } from "$lib/utils/indexer";

    export let name: string;
    export let tokenId: number | undefined = undefined;
</script>
{reformatTokenName(name, tokenId)}