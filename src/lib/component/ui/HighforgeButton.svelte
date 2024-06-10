<script lang="ts">
    import image from '$lib/assets/highforge.png';

    //export let tokenid: string | undefined = undefined;
    export let contractid: string | undefined = undefined;
    //export let address: string | undefined = undefined;
    export let buttonClass = 'flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 p-2 rounded-md cursor-pointer';

    const buttonClick = () => {
        if (contractid) {
            window.open(`https://highforge.io/project/${contractid}`, '_blank');
        } else {
            window.open(`https://highforge.io`, '_blank');
        }
    }
</script>
<button class={buttonClass} on:click={() => buttonClick()}>
    <img src={image} class="" alt="Button to View Collection on High Forge" />
</button>