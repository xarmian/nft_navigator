<script lang="ts">
    import image from '$lib/assets/voi-games-small.png';

    //export let tokenid: string | undefined = undefined;
    export let contractid: string | number | undefined = undefined;
    //export let address: string | undefined = undefined;
    export let buttonClass = 'flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 px-2 rounded-md cursor-pointer';

    const buttonClick = () => {
        if (contractid) {
            window.open(`https://nft-games.boeieruurd.com/collections/${contractid}`, '_blank');
        } else {
            window.open(`https://nft-games.boeieruurd.com`, '_blank');
        }
    }
</script>
<button class={buttonClass} on:click|stopPropagation|preventDefault={() => buttonClick()}>
    <img src={image} alt="Button to View on NFT Games Tracker" />
</button>