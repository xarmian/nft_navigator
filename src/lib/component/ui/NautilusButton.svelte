<script lang="ts">
    import image from '$lib/assets/nautilus.svg';

    export let tokenid: string | undefined = undefined;
    export let contractid: string | undefined = undefined;
    export let address: string | undefined = undefined;
    export let buttonClass = 'flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 p-2 rounded-md cursor-pointer';

    const openNautilus = () => {
        if (tokenid && contractid) {
            window.open(`https://nautilus.sh/#/collection/${contractid}/token/${tokenid}`, '_blank');
        }
        else if (contractid) {
            window.open(`https://nautilus.sh/#/collection/${contractid}`, '_blank');
        } else if (address) {
            window.open(`https://nautilus.sh/#/address/${address}`, '_blank');
        } else {
            window.open(`https://nautilus.sh`, '_blank');
        }
    }
</script>
<button class={buttonClass} on:click={() => openNautilus()}>
    <img src={image} class="" alt="Button to Open Nautilus Marketplace" />
</button>