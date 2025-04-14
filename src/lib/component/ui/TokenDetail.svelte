<script lang="ts">
    import type { Token, Collection, Listing, Currency } from '$lib/data/types';
    import TokenName from '$lib/component/ui/TokenName.svelte';
    import { zeroAddress } from '$lib/data/constants';
    import { selectedWallet } from 'avm-wallet-svelte';
	import SendTokenModal from './SendTokenModal.svelte';
	import { goto } from '$app/navigation';
	import { getCurrency } from '$lib/utils/currency';
	import { onDestroy, onMount } from 'svelte';
	import algosdk from 'algosdk';
	import { getTokenImageUrl } from '$lib/utils/functions';
    import { getTokens, indexerBaseURL } from '$lib/utils/indexer';
	import BuyTokenModal from './BuyTokenModal.svelte';
    import ListTokenModal from './ListTokenModal.svelte';
    import NautilusLogo from '$lib/assets/nautilus.svg';
    import { listToken as listTokenArcpay, getTokenListing, cancelListing as cancelListingArcpay } from '$lib/arcpay';
    import type { Listing as AListing } from '$lib/arcpay';
    import { browser } from '$app/environment';
    import TokenDetailModal from './TokenDetailModal.svelte';

    export let token: Token;
    export let collection: Collection | undefined;
    export let showOwnerIcon = true;
    export let format = 'small';
    export let listing: Listing | null = null;
    export let showMenuIcon = true;
    export let disableHover = false;
    export let shape: 'rectangle' | 'square' = 'rectangle';
    //export let quality = 'normal';

    let formattedOwner = '';
    let isTokenOwner = false;
    let isTokenApproved = false;
    let showSendTokenModal = false;
    let showBuyTokenModal = false;
    let showListTokenModal = false;
    let showDetailModal = false;
    let sendTokenModalType = 'send';
    let tokenProps: any[] = [];
    let hidden = false;
    let showMenu = false;
    let menuRef: HTMLElement | null = null;
	let windowDefined = false;
    let waitingForConfirmationModal = false;
    let isExpanded = false;

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

    function toggleExpanded(e: MouseEvent | KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();
        isExpanded = !isExpanded;
    }

    onMount(() => {
        windowDefined = typeof window !== 'undefined';
    });

    onDestroy(() => {
        if (windowDefined && document) {
            document.removeEventListener('click', handleClickOutside);
        }
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
                const marketUrl = `${indexerBaseURL}/mp/listings?collectionId=${token.contractId}&tokenId=${token.tokenId}&active=true`;
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
                // royaltyPercentage = (bytes[0] << 8) | bytes[1];
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

            // formattedApproved = token.approved ? token.approved.length > 8
            //     ? `${token.approved.slice(0, 8)}...${token.approved.slice(-8)}`
            //     : token.approved : '';
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

    function navigateToCollection(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        goto(`/collection/${token.contractId}`);
    }

</script>
    <div class="relative overflow-hidden {hidden ? 'hidden' : ''}" style="display: {hidden ? 'none' : 'block'}">
        <div 
           class="relative overflow-hidden place-self-center rounded-xl {disableHover ? '' : 'group'} block w-full {shape === 'square' ? 'sm:w-72 sm:h-72' : 'sm:w-60 sm:h-72'}"
           on:click|preventDefault={() => showDetailModal = true}
           on:keydown|preventDefault={(e) => e.key === 'Enter' && (showDetailModal = true)}
           role="button"
           tabindex="0">
            {#if token.metadata?.envoiName}
                <div class="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-purple-600/20">
                    <div class="w-full h-full p-6">
                        <img src={token.metadata?.envoiMetadata?.avatar ?? '/blank_avatar.png'} 
                             class="w-full h-full object-cover rounded-[40%] border-4 border-purple-500/50 shadow-2xl" 
                             alt={token.metadata?.envoiName} />
                    </div>
                </div>
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="flex-1">
                            <h3 class="text-white font-bold text-xl">{token.metadata?.envoiName}</h3>
                            <p class="text-purple-400 text-sm">Envoi Name</p>
                        </div>
                    </div>
                </div>
            {:else}
                <img src={imageUrl} 
                     class="w-full {shape === 'square' ? 'sm:w-72 sm:h-72' : 'sm:w-60 sm:h-72'} object-cover transition-transform duration-300 {!isExpanded && 'group-hover:scale-105'}" 
                     alt={token.metadata?.name ?? `Token ${token.tokenId}`} 
                     loading="lazy" />
                <!-- Owner Badge -->
                {#if showOwnerIcon && isTokenOwner}
                    <div class="absolute top-2 left-2 z-[4] transition-opacity duration-300 {isExpanded ? 'opacity-0' : 'opacity-90'}">
                        <div class="flex items-center gap-2 bg-gradient-to-r from-green-600/90 to-green-800/90 rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-sm">
                            <i class="fas fa-user-check text-white/90"></i>
                            <span class="text-white/90 text-xs font-medium">Owner</span>
                        </div>
                    </div>
                {/if}
                    <!-- Always visible overlay content -->
                    <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                        <div class="space-y-1">
                            <h3 class="text-white font-bold text-lg truncate">
                                {#if token.contractId === 797609}
                                    {token.metadata?.envoiName}
                                {:else}
                                    <TokenName name={token.metadata?.name??String(token.tokenId)} tokenId={token.tokenId}></TokenName>
                                {/if}
                            </h3>
                            <div class="flex items-center justify-between text-sm">
                                <button
                                   class="text-gray-400 hover:text-white text-sm flex items-center gap-1"
                                   on:click|preventDefault|stopPropagation={() => goto(`/portfolio/${token.owner}`)}>
                                    <i class="fas fa-user text-xs"></i>
                                    {formattedOwner}
                                </button>
                                {#if token.rank && !token.metadata?.envoiName}
                                    <span class="text-yellow-500 flex items-center gap-1">
                                        <i class="fas fa-trophy text-sm"></i>
                                        #{token.rank}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>
            {/if}

            <!-- Permanent Sale Badge -->
            {#if listing && !listing.sale && !listing.delete}
                <div class="absolute top-2 left-2 transition-opacity duration-300 {isExpanded ? 'opacity-0' : 'opacity-90'}">
                    <div class="flex items-center gap-2 bg-gradient-to-r from-purple-600/90 to-purple-800/90 rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-sm">
                        <i class="fas {listing?.type === 'dutch_auction' ? 'fa-gavel' : 'fa-tag'} text-white/90"></i>
                        <div class="flex flex-col">
                            <span class="text-white/90 text-xs font-medium">
                                {#if listing?.type === 'dutch_auction'}
                                    Reverse Auction
                                {:else}
                                    For Sale
                                {/if}
                            </span>
                            {#if currency}
                                <span class="text-white font-bold text-sm">
                                    {(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName}
                                </span>
                            {/if}
                        </div>
                    </div>
                </div>
            {:else if isTokenOwner && token.approved !== zeroAddress && token.approved !== token.owner}
                <!-- Approval Badge -->
                <div class="absolute top-2 left-2 transition-opacity duration-300 {isExpanded ? 'opacity-0' : 'opacity-90'} approval-badge">
                    <div class="flex items-center gap-2 bg-gradient-to-r from-amber-500/90 to-amber-700/90 rounded-lg px-3 py-1.5 shadow-lg backdrop-blur-sm">
                        <i class="fas fa-key text-white/90"></i>
                        <div class="flex flex-col">
                            <span class="text-white/90 text-xs font-medium">
                                Approved
                            </span>
                            <span class="text-white font-bold text-sm">
                                {token.approved ? token.approved.slice(0, 4) + '...' + token.approved.slice(-4) : ''}
                            </span>
                        </div>
                    </div>
                    <div class="approval-tooltip">
                        <div class="tooltip-content">
                            This token is approved for spending by {token.approved}
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Quick Action Buttons -->
            <div class="absolute top-2 right-2 z-[5] flex gap-2">
                <!-- Expand/Collapse Button -->
                <button 
                    class="p-2 bg-gray-900/70 hover:bg-gray-900/90 rounded-lg transition-colors duration-150 backdrop-blur-sm"
                    on:click={toggleExpanded}
                    aria-label="Toggle Details">
                    <i class="fas {isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-white/90"></i>
                </button>

                {#if showMenuIcon && (isTokenOwner || isTokenApproved || (listing && !listing.sale && !listing.delete && $selectedWallet))}
                    <button 
                        class="p-2 bg-gray-900/70 hover:bg-gray-900/90 rounded-lg transition-colors duration-150 backdrop-blur-sm"
                        on:click|stopPropagation|preventDefault={toggleMenu}
                        on:mousedown|stopPropagation|preventDefault
                        on:mouseup|stopPropagation|preventDefault
                        aria-label="Token Actions">
                        <i class="fas fa-ellipsis-h text-white/90"></i>
                    </button>
                {/if}
            </div>
            
            <!-- Info Overlay -->
            <div class="absolute inset-0 bg-black/70 {isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} transition-opacity duration-300 flex flex-col justify-between p-4 overflow-hidden z-[2]"
                 on:click|stopPropagation|preventDefault
                 on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && toggleExpanded(e)}
                 role="button"
                 tabindex="0">
                <!-- Main Content Section -->
                <div class="flex-1 flex flex-col justify-between">
                    <!-- Top Section with Title and Collection -->
                    <div class="space-y-2">
                        <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-200">
                            <h3 class="text-white font-bold mb-2 typewriter-effect">
                                {#if token.contractId === 797609}
                                    {token.metadata?.envoiName}
                                {:else}
                                    <TokenName name={token.metadata?.name??String(token.tokenId)} tokenId={token.tokenId}></TokenName>
                                {/if}
                            </h3>
                        </div>
                        
                        <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-250">
                            <p class="text-white/80 text-sm">Collection: <span 
                                on:click|stopPropagation|preventDefault={navigateToCollection}
                                on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && goto(`/collection/${token.contractId}`)}
                                class="text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                                role="link"
                                tabindex="0">{collectionName}</span></p>
                        </div>
                        
                        {#if token.rank && !token.metadata?.envoiName}
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-300">
                                <p class="text-white/80 text-sm">Rank: #{token.rank}</p>
                            </div>
                        {/if}
                    </div>

                    <!-- Middle Section with Owner Details -->
                    <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-350">
                        <p class="text-white/80 text-sm line-clamp-2">
                            <span class="font-bold">Owner:</span>
                            {#if token.isBurned}
                                <span class="text-red-500 font-medium"><i class="fas fa-fire"></i> Burned</span>
                            {:else}
                                <span 
                                   on:click|stopPropagation|preventDefault={() => goto(`/portfolio/${token.owner}`)}
                                   on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && goto(`/portfolio/${token.owner}`)}
                                   class="text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium cursor-pointer"
                                   role="link"
                                   tabindex="0">
                                    {#if token.ownerNFD}
                                        {token.ownerNFD}
                                    {:else}
                                        {formattedOwner}
                                    {/if}
                                </span>
                            {/if}
                        </p>
                    </div>

                    <!-- Bottom Section with Buy Options and Properties/Metadata -->
                    <div class="space-y-3">
                        <!-- Buy Options -->
                        {#if listing && !listing.sale && !listing.delete && $selectedWallet && listing.seller !== $selectedWallet.address}
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-400">
                                <div class="flex gap-2">
                                    <button on:click|stopPropagation|preventDefault={buyToken}
                                            class="flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2 bg-blue-500/90 hover:bg-blue-600/90 text-white rounded-lg transition-colors backdrop-blur-sm">
                                        <div class="flex items-center gap-2">
                                            <i class="fas fa-shopping-cart text-sm"></i>
                                            <span class="text-sm font-medium">Buy Now</span>
                                            {#if currency}
                                                <span class="text-sm font-bold">
                                                    ({(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName})
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="text-xs text-white/80 flex items-center gap-1.5">
                                            Powered by {#if listing.source === 'arcpay'}
                                                NFT Navigator
                                            {:else}
                                                <img src={NautilusLogo} alt="Nautilus Logo" class="h-3.5 bg-white/90 rounded-full p-0.5" />
                                            {/if}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        {/if}

                        <!-- Properties or Metadata -->
                        {#if token.metadata?.envoiName}
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-450">
                                <div class="space-y-2">
                                    {#if token.metadata?.envoiMetadata}
                                        <div class="flex flex-col gap-2">
                                            {#if token?.metadata?.envoiMetadata?.url}
                                                <div class="flex items-center gap-2">
                                                    <i class="fas fa-globe text-purple-400 w-4"></i>
                                                    <span 
                                                       on:click|stopPropagation|preventDefault={() => window.open(token?.metadata?.envoiMetadata?.url ?? '', '_blank', 'noopener,noreferrer')}
                                                       on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && window.open(token?.metadata?.envoiMetadata?.url ?? '', '_blank', 'noopener,noreferrer')}
                                                       class="text-purple-400 hover:text-purple-300 text-sm truncate cursor-pointer"
                                                       role="link"
                                                       tabindex="0">{token?.metadata?.envoiMetadata?.url}</span>
                                                </div>
                                            {/if}
                                            {#if token.metadata.envoiMetadata.location}
                                                <div class="flex items-center gap-2">
                                                    <i class="fas fa-map-marker-alt text-purple-400 w-4"></i>
                                                    <span class="text-white/90 text-sm">{token.metadata.envoiMetadata.location}</span>
                                                </div>
                                            {/if}
                                            {#if token.metadata.envoiMetadata['com.twitter']}
                                                <div class="flex items-center gap-2">
                                                    <i class="fab fa-x-twitter text-purple-400 w-4"></i>
                                                    <span 
                                                       on:click|stopPropagation|preventDefault={() => window.open(`https://twitter.com/${token?.metadata?.envoiMetadata?.['com.twitter']}`, '_blank', 'noopener,noreferrer')}
                                                       on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && window.open(`https://twitter.com/${token?.metadata?.envoiMetadata?.['com.twitter']}`, '_blank', 'noopener,noreferrer')}
                                                       class="text-purple-400 hover:text-purple-300 text-sm truncate cursor-pointer"
                                                       role="link"
                                                       tabindex="0">@{token?.metadata?.envoiMetadata?.['com.twitter']}</span>
                                                </div>
                                            {/if}
                                            {#if token.metadata.envoiMetadata['com.github']}
                                                <div class="flex items-center gap-2">
                                                    <i class="fab fa-github text-purple-400 w-4"></i>
                                                    <span 
                                                       on:click|stopPropagation|preventDefault={() => window.open(`https://github.com/${token?.metadata?.envoiMetadata?.['com.github']}`, '_blank', 'noopener,noreferrer')}
                                                       on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && window.open(`https://github.com/${token?.metadata?.envoiMetadata?.['com.github']}`, '_blank', 'noopener,noreferrer')}
                                                       class="text-purple-400 hover:text-purple-300 text-sm truncate cursor-pointer"
                                                       role="link"
                                                       tabindex="0">@{token?.metadata?.envoiMetadata?.['com.github']}</span>
                                                </div>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        {:else if tokenProps.length > 0}
                            <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-450">
                                <div class="flex flex-wrap gap-1.5">
                                    {#each tokenProps.slice(0, 3) as prop}
                                        <span class="text-xs px-2 py-1 rounded-full bg-white/15 text-white/90 backdrop-blur-sm border border-white/10">
                                            {prop.trait_type}: {prop.value}
                                        </span>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- More Info Link -->
                        <div class="transform {isExpanded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} transition-all duration-300 delay-500">
                            <button on:click|stopPropagation|preventDefault={() => goto(`/collection/${token.contractId}/token/${token.tokenId}`)}
                                aria-label="View Full Details"
                               class="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm">
                                <i class="fas fa-info-circle"></i>
                                <span class="text-sm font-medium">View Full Details</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Menu Dropdown (Positioned relative to the button) -->
            {#if showMenu}
                <div class="fixed top-0 left-0 w-full h-full z-[15]" 
                     role="button"
                     tabindex="0"
                     on:click|stopPropagation|preventDefault={() => showMenu = false}
                     on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Escape' && (showMenu = false)}
                     on:mousedown|stopPropagation|preventDefault
                     on:mouseup|stopPropagation|preventDefault
                     aria-label="Close menu overlay"></div>
                <div class="absolute top-12 right-2 w-56 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-xl border border-white/10 z-[20] overflow-hidden"
                     bind:this={menuRef}
                     role="menu"
                     tabindex="0"
                     on:click|stopPropagation|preventDefault
                     on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Escape' && (showMenu = false)}
                     on:mousedown|stopPropagation|preventDefault
                     on:mouseup|stopPropagation|preventDefault
                     aria-label="Token actions menu">
                    {#if isTokenOwner || isTokenApproved}
                        <div class="p-2 space-y-1">
                            <button on:click={sendToken}
                                    class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-lg transition-colors">
                                <i class="fas fa-paper-plane w-4"></i>
                                <span>Transfer Token</span>
                            </button>
                            
                            {#if isTokenOwner}
                                <button on:click={approveToken}
                                        class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-lg transition-colors">
                                    <i class="fas fa-check-circle w-4"></i>
                                    <span>{token.approved != zeroAddress ? 'Change' : 'Set'} Approval</span>
                                </button>
                            {/if}
                        </div>

                        {#if (!listing || (listing && listing?.source === 'arcpay'))}
                            <div class="border-t border-white/10 p-2">
                                <button on:click={listArcpay}
                                        class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-lg transition-colors">
                                    <i class="fas fa-tag w-4"></i>
                                    <div class="flex flex-col items-start">
                                        <span>{listing ? 'Update' : 'List'} on NFT Navigator</span>
                                        <span class="text-xs text-white/60">via ArcPay</span>
                                    </div>
                                </button>
                            </div>
                        {/if}

                        {#if !listing || (listing && listing.source !== 'arcpay')}
                            <div class="border-t border-white/10 p-2">
                                <span
                                   on:click|stopPropagation|preventDefault={() => window.open(`https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`, '_blank')}
                                   on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && window.open(`https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`, '_blank')}
                                   class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                   role="link"
                                   tabindex="0">
                                    <i class="fas fa-external-link-alt w-4"></i>
                                    <div class="flex flex-col items-start">
                                        <span>{listing ? 'Manage' : 'List'} on Nautilus</span>
                                        <span class="text-xs text-white/60">External Marketplace</span>
                                    </div>
                                </span>
                            </div>
                        {/if}

                        {#if listing}
                            <div class="border-t border-white/10 p-2">
                                <button on:click={cancelListing}
                                        class="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                                    <i class="fas fa-times w-4"></i>
                                    <span>Cancel Listing</span>
                                </button>
                            </div>
                        {/if}
                    {:else if listing && !listing.sale && !listing.delete && $selectedWallet}
                        <div class="p-2 space-y-1">
                            <button on:click={buyToken}
                                    class="w-full flex flex-col gap-1 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-lg transition-colors">
                                <div class="flex items-center gap-2">
                                    <i class="fas fa-shopping-cart w-4"></i>
                                    <span>Buy Now</span>
                                    {#if currency}
                                        <span class="font-bold">
                                            ({(listing.price / Math.pow(10,currency.decimals)).toLocaleString()} {currency?.unitName})
                                        </span>
                                    {/if}
                                </div>
                                <div class="text-xs text-white/60 flex items-center gap-1.5 pl-6">
                                    Powered by {#if listing.source === 'arcpay'}
                                        NFT Navigator
                                    {:else}
                                        <img src={NautilusLogo} alt="Nautilus Logo" class="h-3.5 bg-white/90 rounded-full p-0.5" />
                                    {/if}
                                </div>
                            </button>
                            
                            <span
                               on:click|stopPropagation|preventDefault={() => window.open(`https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`, '_blank')}
                               on:keydown|stopPropagation|preventDefault={(e) => e.key === 'Enter' && window.open(`https://nautilus.sh/#/collection/${token.contractId}/token/${token.tokenId}`, '_blank')}
                               class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                               role="link"
                               tabindex="0">
                                <i class="fas fa-external-link-alt w-4"></i>
                                <div class="flex flex-col items-start">
                                    <span>{listing ? 'Manage' : 'List'} on Nautilus</span>
                                    <span class="text-xs text-white/60">External Marketplace</span>
                                </div>
                            </span>
                        </div>
                    {/if}
                </div>
            {/if}
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
    <div class="fixed inset-0 z-[30] bg-black bg-opacity-50 flex items-center justify-center">
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
            <div class="text-center">
                <div class="text-2xl font-bold text-red-500">Waiting for Confirmation</div>
                <div class="text-lg">Please wait while the token information is refreshed.</div>
            </div>
        </div>
    </div>
{/if}

{#if showDetailModal}
    <TokenDetailModal
        bind:showModal={showDetailModal}
        {token}
        {collection}
        {listing}
        {showMenuIcon}
    />
{/if}

<style lang="postcss">
    a {
        text-decoration: none;
    }
    .hidden {
        display: none !important;
    }

    .typewriter-effect {
        overflow: hidden;
        border-right: 2px solid transparent;
        white-space: nowrap;
        animation: typing 1s steps(40, end), blink-caret 0.75s step-end infinite;
        animation-play-state: paused;
    }

    .group:hover .typewriter-effect {
        animation-play-state: running;
    }

    @keyframes typing {
        from { width: 0 }
        to { width: 100% }
    }

    @keyframes blink-caret {
        from, to { border-color: transparent }
        50% { border-color: white }
    }

    @media (hover: none) {
        /* Remove mobile-specific behaviors */
        .group:active .opacity-0 {
            opacity: 0;
        }
        .group:active .translate-y-4 {
            transform: translateY(4px);
        }
        .group:active .typewriter-effect {
            animation-play-state: paused;
        }
    }

    /* Add backdrop blur to permanent elements */
    .backdrop-blur-sm {
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    }
    
    /* Approval badge tooltip styles */
    .approval-badge {
        display: inline-block;
    }
    
    .approval-tooltip {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 5px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
    }
    
    .approval-tooltip .tooltip-content {
        background-color: rgba(0, 0, 0, 0.9);
        color: white;
        text-align: center;
        border-radius: 6px;
        padding: 6px 10px;
        width: max-content;
        max-width: 230px;
        font-size: 12px;
        line-height: 1.4;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        white-space: normal;
        word-break: break-word;
    }
    
    .approval-badge:hover .approval-tooltip {
        opacity: 1;
        visibility: visible;
    }
</style>