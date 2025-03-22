<script lang="ts">
    import type { Token, Collection, Listing, Currency, Auction, Sale } from '$lib/data/types';
    import { reformatTokenName } from '$lib/utils/indexer';
    import { zeroAddress } from '$lib/data/constants';
    import { selectedWallet } from 'avm-wallet-svelte';
	import SendTokenModal from './SendTokenModal.svelte';
	import { getCurrency } from '$lib/utils/currency';
	import { onDestroy, onMount } from 'svelte';
	import algosdk from 'algosdk';
	import { getTokenImageUrl } from '$lib/utils/functions';
    import { getTokens, indexerBaseURL } from '$lib/utils/indexer';
	import BuyTokenModal from './BuyTokenModal.svelte';
    import ListTokenModal from './ListTokenModal.svelte';
    import NautilusLogo from '$lib/assets/nautilus.svg';
    import ArcpayLogo from '$lib/assets/arcpay.png';
    import { buyToken as buyTokenArcpay, getListings as getListingsArcpay, listToken as listTokenArcpay, getTokenListing, cancelListing as cancelListingArcpay } from '$lib/arcpay';
    import type { Listing as AListing } from '$lib/arcpay';
    import { browser } from '$app/environment';
    import NautilusButton from '$lib/component/ui/NautilusButton.svelte';
    import HighforgeButton from '$lib/component/ui/HighforgeButton.svelte';
    import NftGamesButton from '$lib/component/ui/NFTGamesButton.svelte';
    import PixelPursuitButton from '$lib/component/ui/PixelPursuitButton.svelte';
    import LoungeButton from '$lib/component/ui/LoungeButton.svelte';
    import TransactionTable from '$lib/component/ui/TransactionTable.svelte';
    import { algodIndexer } from '$lib/utils/algod';
    import ImageModal from '$lib/component/ui/ImageModal.svelte';
    import { getEnvoiNames } from '$lib/utils/envoi';

    export let token: Token;
    export let collection: Collection | undefined;
    export let format = 'large';
    export let listing: Listing | null = null;
    export let showMenuIcon = true;
    export let isModal = false;
    //export let quality = 'normal';

    let formattedOwner = '';
    let royaltyPercentage = 0;
    let isTokenOwner = false;
    let isTokenApproved = false;
    let showSendTokenModal = false;
    let showBuyTokenModal = false;
    let showListTokenModal = false;
    let showImageModal = false;
    let sendTokenModalType = 'send';
    let tokenProps: any[] = [];
    let formattedApproved = '';
    let hidden = false;
    let showMenu = false;
    let menuRef: HTMLElement | null = null;
	let windowDefined = false;
    let waitingForConfirmationModal = false;
    let activeTab = 'details';
    let mintDate: string | null = null;
    let mintDateTime: string | null = null;
    let showZoomButton = false;
    let isTouchDevice = false;
    let approvedSpender = '';

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

        // Check if device supports touch events
        isTouchDevice = ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0);
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

            getEnvoiNames([token.approved]).then((names) => approvedSpender = names[0]?.name ?? token.approved.slice(0, 8) + '...' + token.approved.slice(-8));

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

    function setActiveTab(tab: string) {
        activeTab = tab;
    }

    async function getMintDate() {
        if (token?.mintRound) {
            try {
                const roundInfo = await algodIndexer.lookupBlock(token.mintRound).do();
                const timestamp = roundInfo.timestamp;
                const date = new Date(timestamp * 1000);
                mintDate = date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric'
                });
                mintDateTime = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: true
                });
            } catch (err) {
                console.error('Error fetching mint date:', err);
                mintDate = null;
                mintDateTime = null;
            }
        }
    }

    // Call getMintDate when token changes
    $: {
        if (token?.mintRound) {
            getMintDate();
        }
    }

    function handleImageClick() {
        if (isTouchDevice) {
            showZoomButton = !showZoomButton;
        }
    }

</script>

<div class="{isModal ? 'bg-gray-900' : 'min-h-screen bg-gray-50 dark:bg-gray-900 py-4 px-4 sm:px-6 lg:px-8'}">
    <div class="{isModal ? '' : 'max-w-7xl mx-auto'}">
        <!-- Main Content Card -->
        <div class="{isModal ? '' : 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden'}">
            {#if !isModal}
                <!-- Top Integration Bar -->
                <div class="w-full bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-end gap-4">
                        <LoungeButton contractid={String(token.contractId)} 
                            buttonClass="flex items-center justify-center gap-3 p-3 rounded-xl text-black bg-gradient-to-b from-white to-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 w-[8rem] h-[3.5rem] relative after:absolute after:inset-0 after:rounded-xl after:bg-purple-100/0 hover:after:bg-purple-100/50 after:transition-colors" />
                        
                        <NautilusButton contractid={String(token.contractId)} tokenid={String(token.tokenId)}
                            buttonClass="flex items-center justify-center gap-3 p-3 rounded-xl bg-gradient-to-b from-white to-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 w-[8rem] h-[3.5rem] relative after:absolute after:inset-0 after:rounded-xl after:bg-blue-100/0 hover:after:bg-blue-100/50 after:transition-colors" />
                        
                        <HighforgeButton contractid={String(token.contractId)}
                            buttonClass="flex items-center justify-center gap-3 p-3 rounded-xl bg-gradient-to-b from-white to-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 w-[8rem] h-[3.5rem] relative after:absolute after:inset-0 after:rounded-xl after:bg-orange-100/0 hover:after:bg-orange-100/50 after:transition-colors" />
                        
                        <PixelPursuitButton contractid={String(token.contractId)} tokenid={String(token.tokenId)}
                            buttonClass="flex items-center justify-center gap-3 p-3 rounded-xl bg-gradient-to-b from-white to-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 w-[8rem] h-[3.5rem] relative after:absolute after:inset-0 after:rounded-xl after:bg-green-100/0 hover:after:bg-green-100/50 after:transition-colors" />
                        
                        {#if collection?.gameData}
                            <NftGamesButton contractid={String(token.contractId)}
                                buttonClass="flex items-center justify-center gap-3 p-3 rounded-xl bg-gradient-to-b from-white to-gray-100 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 w-[8rem] h-[3.5rem] relative after:absolute after:inset-0 after:rounded-xl after:bg-red-100/0 hover:after:bg-red-100/50 after:transition-colors" />
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- Main Content Grid -->
            <div class="grid grid-cols-1 {isModal ? 'lg:grid-cols-5 gap-4 p-6' : 'lg:grid-cols-2 gap-8 p-8'}">
                <!-- Left Column - Image -->
                <div class="relative {isModal ? 'lg:col-span-2' : ''}">
                    <div class="group w-full h-auto rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800/50 transition-transform duration-300 hover:scale-[1.02] transform-gpu" 
                         on:click={() => showImageModal = true}
                         on:keydown={(e) => e.key === 'Enter' && (showImageModal = true)}
                         role="button"
                         tabindex="0">
                        {#if token.metadata?.envoiName}
                            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/20 to-purple-600/20">
                                <img src={token.metadata?.envoiMetadata?.avatar ?? '/blank_avatar.png'} 
                                     class="w-64 h-64 rounded-[40%] border-4 border-purple-500/50 shadow-2xl" 
                                     alt={token.metadata?.envoiName} />
                            </div>
                            <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-6 py-4">
                                <div class="flex items-center gap-4">
                                    <div class="flex-1">
                                        <h2 class="text-white font-bold text-2xl">{token.metadata?.envoiName}</h2>
                                        <p class="text-purple-400 text-lg">Envoi Name</p>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <img src={imageUrl} 
                                 class="w-full h-auto object-contain aspect-square" 
                                 alt={token.metadata?.name ?? `Token ${token.tokenId}`} 
                                 loading="lazy" />

                            <!-- Zoom Icon -->
                            <div class="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div class="p-2 bg-black/60 rounded-full text-white/90 hover:text-white">
                                    <i class="fas fa-expand-alt"></i>
                                </div>
                            </div>
                        {/if}
                    </div>
                    
                    <!-- Sale Badge -->
                    {#if listing && !listing.sale && !listing.delete}
                        <div class="absolute top-4 right-4">
                            <div class="flex items-center gap-2 bg-gradient-to-r from-purple-600/90 to-purple-800/90 rounded-lg px-4 py-2 shadow-lg backdrop-blur-sm">
                                <i class="fas {listing?.type === 'dutch_auction' ? 'fa-gavel' : 'fa-tag'} text-white/90"></i>
                                <div class="flex flex-col">
                                    <span class="text-white/90 text-sm font-medium">
                                        {#if listing?.type === 'dutch_auction'}
                                            Reverse Auction
                                        {:else}
                                            For Sale
                                        {/if}
                                    </span>
                                    {#if currency}
                                        <span class="text-white font-bold">
                                            {(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <!-- Right Column - Token Info -->
                <div class="{isModal ? 'lg:col-span-3' : ''} flex flex-col justify-between space-y-4">
                    <!-- Token Info -->
                    <div class="space-y-4">
                        <h1 class="{isModal ? 'text-3xl' : 'text-4xl'} font-bold text-gray-900 dark:text-white">
                            {#if token.contractId === 797609}
                                {token.metadata?.envoiName}
                            {:else}
                                {reformatTokenName(token.metadata?.name??String(token.tokenId), token.tokenId)}
                            {/if}
                        </h1>
                        
                        <div class="space-y-3">
                            <!-- Collection Link -->
                            <div class="flex items-center space-x-3">
                                <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <i class="fas fa-layer-group text-purple-500"></i>
                                </div>
                                <a href="/collection/{token.contractId}" class="text-lg text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium">{collectionName}</a>
                            </div>
                            
                            <!-- Owner Info -->
                            <div class="flex items-center space-x-3">
                                <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <i class="fas fa-user text-purple-500"></i>
                                </div>
                                {#if token.isBurned}
                                    <span class="text-red-500 font-medium"><i class="fas fa-fire"></i> Burned</span>
                                {:else}
                                    <a href="/portfolio/{token.owner}" class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">{formattedOwner}</a>
                                {/if}
                            </div>

                            {#if token.metadata?.description}
                                <p class="text-gray-600 dark:text-gray-300 mt-2 leading-relaxed {isModal ? 'line-clamp-3' : ''}">{token.metadata.description}</p>
                            {/if}
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    {#if showMenuIcon && (isTokenOwner || isTokenApproved || (listing && !listing.sale && !listing.delete && $selectedWallet))}
                        <div class="space-y-4">
                            <!-- Primary Actions Group -->
                            {#if isTokenOwner || isTokenApproved}
                                <div class="flex flex-wrap gap-3">
                                    <!-- Token Management Actions -->
                                    <div class="flex gap-2">
                                        <button on:click={sendToken} 
                                                class="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow hover:shadow-md">
                                            <i class="fas fa-paper-plane"></i>
                                            <span>Transfer</span>
                                        </button>
                                        
                                        {#if isTokenOwner}
                                            <button on:click={approveToken}
                                                    class="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow hover:shadow-md">
                                                <i class="fas fa-check-circle"></i>
                                                <span>{token.approved != zeroAddress ? 'Change' : 'Set'} Approval</span>
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/if}

                            <!-- Marketplace Actions Group -->
                            <div class="flex flex-wrap gap-3">
                                <!-- Seller Actions -->
                                {#if isTokenOwner || isTokenApproved}
                                    <div class="flex gap-2">
                                        {#if (!listing || (listing && listing.source === 'arcpay'))}
                                            <button on:click={listArcpay}
                                                class="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow hover:shadow-md">
                                                <div class="flex items-center gap-2">
                                                    <i class="fas fa-tag"></i>
                                                    {#if listing}
                                                        Update <img src={ArcpayLogo} alt="Arcpay Logo" class="h-7" />
                                                    {:else}
                                                        List with <img src={ArcpayLogo} alt="Arcpay Logo" class="h-7" />
                                                    {/if}
                                                </div>
                                            </button>
                                        {/if}

                                        {#if !listing || (listing && listing.source !== 'arcpay')}
                                            <button on:click={listToken}
                                                class="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 shadow hover:shadow-md">
                                                <div class="flex items-center gap-2">
                                                    <i class="fas fa-tag"></i>
                                                    <span>{listing ? 'Update on' : 'List on'}</span>
                                                    <img src={NautilusLogo} alt="Nautilus Logo" class="h-7 bg-white rounded-full bg-opacity-60 p-1" />
                                                </div>
                                            </button>
                                        {/if}

                                        {#if listing}
                                            <button on:click={cancelListing}
                                                    class="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-300 shadow hover:shadow-md">
                                                <i class="fas fa-times"></i>
                                                <span>Cancel Listing</span>
                                            </button>
                                        {/if}
                                    </div>
                                {/if}

                                <!-- Buyer Actions -->
                                {#if listing && !listing.sale && !listing.delete && $selectedWallet && !isTokenOwner}
                                    <div class="flex gap-2">
                                        <button on:click={listing.source !== 'arcpay' ? buyToken : buyArcpay}
                                                class="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl">
                                            <i class="fas fa-shopping-cart"></i>
                                            <div class="flex items-center gap-2">
                                                <span>Buy Now</span>
                                                {#if currency}
                                                    <span class="font-bold">({(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName})</span>
                                                {/if}
                                            </div>
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Tab Section -->
            <div class="mt-0 mb-6 border-b border-gray-200 dark:border-gray-700">
                <div class="flex gap-8">
                    <button class="px-4 py-2 font-medium text-sm {activeTab === 'details' ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
                            on:click={() => setActiveTab('details')}>
                        <i class="fas fa-info-circle mr-2"></i>
                        Details & Properties
                    </button>
                    <button class="px-4 py-2 font-medium text-sm {activeTab === 'transactions' ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
                            on:click={() => setActiveTab('transactions')}>
                        <i class="fas fa-exchange-alt mr-2"></i>
                        Transaction History
                    </button>
                </div>
            </div>

            <!-- Tab Content -->
            {#if activeTab === 'details'}
                <!-- Details Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 pt-0">
                    <!-- Token Details -->
                    <div class="bg-gray-50 dark:bg-gray-900/50 rounded-2xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] border border-gray-100 dark:border-gray-700/50">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <i class="fas fa-info-circle text-purple-500"></i>
                            Token Details
                        </h2>
                        <div class="space-y-4">
                            <div class="flex justify-between items-center py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                <span class="text-gray-600 dark:text-gray-400">Token ID</span>
                                <span class="font-medium text-gray-900 dark:text-white">{token.metadata?.envoiName ?? token.tokenId} {#if collection}/ {collection.totalSupply}{/if}</span>
                            </div>
                            {#if token.rank}
                                <div class="flex justify-between items-center py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                    <span class="text-gray-600 dark:text-gray-400">Ranking</span>
                                    <span class="font-medium text-gray-900 dark:text-white">#{token.rank}</span>
                                </div>
                            {/if}
                            <div class="flex justify-between items-center py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                <span class="text-gray-600 dark:text-gray-400">Minted</span>
                                <a href={`https://explorer.voi.network/explorer/block/${token.mintRound}/transactions`} target="_blank" class="tooltip cursor-pointer">
                                    {#if mintDateTime}
                                        <div class="flex flex-col space-y-1 w-auto whitespace-nowrap p-2">
                                            <div class="dark:text-white">{mintDateTime}</div>
                                            <div class="text-xs text-blue-500 dark:text-blue-300">Click to view in explorer</div>
                                        </div>
                                    {:else}
                                        <span class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">{token.mintRound}</span>
                                    {/if}
                                </a>
                            </div>
                            {#if token.approved && token.approved !== zeroAddress}
                                <div class="flex justify-between items-center py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors group">
                                    <div class="flex items-center gap-2">
                                        <span class="text-gray-600 dark:text-gray-400">Approved Spender</span>
                                        <div class="tooltip">
                                            <i class="fas fa-info-circle text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"></i>
                                            <div class="tooltiptext w-64 text-sm">
                                                This address is approved to transfer the token on behalf of the owner (e.g., a marketplace contract).
                                            </div>
                                        </div>
                                    </div>
                                    <a href="/portfolio/{token.approved}" class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">
                                        {approvedSpender}
                                    </a>
                                </div>
                            {/if}
                            {#if royaltyPercentage > 0}
                                <div class="flex justify-between items-center py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                    <span class="text-gray-600 dark:text-gray-400">Royalties</span>
                                    <span class="font-medium text-gray-900 dark:text-white">{royaltyPercentage / 100}%</span>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Properties -->
                    <div class="bg-gray-50 dark:bg-gray-900/50 rounded-2xl shadow-xl p-6 transform transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] border border-gray-100 dark:border-gray-700/50">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                            <i class="fas fa-tags text-purple-500"></i>
                            {#if token.contractId === 797609}
                                Profile Information
                            {:else}
                                Properties
                            {/if}
                        </h2>
                        {#if token.contractId === 797609 && token.metadata?.envoiMetadata}
                            <div class="space-y-4">
                                {#if token.metadata.envoiMetadata.url}
                                    <div class="flex items-center gap-4 py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                        <i class="fas fa-globe text-purple-500 w-6"></i>
                                        <a href={token.metadata.envoiMetadata.url} target="_blank" rel="noopener noreferrer" 
                                           class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{token.metadata.envoiMetadata.url}</a>
                                    </div>
                                {/if}
                                {#if token.metadata.envoiMetadata.location}
                                    <div class="flex items-center gap-4 py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                        <i class="fas fa-map-marker-alt text-purple-500 w-6"></i>
                                        <span class="text-gray-900 dark:text-white">{token.metadata.envoiMetadata.location}</span>
                                    </div>
                                {/if}
                                {#if token.metadata.envoiMetadata['com.twitter']}
                                    <div class="flex items-center gap-4 py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                        <i class="fab fa-x-twitter text-purple-500 w-6"></i>
                                        <a href="https://twitter.com/{token.metadata.envoiMetadata['com.twitter']}" target="_blank" 
                                           class="text-purple-600 dark:text-purple-400 hover:text-purple-700">@{token.metadata.envoiMetadata['com.twitter']}</a>
                                    </div>
                                {/if}
                                {#if token.metadata.envoiMetadata['com.github']}
                                    <div class="flex items-center gap-4 py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                        <i class="fab fa-github text-purple-500 w-6"></i>
                                        <a href="https://github.com/{token.metadata.envoiMetadata['com.github']}" target="_blank" 
                                           class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{token.metadata.envoiMetadata['com.github']}</a>
                                    </div>
                                {/if}
                                {#each Object.entries(token.metadata.envoiMetadata) as [key, value]}
                                    {#if !['url', 'location', 'com.twitter', 'com.github', 'avatar'].includes(key) && value}
                                        <div class="flex items-center gap-4 py-3 px-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors">
                                            <i class="fas fa-info-circle text-purple-500 w-6"></i>
                                            <div class="flex-1">
                                                <div class="text-sm text-gray-500 dark:text-gray-400">{key.replace('com.', '').charAt(0).toUpperCase() + key.replace('com.', '').slice(1)}</div>
                                                {#if typeof value === 'string' && value.match(/^https?:\/\//)}
                                                    <a href={value} target="_blank" rel="noopener noreferrer" 
                                                       class="text-purple-600 dark:text-purple-400 hover:text-purple-700">{value}</a>
                                                {:else}
                                                    <span class="text-gray-900 dark:text-white">{value}</span>
                                                {/if}
                                            </div>
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        {:else}
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {#each tokenProps as prop}
                                    <div class="p-4 rounded-lg bg-white dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-gray-700 transition-all duration-300 transform hover:scale-[1.02]">
                                        <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">{prop.trait_type}</div>
                                        {#if prop.value && typeof prop.value === 'string' && prop.value.match(/^https?:\/\//)}
                                            <a href={prop.value} target="_blank" rel="noopener noreferrer" 
                                               class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">{prop.value}</a>
                                        {:else}
                                            <div class="font-medium text-gray-900 dark:text-white">{prop.value}</div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </div>
            {:else if activeTab === 'transactions'}
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                    <TransactionTable {token} />
                </div>
            {/if}
        </div>
    </div>
</div>

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
    <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div class="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
            <div class="text-center space-y-4">
                <div class="text-3xl font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-3">
                    <i class="fas fa-circle-notch fa-spin"></i>
                    <span>Processing</span>
                </div>
                <div class="text-gray-600 dark:text-gray-300">Please wait while we update the token information...</div>
            </div>
        </div>
    </div>
{/if}

{#if showImageModal}
    <ImageModal 
        bind:showModal={showImageModal}
        imageUrl={imageUrl ?? ''}
        altText={token.metadata?.name ?? `Token ${token.tokenId}`}
    />
{/if}

<style>
    /* Keep existing styles and add: */
    .backdrop-blur-sm {
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    /* Smooth transitions */
    .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 300ms;
    }

    /* Hover effects */
    .hover\:scale-\[1\.02\]:hover {
        transform: scale(1.02);
    }

    .hover\:shadow-2xl:hover {
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }

    /* Tooltip styles */
    .tooltip {
        position: relative;
        display: inline-block;
    }

    .tooltip .tooltiptext {
        visibility: hidden;
        position: absolute;
        z-index: 1;
        bottom: 125%;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: #fff;
        text-align: center;
        padding: 8px;
        border-radius: 6px;
        font-size: 14px;
        white-space: normal;
        opacity: 0;
        transition: opacity 0.3s;
    }

    .tooltip:hover .tooltiptext {
        visibility: visible;
        opacity: 1;
    }

    /* Add a small arrow to the tooltip */
    .tooltip .tooltiptext::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
    }
</style>

