<script lang="ts">
    export let tokenid: string | undefined = undefined;
    export let contractid: string | undefined = undefined;
    export let address: string | undefined = undefined;
    export let buttonClass = 'flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 p-2 rounded-md cursor-pointer';

    const openPixelPursuit = () => {
        if (tokenid && contractid) {
            window.open(`https://pixel-pursuit.art/collection/${contractid}/token/${tokenid}`, '_blank');
        }
        else if (contractid) {
            window.open(`https://pixel-pursuit.art/collection/${contractid}`, '_blank');
        } else if (address) {
            window.open(`https://pixel-pursuit.art/portfolio/${address}`, '_blank');
        } else {
            window.open(`https://pixel-pursuit.art`, '_blank');
        }
    }
</script>
<button class="{buttonClass} hidden" on:click={() => openPixelPursuit()}>
    <svg fill="none" height="36" viewBox="0 0 25.3 32" width="36"><path clip-rule="evenodd" d="M17.6482 10.1305L15.8785 7.02583L7.02979 22.5499H10.5278L17.6482 10.1305ZM19.8798 14.0457L18.11 17.1983L19.394 19.4511H16.8453L15.1056 22.5499H24.7272L19.8798 14.0457Z" fill="currentColor" fill-rule="evenodd"></path></svg>
    <div class="text-sm flex flex-col -space-y-2 content-end">
        <div>Pixel</div>
        <div>Pursuit</div>
    </div>
</button>
<style>
    button {
        font-family: ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji";
        font-weight: 500;
    }
</style>