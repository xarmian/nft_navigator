<script lang="ts">
    import type { Collection } from '$lib/data/types';
    import voiGamesImage from '$lib/assets/voi-games-small.png';
	import NftGamesButton from './NFTGamesButton.svelte';
	import { getImageUrl } from '$lib/utils/functions';

    export let collection: Collection;
    export let viewType: string = 'row';
    $: token = collection.firstToken;

    $: metadata = JSON.parse(token?.metadata??'{}');

    let isMintable = false;
    let flipped = false;

    $: if (collection.globalState) {
        const launchStart = Number(collection.globalState.find((gs) => gs.key === 'launchStart')?.value);
        const launchEnd = Number(collection.globalState.find((gs) => gs.key === 'launchEnd')?.value);
        const totalMinted = Number(collection.globalState.find((gs) => gs.key === 'totalMinted')?.value);
        const maxSupply = Number(collection.globalState.find((gs) => gs.key === 'maxSupply')?.value);

        const currentTime = Math.floor(Date.now() / 1000);
        isMintable = (launchStart === 0 || currentTime >= launchStart) && (launchEnd === 0 || currentTime <= launchEnd) && totalMinted < maxSupply;
    }
    else {
        isMintable = false;
    }

    function flip(node: any, {
        delay = 0,
        duration = 500
    }) {
        return {
            delay,
            duration,
            css: (t: number, u: any) => `
                transform: rotateY(${1 - (u * 180)}deg);
                opacity: ${1 - u};
            `
        };
    }

    $: data = [
        {
            "icon": "fas fa-id-card",
            "name": "ID",
            "value": collection.contractId
        },
        {
            "icon": "fas fa-cubes",
            "name": "Tokens",
            "value": collection.totalSupply-collection.burnedSupply + (collection.globalState?.find(gs => gs.key === 'maxSupply')?.value ? ' / ' + collection.globalState?.find(gs => gs.key === 'maxSupply')?.value : ''),
        },
        {
            "icon": "fas fa-user",
            "name": "Unique Holders",
            "value": collection.uniqueOwners
        }
    ];

</script>

{#if viewType == 'row'}
    <div class="flex flex-wrap border-b border-gray-200 py-2 mr-0 ml-0 md:mr-4 md:ml-4 place-items-center">
        <div class="w-2/5 md:w-1/5">
            <a href="/collection/{collection.contractId}" class="w-full flex flex-col items-center">
                <img src={metadata.image} alt={metadata.name} title={metadata.name.replace(/[1#]/g, '')} class="h-20 w-20 object-contain rounded-md"/>
                <div class="md:hidden">{collection.highforgeData?.title ?? metadata.name.replace(/[1#]/g, '')}</div>
            </a>
        </div>
        <div class="w-1/5 hidden md:block">
            <a href="/collection/{collection.contractId}">
                {collection.highforgeData?.title ?? metadata.name.replace(/[1#]/g, '')}
            </a>
        </div>
        <div class="w-1/5 hidden md:block">
            <a href="/portfolio/{collection.creator}" on:click|stopPropagation>
                {collection.creator.slice(0,6)+'...'+collection.creator.slice(-8)}
            </a>
        </div>
        <div class="w-2/5 md:w-1/5">
            {#each data as item}
                <div class="flex justify-start space-x-2 text-gray-700 dark:text-gray-200">
                    <i class={item.icon + ' text-gray-600 dark:text-gray-400'}></i>
                    <p class="text-sm">{item.name}: {item.value}</p>
                </div>
            {/each}
        </div>
        <div class="w-1/5">
            {#if collection.gameData}
                <NftGamesButton contractid={collection.contractId} buttonClass='w-16 md:w-20 object-contain' />
            {/if}
        </div>
    </div>
{:else}
    <div class="card-container cursor-pointer rounded-xl overflow-hidden m-1" >
        <div class="card">
            <a href="/collection/{collection.contractId}">
                <div class="side back bg-gray-200 dark:bg-gray-900 relative rounded-lg flex flex-col">
                    <div class="image-container relative overflow-hidden flex justify-center bg-gray-10 dark:bg-black">
                        <img src={getImageUrl(metadata.image,240)} alt={metadata.name} title={metadata.name.replace(/[1#]/g, '')} class="max-h-60 h-60 max-w-60 object-contain object-center"/>
                    </div>
                    <div class='p-1 flex flex-col flex-grow'>
                        <div class="flex flex-col mb-1">
                            <div class="text-sm font-bold">{collection.highforgeData?.title ?? metadata.name.replace(/[1#]/g, '')}</div>
                            <a href="/portfolio/{collection.creator}" on:click|stopPropagation class="place-self-end text-xs text-gray-600 dark:text-gray-300">{collection.creator.slice(0,6)+'...'+collection.creator.slice(-8)}</a>
                        </div>
                        <div class="content-end flex-grow">
                            {#each data as item}
                                <div class="flex justify-start space-x-2 text-gray-700 dark:text-gray-200">
                                    <i class={item.icon + ' text-gray-600 dark:text-gray-400'}></i>
                                    <p class="text-sm">{item.name}: {item.value}</p>
                                </div>
                            {/each}
                        </div>
                        {#if collection.gameData}
                            <NftGamesButton contractid={collection.contractId} buttonClass='w-16 md:w-20 object-contain flex justify-center absolute bottom-0 right-0' />
                        {/if}
                    </div>
                </div>
                {#if isMintable}
                    <a class="badge top-right" target="_blank" href="https://highforge.io/project/{collection.contractId}">
                        <div>Mintable</div>
                        {#if collection.globalState?.find((m) => m.key === 'price')?.value !== undefined}
                            <div>{(Number(collection.globalState?.find((m) => m.key === 'price')?.value) / Math.pow(10,6)).toLocaleString()} Voi</div>
                        {/if}
                    </a>
                {/if}
            </a>
        </div>
    </div>
{/if}

<style>
.image-container {
    position: relative;
}
.card-container {
    position: relative;
    height: 22rem;
    width: 15rem;
}
@media (max-width: 768px) {
    .card-container {
        height: 26rem;
        width: calc(100vw - 8rem);
    }
    .image-container img {
        max-height: 18rem;
        max-width: unset;
        height: 18rem;
    }
}

.card {
    width: 100%;
    height: 100%;
    position: absolute;
    perspective: 600;
}

.side {
    position: absolute;
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.badge {
    margin: 0;
    padding: 0;
    color: white;
    padding: 1px 10px;
    font-size: 12px;
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
    line-height: normal;
    text-transform: uppercase;
    background: green;
}

.badge::before, .badge::after {
    content: '';
    position: absolute;
    top: 0;
    margin: 0 -1px;
    width: 100%;
    height: 100%;
    background: inherit;
    min-width: 55px
}

.badge::before {
    right: 100%
}

.badge::after {
    left: 100%
}

.top-right {
    position: absolute;
    top: 0;
    right: 0;
    -ms-transform: translateX(30%) translateY(0%) rotate(45deg);
    -webkit-transform: translateX(30%) translateY(0%) rotate(45deg);
    transform: translateX(30%) translateY(0%) rotate(45deg);
    -ms-transform-origin: top left;
    -webkit-transform-origin: top left;
    transform-origin: top left;
}
</style>