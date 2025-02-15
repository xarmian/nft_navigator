<script lang="ts">
    import type { Token, Collection, Listing, Currency, Auction, Sale } from '$lib/data/types';
    import TokenName from '$lib/component/ui/TokenName.svelte';
    import { zeroAddress } from '$lib/data/constants';
    import { selectedWallet } from 'avm-wallet-svelte';
	import SendTokenModal from './SendTokenModal.svelte';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { getCurrency } from '$lib/utils/currency';
	import { onDestroy, onMount } from 'svelte';
	import algosdk from 'algosdk';
	import { getTokenImageUrl } from '$lib/utils/functions';
    import { getTokens, indexerBaseURL } from '$lib/utils/indexer';
	import BuyTokenModal from './BuyTokenModal.svelte';
    import ListTokenModal from './ListTokenModal.svelte';
    import NautilusLogo from '$lib/assets/nautilus.svg';
    import { buyToken as buyTokenArcpay, getListings as getListingsArcpay, listToken as listTokenArcpay, getTokenListing, cancelListing as cancelListingArcpay } from '$lib/arcpay';
    import type { Listing as AListing } from '$lib/arcpay';
    import Share from '$lib/component/ui/Share.svelte';
    import { browser } from '$app/environment';

    export let token: Token;
    export let collection: Collection | undefined;
    export let showOwnerIcon = true;
    export let format = 'small';
    export let listing: Listing | null = null;
    export let showMenuIcon = true;
    //export let quality = 'normal';

    let formattedOwner = '';
    let royaltyPercentage = 0;
    let isTokenOwner = false;
    let isTokenApproved = false;
    let showSendTokenModal = false;
    let showBuyTokenModal = false;
    let showListTokenModal = false;
    let sendTokenModalType = 'send';
    let tokenProps: any[] = [];
    let formattedApproved = '';
    let hidden = false;
    let showMenu = false;
    let menuRef: HTMLElement | null = null;
	let windowDefined = false;
    let waitingForConfirmationModal = false;

    $: imageUrl = (token) ? getTokenImageUrl(token,((format == 'small') ? 480 : 0)) : '';

    $: currency = null as Currency | null;

    function toggleMenu() {
        showMenu = !showMenu;

        if (showMenu) {
            if (windowDefined && document) document.addEventListener('click', handleClickOutside);
        } else {
            if (windowDefined && document) document.removeEventListener('click', handleClickOutside);
        }

        return false;
    }

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as Node;
        if (menuRef && !menuRef.contains(target)) {
            showMenu = false;
            if (windowDefined && document) document.removeEventListener('click', handleClickOutside);
        }
    }

    onMount(() => {
        windowDefined = typeof window !== 'undefined';

        //token = token;
    });

    onDestroy(() => {
        if (windowDefined && document) document.removeEventListener('click', handleClickOutside);
    });

    async function getMarketData() {
        if (!browser) return;

        if (token?.marketData) {
            listing = token.marketData;
        } else {
            const arcpayListing = token.approved !== zeroAddress ? await getTokenListing(token) : null;
            
            if (arcpayListing) {
                const processedListing = await processArcpayListing(arcpayListing);
                if (processedListing) {
                    listing = processedListing;
                }
            }
            else {
                const marketUrl = `${indexerBaseURL}/mp/listings/?collectionId=${token.contractId}&tokenId=${token.tokenId}&active=true`;
                try {
                    const marketData = await fetch(marketUrl).then((response) => response.json());
                    if (marketData.listings.length > 0) {
                        const marketToken = marketData.listings[0];
                        if (marketToken && !marketToken.sale) {
                            // check if token owner == marketToken.seller and mpContract id still approved to sell token
                            if (token.owner === marketToken.seller && token.approved === algosdk.getApplicationAddress(Number(marketToken.mpContractId))) {
                                listing = marketToken;
                            }
                        }
                    }
                }
                catch (e) {
                    console.error(e);
                }
            }
        }

        if (listing) {
            currency = await getCurrency(listing.currency);
        }
    }

    $: {
        if (token) {
            listing = token?.marketData??null;
            if (token.approved != zeroAddress) {
                getMarketData();
            }

            if ($selectedWallet?.address) {
                isTokenOwner = token.owner === $selectedWallet.address ? true : false;
                isTokenApproved = token.approved === $selectedWallet.address ? true : false;
            }

            if (token.metadata?.royalties) {
                const decodedRoyalties = atob(token.metadata?.royalties);

                // Convert the binary string to an array of bytes
                const bytes = new Uint8Array(decodedRoyalties.length);
                for (let i = 0; i < decodedRoyalties.length; i++) {
                    bytes[i] = decodedRoyalties.charCodeAt(i);
                }

                // Extract the first two bytes and convert them to a number
                royaltyPercentage = (bytes[0] << 8) | bytes[1];
            }

            // map token.metadata.properties object of the form {"BACKGROUND":"Aquamarine","BODY":"Red","ON BODY":"Scar"}
            // to an array of objects of the form {trait_type: "BACKGROUND", value: "Aquamarine"}
            if (token.metadata && token.metadata.properties) {
                tokenProps = Object.keys(token.metadata?.properties).map((key) => {
                    if (token.metadata) {
                        const colors = propColor(token.metadata.properties[key as keyof typeof token.metadata.properties]);
                        return { trait_type: key, value: token.metadata.properties[key as keyof typeof token.metadata.properties], fgcolor: colors[1], bgcolor: colors[0]};
                    }
                });
            }

            formattedOwner = token.ownerNFD ? token.ownerNFD as string : token.owner.length > 16
                    ? `${token.owner.slice(0, 8)}...${token.owner.slice(-8)}`
                    : token.owner;

            formattedApproved = token.approved ? token.approved.length > 8
                ? `${token.approved.slice(0, 8)}...${token.approved.slice(-8)}`
                : token.approved : '';
        }
    }

    let collectionName = '';
    $: {
        collectionName = collection?.highforgeData?.title ?? (token?.metadata?.name??'').replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
        collectionName = collectionName.substring(0, 28) + (collectionName.length > 28 ? '...' : '');
    }

    // return a tuple of the bg color from bgcolor if value is in the bgcolor array, and its corresponding fg color
    // if value is not in the bgcolors array, return a random bgcolor and its corresponding foreground color
    function propColor(value: string) {
        const bgcolors = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Cyan', 'Magenta', 'Black', 'White', 'Gray', 'Pink', 'Brown', 'Dark Grey', 'YBG', 'Gold', 'Lavender', 'Aquamarine'];

        // create a list of softer background colors
        const softBgColors = ['#F08080', '#87CEFA', '#90EE90', '#FFFFE0', '#DDA0DD', '#AFEEEE', '#FFC0CB', '#D3D3D3', '#F5F5F5', '#DCDCDC', '#FFB6C1', '#FFE4C4', '#778899',
            '#FFD700',
            '#FFE000',
            '#E6E6FA',
            '#7FFFD4'
        ];

        // create a list of softer foreground colors
        const softFgColors = ['#8B0000', '#00008B', '#006400', '#FFD700', '#4B0082', '#008B8B', '#FF1493', '#696969', '#A9A9A9', '#2F4F4F', '#FF1493', '#A0522D', '#2F4F4F',
            '#8B0000',
            '#8B0000',
            '#8B008B',
            '#006400'
        ];

        const index = bgcolors.includes(value) ? bgcolors.indexOf(value) : Math.floor(Math.random() * bgcolors.length);

        return [softBgColors[index], softFgColors[index]];
    }

    function sendToken() {
        if (isTokenOwner || isTokenApproved) {
            sendTokenModalType = 'send';
            showSendTokenModal = true;
        }
    }

    function approveToken() {
        if (isTokenOwner) {
            sendTokenModalType = 'approve';
            showSendTokenModal = true;
        }
    }

    async function cancelListing() {
        if (listing && listing.source === 'arcpay') {
            const txId = await cancelListingArcpay(listing.transactionId);
            waitingForConfirmationModal = true;

            let count = 0;
            const interval = setInterval(async () => {
                const tokenChk = (await getTokens({ contractId: token.contractId, tokenId: token.tokenId, invalidate: true }))[0];
                if (tokenChk.approved === zeroAddress) {
                    token = tokenChk;
                    // Clear listing after successful cancellation
                    listing = null;
                    waitingForConfirmationModal = false;
                    clearInterval(interval);
                } else {
                    count++;
                    if (count === 12) {
                        token = tokenChk;
                        waitingForConfirmationModal = false;
                        clearInterval(interval);
                    }
                }
            }, 2000);
        }
        else if (isTokenOwner) {
            sendTokenModalType = 'revoke';
            showSendTokenModal = true;
        }
    }

    async function onAfterSend(t: Token) {
        token = t;
    }

    function buyToken() {
        showBuyTokenModal = true;        
    }

    function listToken() {
        showListTokenModal = true;
    }

    async function listArcpay() {
        if (!browser) return;

        const txId = await listTokenArcpay(token);
        waitingForConfirmationModal = true;

        if (txId !== undefined) {
            let count = 0;
            const interval = setInterval(async () => {
                const tokenChk = (await getTokens({ contractId: token.contractId, tokenId: token.tokenId, invalidate: true }))[0];
                if (tokenChk.approved !== zeroAddress) {
                    token = tokenChk;
                    // Get fresh listing data
                    const arcpayListing = await getTokenListing(tokenChk);
                    if (arcpayListing) {
                        const processedListing = await processArcpayListing(arcpayListing);
                        if (processedListing) {
                            listing = processedListing;
                        }
                    }
                    waitingForConfirmationModal = false;
                    clearInterval(interval);
                } else {
                    count++;
                    if (count === 12) {
                        token = tokenChk;
                        waitingForConfirmationModal = false;
                        clearInterval(interval);
                    }
                }
            }, 2000);
        }
    }

    async function buyArcpay(evt: Event) {
        if (!browser) return;

        if (listing && listing.source === 'arcpay') {
            const txId = await buyTokenArcpay(listing?.transactionId);
            waitingForConfirmationModal = true;

            if (txId !== undefined) {
                let count = 0;
                const interval = setInterval(async () => {
                    const tokenChk = (await getTokens({ contractId: token.contractId, tokenId: token.tokenId, invalidate: true }))[0];
                    if (tokenChk.approved === zeroAddress) {
                        token = tokenChk;
                        // Clear listing after successful purchase
                        listing = null;
                        waitingForConfirmationModal = false;
                        clearInterval(interval);
                    } else {
                        count++;
                        if (count === 12) {
                            token = tokenChk;
                            waitingForConfirmationModal = false;
                            clearInterval(interval);
                        }
                    }
                }, 2000);
            }
        }

        evt.preventDefault();
        return false;
    }

    async function processArcpayListing(arcpayListing: AListing): Promise<Listing | null> {
        if (arcpayListing && (arcpayListing.status === 'active' || arcpayListing.status === 'pending')) {
            let c = await getCurrency(Number(arcpayListing.currency));
            
            if (c) {
                const price = arcpayListing.sales[0]?.price * Math.pow(10, c.decimals) || 
                            (arcpayListing.auctions[0]?.start_price ? arcpayListing.auctions[0].start_price * Math.pow(10, c.decimals) : 0);

                // Create a base listing object that will be referenced by sales and auctions
                const baseListing: Listing = {
                    transactionId: arcpayListing.id,
                    mpContractId: arcpayListing.app_id,
                    mpListingId: 0,
                    collectionId: Number(arcpayListing.asset_id.split('/')[0]),
                    tokenId: arcpayListing.asset_id.split('/')[1],
                    seller: arcpayListing.seller_address,
                    price: price,
                    currency: Number(arcpayListing.currency),
                    sales: [],
                    auctions: [],
                    delete: null,
                    createTimestamp: Math.floor(new Date(arcpayListing.created_at).getTime() / 1000),
                    source: 'arcpay',
                    type: arcpayListing.type,
                    sale: null
                };

                // Map arcpay sales to our internal Sale type
                const mappedSales = arcpayListing.sales.map(sale => ({
                    transactionId: arcpayListing.id,
                    seller: sale.seller_address || arcpayListing.seller_address,
                    buyer: sale.buyer_address || '',
                    price: sale.price,
                    currency: Number(sale.currency || arcpayListing.currency),
                    timestamp: Math.floor(new Date(arcpayListing.created_at).getTime() / 1000),
                    round: 0,
                    mpContractId: arcpayListing.app_id,
                    mpListingId: 0,
                    source: 'arcpay',
                    tokenId: arcpayListing.asset_id.split('/')[1],
                    collectionId: Number(arcpayListing.asset_id.split('/')[0]),
                    listing: baseListing
                }));

                // Map arcpay auctions to our internal Auction type
                const mappedAuctions = arcpayListing.auctions.map(auction => ({
                    id: Number(arcpayListing.id),
                    created_at: arcpayListing.created_at,
                    updated_at: arcpayListing.updated_at || arcpayListing.created_at,
                    duration: 0,
                    start_price: auction.start_price,
                    end_price: auction.end_price || 0,
                    increment: 0,
                    status: auction.status || 'active',
                    type: arcpayListing.type,
                    listing_id: arcpayListing.id
                }));

                // Update the base listing with the mapped sales and auctions
                baseListing.sales = mappedSales;
                baseListing.auctions = mappedAuctions;

                return baseListing;
            }
        }
        return null;
    }

</script>
{#if format === 'small'}
    <div class="shadow-md rounded-xl bg-opacity-10 bg-slate-400 dark:bg-white dark:bg-opacity-10 my-2 relative overflow-hidden h-full" class:hidden={hidden}>
        <a href="/collection/{token.contractId}/token/{token.tokenId}" class="relative overflow-hidden place-self-center rounded-t-xl">
            <img src={imageUrl} class="w-72 h-72 object-contain" alt={token.metadata?.name ?? `Token ${token.tokenId}`} />
            {#if token.metadata?.envoiName && token.metadata?.image !== 'ipfs://QmcekfLHJqJfL1TqhMdGncyhfNJTx93ZqPikFsKKx4nUTi'}
                <img src="/icons/envoi_icon.png" class="absolute bottom-2 right-2 w-12 h-12 rounded-full shadow-lg opacity-80" alt="Envoi Logo" />
            {/if}
            {#if listing && !listing.sale && !listing.delete}
                {#if listing.source === 'arcpay'}
                    <button on:click|stopPropagation|preventDefault={buyArcpay} class="absolute top-0 right-0 p-1 text-white rounded-full text-nowrap" title="Buy on NFT Navigator">
                        {#if currency}
                            <div class="badge top-right"><div>{listing?.type === 'sale' ? 'For Sale' : listing?.type === 'dutch_auction' ? 'Reverse Auction' : 'Starting At'}</div><div class="text-xs">{(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}</div></div>
                        {:else}
                            <div class="badge top-right"><div>{listing?.type === 'sale' ? 'For Sale' : listing?.type === 'dutch_auction' ? 'Reverse Auction' : 'Starting At'}</div><div class="text-xxs">See Marketplace</div></div>
                        {/if}
                    </button>
                {:else}
                    <button on:click|stopPropagation|preventDefault={() => window.open(`https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`, '_blank')} class="absolute top-0 right-0 p-1 text-white rounded-full text-nowrap" title="View on Marketplace">
                        {#if currency}
                            <div class="badge top-right"><div>For Sale</div><div class="text-xs">{(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}</div></div>
                        {:else}
                            <div class="badge top-right"><div>For Sale</div><div class="text-xxs">See Marketplace</div></div>
                        {/if}
                    </button>
                {/if}
            {/if}
            {#if showOwnerIcon && token.owner == $selectedWallet?.address}
                <div class="absolute top-0 left-0 p-1 text-green-500 text-3xl" title='Owned by You'>
                    <i class="fas fa-user"></i>
                </div>
            {/if}
        </a>
        <div class="side back bg-gray-200 dark:bg-gray-900 relative flex flex-col p-1 h-full">
            <div class='p-1 flex flex-col flex-grow h-full'>
                <div class="flex flex-col mb-1 text-sm">
                    <div class="text-sm font-bold">
                        {#if token.contractId === 797609}
                            {token.metadata?.envoiName}
                        {:else}
                            <TokenName name={token.metadata?.name??String(token.tokenId)} tokenId={token.tokenId}></TokenName>
                        {/if}
                    </div>
                    <div class="flex justify-between">
                        <div>Collection</div>
                        <a href="/collection/{token.contractId}" class="text-gray-600 dark:text-gray-300">{collectionName}</a>
                    </div>
                    <div class="flex justify-between">
                        <div>Owner</div>
                        <a href="/portfolio/{token.owner}" on:click|stopPropagation class="text-gray-600 dark:text-gray-300">{formattedOwner}</a>
                    </div>
                    {#if token.approved && token.approved != zeroAddress}
                        <div class="flex justify-between">
                            <div>Approved</div>
                            <a href="/portfolio/{token.approved}" on:click|stopPropagation class="text-gray-600 dark:text-gray-300">{formattedApproved}</a>
                        </div>
                    {/if}
                    {#if token.rank}
                        <div class="flex justify-between">
                            <div>Ranking</div>
                            <div>{token.rank}</div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
        {#if showMenuIcon && (isTokenOwner || isTokenApproved || (listing && !listing.sale && !listing.delete && $selectedWallet))}
            <button 
                class="absolute top-1 right-1 cursor-pointer opacity-50" 
                on:click|stopPropagation|preventDefault={toggleMenu}
                aria-label="Menu">
                <div class="rounded-full w-10 h-10 bg-gray-200 dark:bg-gray-800 p-2 text-center border border-gray-500 hover:border-gray-300 dark:hover:bg-gray-700 shadow-md hover:shadow-lg transition duration-200 ease-in-out">
                    <i class="fas fa-ellipsis-v text-xl text-gray-500 dark:text-gray-300"></i>
                </div>
            </button>
            {#if showMenu}
                <div class="absolute top-10 right-2 border border-gray-300 shadow-lg flex flex-col z-10 bg-gray-200 dark:bg-gray-900" bind:this={menuRef}>
                    {#if isTokenOwner || isTokenApproved}
                        <div class="text-sm justify-self-end flex flex-col space-y-2 m-1">
                            <button on:click={sendToken} class="flex flex-row items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                <i class="fas fa-paper-plane mr-2"></i>
                                <div class="w-full place-content-center">
                                    Transfer
                                </div>
                            </button>
                            {#if isTokenOwner}
                                <button on:click={approveToken} class="flex flex-row items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out min-h-14 w-full">
                                    <i class="fas fa-coins mr-2"></i>
                                    <div class="w-full place-content-center">
                                        {#if token.approved != zeroAddress}
                                            Change
                                        {:else}
                                            Set
                                        {/if}
                                        Approval
                                    </div>
                                </button>
                            {/if}
                            {#if (!listing || (listing && listing?.source === 'arcpay'))}
                                <button on:click={listArcpay} class="flex flex-row space-x-3 items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <div class="flex-col">
                                        <div class="flex flex-row place-content-center">
                                            {#if listing}
                                                <div>Update Listing</div>
                                            {:else}
                                                <div class="flex flex-col items-center justify-center text-sm">
                                                    <div>Sell on NFT Navigator</div>
                                                    <div class="flex flex-row items-center justify-center text-sm">
                                                        <span class="mr-1">with</span>
                                                        <img src="/logos/arcpay.png" alt="Arcpay Logo" class="h-7 opacity-50" />
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </button>
                            {/if}
                            {#if !listing || (listing && listing.source !== 'arcpay')}
                                <!--<button on:click={listToken} class="flex flex-row space-x-3 items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <div class="flex-col">
                                        <div class="flex flex-row place-content-center">
                                            {#if listing}
                                                <div>Update/Cancel</div>
                                            {:else}
                                                <div>Sell on</div>
                                            {/if}
                                        </div>
                                        <div class="flex flex-row">
                                            <img src={NautilusLogo} alt="Nautilus Logo" class="w-24 ml-1" />
                                        </div>
                                    </div>
                                </button>-->
                                <a href="https://nautilus.sh/#/collection/{token.contractId}/token/{token.tokenId}" target="_blank" class="flex flex-row space-x-3 items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <div class="flex-col">
                                        <div class="flex flex-row place-content-center">
                                            {#if listing}
                                                <div>Update/Cancel</div>
                                            {:else}
                                                <div>List on</div>
                                            {/if}
                                            <img src={NautilusLogo} alt="Nautilus Logo" class="w-24 ml-1" />
                                        </div>
                                    </div>
                                </a>
                            {/if}
                            {#if listing}
                                <button on:click={cancelListing} class="flex flex-row space-x-3 items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <div class="flex-col">
                                        <div class="flex flex-row place-content-center">
                                            Cancel Listing
                                        </div>
                                    </div>
                                </button>
                            {/if}
                        </div>
                    {:else if listing && !listing.sale && !listing.delete && $selectedWallet}
                        <div class="flex flex-col justify-start items-center">
                            {#if listing.source !== 'arcpay'}
                                <button on:click={buyToken} class="flex flex-row space-x-3 items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <div class="flex-col">
                                        <div class="flex flex-row place-content-center">
                                            <div>Buy from</div>
                                        </div>
                                        <div class="flex flex-row">
                                            <img src={NautilusLogo} alt="Nautilus Logo" class="w-24 ml-1" />
                                        </div>
                                    </div>
                                </button>
                            {:else}
                                <button on:click={buyArcpay} class="flex-row space-x-3 items-center px-4 py-2 bg-blue-700 text-white shadow hover:bg-blue-600 active:bg-blue-800 transition duration-150 ease-in-out w-full min-h-14">
                                    <i class="fas fa-shopping-cart mr-2"></i>
                                    <div class="flex-col">
                                        <div class="flex flex-row place-content-center">
                                            Buy on NFT Navigator
                                        </div>
                                    </div>
                                </button>
                            {/if}
                        </div>
                    {/if}
                </div>
            {/if}
        {/if}    
    </div>
{:else}
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
        <div class="max-w-7xl mx-auto">
            <!-- Top Section with Image and Basic Info -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden relative">
                <!-- Share Button -->
                <div class="absolute top-4 right-4 z-10">
                    <Share url={`https://nftnavigator.xyz/collection/${token.contractId}/token/${token.tokenId}`} 
                           text="Check out {token.metadata?.name??String(token.tokenId)} on NFT Navigator @voinftnavigator! #Voiagers #VoiNFTs" />
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8">
                    <!-- Left Column - Image -->
                    <div class="relative">
                        <div class="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700">
                            <img src={imageUrl} class="w-full h-full object-contain" alt={token.metadata?.name ?? `Token ${token.tokenId}`} />
                            {#if token.metadata?.envoiName && token.metadata?.image !== 'ipfs://QmcekfLHJqJfL1TqhMdGncyhfNJTx93ZqPikFsKKx4nUTi'}
                                <img src="/icons/envoi_icon.png" class="absolute bottom-4 right-4 w-16 h-16 rounded-full shadow-lg" alt="Envoi Logo" />
                            {/if}
                        </div>
                        {#if listing && !listing.sale && !listing.delete}
                            <div class="absolute top-4 right-4">
                                <div class="bg-red-500 text-white px-4 py-2 rounded-full font-medium flex items-center space-x-2">
                                    <i class="fas fa-tag"></i>
                                    <span>
                                        {#if currency}
                                            {(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}
                                        {:else}
                                            For Sale
                                        {/if}
                                    </span>
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Right Column - Basic Info -->
                    <div class="flex flex-col justify-between">
                        <div>
                            <h1 class="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                                {#if token.contractId === 797609}
                                    {token.metadata?.envoiName}
                                {:else}
                                    <TokenName name={token.metadata?.name??String(token.tokenId)} tokenId={token.tokenId}></TokenName>
                                {/if}
                            </h1>
                            
                            <div class="space-y-4">
                                <!-- Collection Info -->
                                <div class="flex items-center space-x-2">
                                    <i class="fas fa-layer-group text-purple-500"></i>
                                    <a href="/collection/{token.contractId}" class="text-lg text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">{collectionName}</a>
                                </div>
                                
                                <!-- Owner Info -->
                                <div class="flex items-center space-x-2">
                                    <i class="fas fa-user text-purple-500"></i>
                                    {#if token.isBurned}
                                        <span class="text-red-500 font-medium"><i class="fas fa-fire"></i> Burned</span>
                                    {:else}
                                        <a href="/portfolio/{token.owner}" class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{formattedOwner}</a>
                                    {/if}
                                </div>

                                {#if token.metadata?.description}
                                    <p class="text-gray-600 dark:text-gray-300 mt-4">{token.metadata.description}</p>
                                {/if}
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        {#if showMenuIcon && (isTokenOwner || isTokenApproved || (listing && !listing.sale && !listing.delete && $selectedWallet))}
                            <div class="flex flex-wrap gap-4 mt-8">
                                {#if isTokenOwner || isTokenApproved}
                                    <button on:click={sendToken} class="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                        <i class="fas fa-paper-plane"></i>
                                        <span>Transfer</span>
                                    </button>
                                    {#if isTokenOwner}
                                        <button on:click={approveToken} class="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-check-circle"></i>
                                            <span>{token.approved != zeroAddress ? 'Change' : 'Set'} Approval</span>
                                        </button>
                                    {/if}
                                    {#if (!listing || (listing && listing?.source === 'arcpay'))}
                                        <button on:click={listArcpay} class="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-tag"></i>
                                            <span>{listing ? 'Update' : 'List'} on NFT Navigator</span>
                                        </button>
                                    {/if}
                                    {#if !listing || (listing && listing.source !== 'arcpay')}
                                        <button on:click={listToken} class="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-tag"></i>
                                            <div class="flex flex-row items-center gap-2">
                                                <span>{listing ? 'Update/Cancel' : 'List'} on</span>
                                                <img src={NautilusLogo} alt="Nautilus Logo" class="h-7 mt-1 bg-white rounded-full bg-opacity-60 p-1" />
                                            </div>
                                        </button>
                                    {/if}
                                    {#if listing}
                                        <button on:click={cancelListing} class="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                                            <i class="fas fa-times"></i>
                                            <span>Cancel Listing</span>
                                        </button>
                                    {/if}
                                {:else if listing && !listing.sale && !listing.delete && $selectedWallet}
                                    {#if listing.source === 'arcpay'}
                                        <button on:click={buyArcpay} class="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-shopping-cart"></i>
                                            <span>Buy Now</span>
                                        </button>
                                    {:else}
                                        <button on:click={buyToken} class="flex items-center space-x-2 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                                            <i class="fas fa-shopping-cart"></i>
                                            <div class="flex flex-row items-center gap-2">
                                                <span>Buy from</span>
                                                <img src={NautilusLogo} alt="Nautilus Logo" class="h-7 mt-1 bg-white rounded-full bg-opacity-60 p-1" />
                                            </div>
                                        </button>
                                    {/if}
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Details Section -->
            <div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Token Details -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">Token Details</h2>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                            <span class="text-gray-600 dark:text-gray-400">Token ID</span>
                            <span class="font-medium">{token.metadata?.envoiName ?? token.tokenId} {#if collection}/ {collection.totalSupply}{/if}</span>
                        </div>
                        {#if token.rank}
                            <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                                <span class="text-gray-600 dark:text-gray-400">Ranking</span>
                                <span class="font-medium">{token.rank}</span>
                            </div>
                        {/if}
                        <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                            <span class="text-gray-600 dark:text-gray-400">Mint Round</span>
                            <a href="https://explorer.voi.network/explorer/block/{token.mintRound}/transactions" target="_blank" 
                               class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{token.mintRound}</a>
                        </div>
                        {#if royaltyPercentage > 0}
                            <div class="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                                <span class="text-gray-600 dark:text-gray-400">Royalties</span>
                                <span class="font-medium">{royaltyPercentage / 100}%</span>
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Properties/Metadata -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                    <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                        {#if token.contractId === 797609}
                            Profile Information
                        {:else}
                            Properties
                        {/if}
                    </h2>
                    {#if token.contractId === 797609 && token.metadata?.envoiMetadata}
                        <div class="space-y-4">
                            {#if token.metadata.envoiMetadata.url}
                                <div class="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <i class="fas fa-globe text-purple-500"></i>
                                    <a href={token.metadata.envoiMetadata.url} target="_blank" rel="noopener noreferrer" 
                                       class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{token.metadata.envoiMetadata.url}</a>
                                </div>
                            {/if}
                            {#if token.metadata.envoiMetadata.location}
                                <div class="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <i class="fas fa-map-marker-alt text-purple-500"></i>
                                    <span class="text-gray-600 dark:text-gray-400">{token.metadata.envoiMetadata.location}</span>
                                </div>
                            {/if}
                            {#if token.metadata.envoiMetadata['com.twitter']}
                                <div class="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <i class="fab fa-twitter text-purple-500"></i>
                                    <a href="https://twitter.com/{token.metadata.envoiMetadata['com.twitter']}" target="_blank" 
                                       class="text-purple-600 dark:text-purple-400 hover:text-purple-700">@{token.metadata.envoiMetadata['com.twitter']}</a>
                                </div>
                            {/if}
                            {#if token.metadata.envoiMetadata['com.github']}
                                <div class="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <i class="fab fa-github text-purple-500"></i>
                                    <a href="https://github.com/{token.metadata.envoiMetadata['com.github']}" target="_blank" 
                                       class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{token.metadata.envoiMetadata['com.github']}</a>
                                </div>
                            {/if}
                            {#each Object.entries(token.metadata.envoiMetadata) as [key, value]}
                                {#if !['url', 'location', 'com.twitter', 'com.github', 'avatar'].includes(key) && value}
                                    <div class="flex items-center space-x-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                        <i class="fas fa-info-circle text-purple-500"></i>
                                        <div class="flex-1">
                                            <div class="text-sm text-gray-500 dark:text-gray-400">{key.replace('com.', '').charAt(0).toUpperCase() + key.replace('com.', '').slice(1)}</div>
                                            {#if typeof value === 'string' && value.match(/^https?:\/\//)}
                                                <a href={value} target="_blank" rel="noopener noreferrer" 
                                                   class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{value}</a>
                                            {:else}
                                                <span class="text-gray-900 dark:text-gray-100">{value}</span>
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    {:else}
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {#each tokenProps as prop}
                                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                                    <div class="text-sm text-gray-500 dark:text-gray-400">{prop.trait_type}</div>
                                    {#if prop.value && typeof prop.value === 'string' && prop.value.match(/^https?:\/\//)}
                                        <a href={prop.value} target="_blank" rel="noopener noreferrer" 
                                           class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{prop.value}</a>
                                    {:else}
                                        <div class="font-medium text-gray-900 dark:text-gray-100">{prop.value}</div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

{#if showSendTokenModal}
    <SendTokenModal bind:showModal={showSendTokenModal} bind:type={sendTokenModalType} bind:token={token} onAfterSend={onAfterSend} fromAddr={$selectedWallet?.address??''} />
{/if}
{#if showBuyTokenModal && listing}
    <BuyTokenModal bind:showModal={showBuyTokenModal} token={token} listing={listing} onAfterSend={onAfterSend} fromAddr={$selectedWallet?.address??''} />
{/if}
{#if showListTokenModal}
    <ListTokenModal bind:showModal={showListTokenModal} bind:token={token} listing={listing} onAfterSend={onAfterSend} fromAddr={$selectedWallet?.address??''} />
{/if}
{#if waitingForConfirmationModal}
    <div class="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
            <div class="text-center">
                <div class="text-2xl font-bold text-red-500">Waiting for Confirmation</div>
                <div class="text-lg">Please wait while the token information is refreshed.</div>
            </div>
        </div>
    </div>
{/if}

<style>
    a {
        text-decoration: none;
    }
    .badge {
        margin: 0;
        padding: 0;
        color: white;
        padding: 1px 10px;
        font-size: 15px;
        font-family: Arial, Helvetica, sans-serif;
        text-align: center;
        line-height: normal;
        text-transform: uppercase;
        background: #ed1b24;
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
        -ms-transform: translateX(20%) translateY(20%) rotate(45deg);
        -webkit-transform: translateX(20%) translateY(20%) rotate(45deg);
        transform: translateX(20%) translateY(20%) rotate(45deg);
        -ms-transform-origin: top left;
        -webkit-transform-origin: top left;
        transform-origin: top left;
    }
</style>