<script lang="ts">
	import { onMount } from "svelte";

    export let name: string;

    function reformatName(name: string) {
        const match = name.match(/^(.*?)(\d+)$/);
        if (match) {
            const baseName = match[1].trim();
            const number = match[2];
            return `${baseName} #${number}`;
        } else {
            return name;
        }
    }

    let formattedName = reformatName(name);
</script>
{formattedName}