<script lang="ts">
	import { goto } from '$app/navigation';

    //export let tokenid: string | undefined = undefined;
    export let contractid: string | undefined = undefined;
    //export let address: string | undefined = undefined;
    export let buttonClass = 'flex flex-row whitespace-nowrap items-center space-x-2 bg-gray-100 dark:bg-gray-100 p-2 rounded-md cursor-pointer';

    const openLounge = () => {
        if (contractid) {
            goto(`/lounge/${contractid}`);
        } else {
            goto(`/lounge`);
        }
    }
</script>
<button class={buttonClass} on:click={() => openLounge()}>
    <i class="fas fa-couch"></i>
    <div style="font-family:'Cherry Bomb One';">Lounge</div>
</button>
<style>
@font-face {
  font-family: 'Cherry Bomb One';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/cherrybombone/v8/y83DW4od1h6KlV3c6JJhRhGOdhr6C9BEwVT7-g.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
</style>