<script lang="ts">
	import type { Currency, Listing, Metadata, Token } from '$lib/data/types';
    import Modal from './Modal.svelte';
    import { reformatTokenName, getTokens } from "$lib/utils/indexer";
    import { arc72, mp } from 'ulujs';
    import { algodClient, algodIndexer } from '$lib/utils/algod';
    import { selectedWallet, signAndSendTransactions } from 'avm-wallet-svelte';
    import algosdk from 'algosdk';
	import { getWalletBalance, getCurrency } from '$lib/utils/currency';
	import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
	import { showConfetti } from '../../../stores/collection';
	import type { NFTIndexerListingI, NFTIndexerTokenI } from 'ulujs/types/mp';
	import { invalidateAll } from '$app/navigation';
	import { zeroAddress, NAUTILUS_CONTRACT_ID as ctcInfoMp206, WVOI2_CONTRACT_ID as TOKEN_WVOI2, TOKEN_NAUT_VOI_STAKING } from '$lib/data/constants';
    import Share from './Share.svelte';
    import { decodeRoyalties } from '$lib/utils/functions';
    export let showModal: boolean;
    export let token: Token;
    export let fromAddr: string;
    export let listing: Listing | null = null;

    export let onClose: () => void = () => {};
    export let onAfterSend: (t: Token) => void = () => {};

    const SendingView = {
        Presend: "presend",
        Confirm: "confirm",
        Sending: "sending",
        Waiting: "waiting",
        Updating: "updating",
        Error: "error",
        Listed: "listed",
        Deleted: "deleted",
    } as const;

    let sendingView: typeof SendingView[keyof typeof SendingView] = SendingView.Presend;
    let tokenName = reformatTokenName(token.metadata?.name??'', token.tokenId);

    let walletBalance: number;
    let sendingError: string = '';
    let transactionId: string = '';

    let salePrice: number | null = null;

    $: imageUrl = (token && token.metadataURI) ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=240` : token?.metadata?.image ?? '';

    let listingCurrency: Currency | null = null;

    getCurrency(0).then((currency) => {
        listingCurrency = currency;
        if ($selectedWallet && listingCurrency) {
            getWalletBalance($selectedWallet.address, listingCurrency?.assetId).then((balance) => {
                walletBalance = balance;
            });
        }
    });

    async function listToken() {
        sendingView = SendingView.Sending;
        let resp;
        const doDelete = (salePrice??0) === 0 && listing;

        // multiply salePrice by 10^(listingCurrency.decimals) and represent as string
        const salePriceAU = ((salePrice??0) * Math.pow(10, (listingCurrency?.decimals??0))).toString();

        if (doDelete && listing) {
            // delete listing
            /*const ctc = new mp(listing.mpContractId, algodClient, algodIndexer, {
                acc: { addr: fromAddr, sk: new Uint8Array() },
                simulate: true,
            });
            resp = await ctc.deleteListing(listing.mpListingId);*/

            const opts = {
                acc: {
                    addr: fromAddr,
                    sk: new Uint8Array(0),
                },
                formatBytes: false,
                simulate: true,
            }

            const ctc = new arc72(token.contractId, algodClient, algodIndexer, opts);
            resp = await ctc.arc72_approve(zeroAddress, Number(token.tokenId), true, true);
        }
        else {
            // create or update listing

            // create a clone of token and decode royalties
            const metadata = JSON.parse(JSON.stringify(token.metadata??'{}'));
            let royalties = undefined;
            if (metadata?.royalties) {
                metadata.royalties = decodeRoyalties(metadata?.royalties);
                royalties = metadata.royalties;
            }

            // copy token (Token) to NFTIndexerTokenI
            const t: NFTIndexerTokenI = {
                contractId: Number(token.contractId), // number
                tokenId: Number(token.tokenId), // number
                owner: token.owner, // string
                metadata: JSON.stringify(metadata??'{}'),
                metadataURI: token.metadataURI, // string
                "mint-round": Number(token.mintRound), // number
                approved: token.approved, // string
                royalties: royalties, // string
            };

            resp = await mp.list(
                fromAddr, // string
                t as NFTIndexerTokenI, // NFTIndexerTokenI
                salePriceAU, // string (AU) (ex "10000000000")
                listingCurrency, // ARC200IndexerToken
                {
                    algodClient, 
                    indexerClient: algodIndexer,  
                    paymentTokenId: 0, // number
                    wrappedNetworkTokenId: TOKEN_WVOI2, // number 
                    mpContractId: ctcInfoMp206, // number 
                    extraTxns: [], // extra transaction to include before listing txn (optional)
                    enforceRoyalties: [TOKEN_NAUT_VOI_STAKING].includes(listing?.collectionId || 0) ? false : true, // include royalty payout in listing (optional, default=false) 
                    skipEnsure: true, // skip ensure (optional, default=false)
                    listingsToDelete: listing ? [listing as unknown as NFTIndexerListingI] : [], // listing ids to delete (optional)
                }
            );
        }

        if (resp && resp.success) {
            const txnsForSigning = resp.txns;
            const decodedTxns: algosdk.Transaction[] = [];

            // base64 decode signed transactions
            for (let i = 0; i < txnsForSigning.length; i++) {
                const bytes = Buffer.from(txnsForSigning[i],'base64');
                let tx = algosdk.decodeUnsignedTransaction(bytes);
                transactionId = tx.txID();
                decodedTxns.push(tx);
            }
            
            try {
                const status = await signAndSendTransactions([decodedTxns]);
                console.log('signing status', status);
                sendingView = status ? SendingView.Waiting : SendingView.Error;
                let t = null;

                let approved = token.approved;
                let newApproved = token.approved;
                let i = 0;
                while (approved === newApproved && i < 30) {
                    await new Promise(r => setTimeout(r, 1000));
                    t = await getTokens({contractId: token.contractId, tokenId: token.tokenId, invalidate: true});
                    newApproved = t[0].approved;
                    i++;
                }

                if (t && t.length > 0) token = t[0];
                sendingView = SendingView.Updating;

                // wait 5 seconds for indexer to update
                await new Promise(r => setTimeout(r, 5000));

                if (doDelete) {
                    sendingView = SendingView.Deleted;
                }
                else {
                    sendingView = SendingView.Listed;
                }

                // submit POST to /api/quests to record action
                /*const response = await fetch('/api/quests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        action: type == 'send' ? 'token_transfer' : 'token_approve',
                        detail: {
                            from: fromAddr,
                            to: transferTo,
                            token: String(token.contractId)+'-'+String(token.tokenId),
                            transactionId: transactionId,
                        }
                    }),
                });

                if (!response.ok) {
                    console.error('Failed to send wallet data to backend', await response.text());
                }
                else {
                    const data = await response.json();
                    if (data.isFirstAction) {
                        showConfetti.set(true);
                        toast.push(`Congratulations! The ${type === 'send' ? 'Transfer' : 'Approve'} Token Quest has been Completed!`);
                        setTimeout(() => {
                            showConfetti.set(false)
                        }, 10000);
                    }
                }*/

                invalidateAll();
                
            }
            catch(err: any) {
                console.log(err);
                sendingError = err.message;
                sendingView = SendingView.Error;
            }
        }
        else {
            sendingError = resp.error;
            sendingView = SendingView.Error;
        }
    }

    function reset() {
        sendingError = '';
        sendingView = SendingView.Confirm;
    }

    function close() {
        showModal = false;
        sendingError = '';
        sendingView = SendingView.Confirm;
    }

    function afterClose() {
        console.log('afterClose');
        if (sendingView === SendingView.Listed) {
            onAfterSend(token);
        }
        reset();
        onClose();
    }
</script>
<Modal title="List NFT For Sale" bind:showModal onClose={afterClose} showTopCloseButton={true} showBottomCloseButton={false}>
    <Breadcrumb class="w-full">
        <BreadcrumbItem><span class={sendingView === SendingView.Confirm ? 'font-bold underline text-orange-500' : ''}>Confirm</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Sending || sendingView === SendingView.Waiting ? 'font-bold underline text-orange-500' : ''}>Sign</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Listed ? 'font-bold underline text-orange-500' : ''}>Complete</span></BreadcrumbItem>
    </Breadcrumb>
    <div class="min-h-96 flex items-center w-full">
        <div class="flex flex-col w-full">
            {#if sendingView === "presend"}
                <div class="flex flex-col items-center m-2">
                    <img src={imageUrl} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                    <div class="text-xl font-bold">{tokenName}</div>
                    <div class="text-sm text-gray-400">{token.contractId}</div>
                </div>
                <div class="flex flex-col items-center mt-4">
                    {#if listing}
                        <div class="text-xl font-bold">Update Sale Price on Nautilus</div>
                    {:else}
                        <div class="text-xl font-bold">List token for Sale on Nautilus</div>
                    {/if}
                    <input type="number" bind:value={salePrice} placeholder="Enter price in VOI" class="w-64 h-10 dark:bg-gray-900 rounded-md p-2"/>
                </div>
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={() => showModal = false} class="w-52 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    <button on:click={() => { if ((salePrice??0) > 0) sendingView = SendingView.Confirm; }} class="w-52 h-10 bg-blue-500 text-white rounded-md {(salePrice??0) <= 0 ? 'bg-gray-400 cursor-default' : ''}">Next</button>
                </div>
                {#if listing}
                    <div class="flex justify-center mt-4">
                        <button on:click={() => { salePrice = 0; sendingView = SendingView.Confirm; }} class="w-52 h-10 bg-red-500 text-white rounded-md">Cancel Listing</button>
                    </div>
                {/if}
            {:else if sendingView === "confirm"}
                {#if listingCurrency && salePrice}
                    <div class="flex flex-col items-center m-2">
                        <div class="text-lg font-bold">Please confirm the following transaction:</div>
                        <div class="mt-2 flex flex-col items-center">
                            <img src={imageUrl} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                            <div class="text-sm text-gray-800 dark:text-gray-200">Selling {tokenName}</div>
                            <br/>
                            <div class="text-lg text-gray-800 dark:text-gray-200">Price: {salePrice} {listingCurrency.unitName}</div>
                        </div>
                    </div>
                    <div class="flex flex-row justify-center">
                        <div class="m-1 p-3">
                            <div class="text-sm font-bold">Your {listingCurrency?.unitName} Balance:</div>
                            <div class="text-sm text-gray-400">{(walletBalance / Math.pow(10,listingCurrency.decimals))}</div>
                        </div>
                    </div>
                    {#if walletBalance == 0}
                        <div class="flex flex-col items-center">
                            <div class="text-xl font-bold text-red-500">Warning!</div>
                            <div class="text-sm text-gray-400">The selected address has no Voi. Please verify before sending.</div>
                        </div>
                    {/if}
                {:else}
                    <div class="flex flex-col items-center m-2">
                        <div class="text-lg font-bold">Please confirm the following transaction:</div>
                        <div class="mt-2 flex flex-col items-center">
                            <img src={imageUrl} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                            <div class="text-sm text-gray-800 dark:text-gray-200">Canceling Listing for:</div>
                            <div class="">{tokenName}</div>
                        </div>
                    </div>
                {/if}
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={close} class="w-52 h-10 bg-blue-500 text-white rounded-md">Close</button>
                    <button on:click={listToken} class="w-52 h-10 bg-blue-500 text-white rounded-md">Submit</button>
                </div>
            {:else if sendingView === "sending"}
                <div class="flex flex-col items-center m-2 h-full place-content-center">
                    <div class="text-xl font-bold">Processing Transaction</div>
                    <div class="mt-2">
                        <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l1.414-1.414C2.56 15.88 1.5 14.02 1.5 12H4c0 1.116.224 2.195.668 3.207l1.414-1.414zM12 20c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C9.12 16.56 10.98 15.5 13 15.5V18c-1.116 0-2.195.224-3.207.668l-1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414zM12 4c3.042 0 5.824 1.135 7.938 3l-1.414 1.414C14.88 7.44 13.02 6.5 11 6.5V4c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm-5.291 6H12V8H6.709l-1.414 1.414L6.709 11zM12 12c-1.116 0-2.195-.224-3.207-.668l-1.414 1.414A7.962 7.962 0 0012 12zm0-8c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm0 16c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C7.44 16.88 6.5 15.02 6.5 13H4c0 1.116.224 2.195.668 3.207l1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414z"></path>
                        </svg>
                    </div>
                    <div class="mt-2 text-gray-400">Please sign the transaction in your wallet.</div>
                    <div class="flex flex-col items-center mt-4">
                        <button on:click={reset} class="w-64 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    </div>
                </div>
            {:else if sendingView === "waiting"}
                <div class="flex flex-col items-center m-2 h-full place-content-center">
                    <div class="text-xl font-bold">Waiting for Confirmation</div>
                    <div class="mt-2">
                        <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l1.414-1.414C2.56 15.88 1.5 14.02 1.5 12H4c0 1.116.224 2.195.668 3.207l1.414-1.414zM12 20c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C9.12 16.56 10.98 15.5 13 15.5V18c-1.116 0-2.195.224-3.207.668l-1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414zM12 4c3.042 0 5.824 1.135 7.938 3l-1.414 1.414C14.88 7.44 13.02 6.5 11 6.5V4c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm-5.291 6H12V8H6.709l-1.414 1.414L6.709 11zM12 12c-1.116 0-2.195-.224-3.207-.668l-1.414 1.414A7.962 7.962 0 0012 12zm0-8c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm0 16c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C7.44 16.88 6.5 15.02 6.5 13H4c0 1.116.224 2.195.668 3.207l1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414z"></path>
                        </svg>
                    </div>
                    <div class="mt-2 text-gray-400">Transaction signed, awaiting confirmation.</div>
                    <div class="flex flex-col items-center mt-4">
                        <button on:click={reset} class="w-64 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    </div>
                </div>
            {:else if sendingView === "updating"}
                <div class="flex flex-col items-center m-2 h-full place-content-center">
                    <div class="text-xl font-bold">Updating Token Details</div>
                    <div class="mt-2">
                        <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l1.414-1.414C2.56 15.88 1.5 14.02 1.5 12H4c0 1.116.224 2.195.668 3.207l1.414-1.414zM12 20c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C9.12 16.56 10.98 15.5 13 15.5V18c-1.116 0-2.195.224-3.207.668l-1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414zM12 4c3.042 0 5.824 1.135 7.938 3l-1.414 1.414C14.88 7.44 13.02 6.5 11 6.5V4c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm-5.291 6H12V8H6.709l-1.414 1.414L6.709 11zM12 12c-1.116 0-2.195-.224-3.207-.668l-1.414 1.414A7.962 7.962 0 0012 12zm0-8c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm0 16c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C7.44 16.88 6.5 15.02 6.5 13H4c0 1.116.224 2.195.668 3.207l1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414z"></path>
                        </svg>
                    </div>
                    <div class="mt-2 text-gray-400">Transaction Confirmed, updating token and listing details</div>
                    <div class="flex flex-col items-center mt-4">
                        <button on:click={reset} class="w-64 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    </div>
                </div>
            {:else if sendingView === "listed"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-xl font-bold">Token Listing Complete</div>
                    <div class="mt-2 text-gray-400 flex flex-col justify-center">
                        <div class="font-bold">Transaction ID</div>
                        <a href={"https://explorer.voi.network/explorer/transaction/" + transactionId} target="_blank" class="text-xs underline text-blue-500 hover:text-blue-600">{transactionId}</a>
                    </div>
                    <div class="mt-2 text-gray-400 flex flex-col">
                        <div class="relative">
                            <Share url={`https://nftnavigator.xyz/collection/${token.contractId}/token/${token.tokenId}`} text={`Check out this sweet ${tokenName} I just listed on Voi Network for ${salePrice} VOI! #Voiagers #VoiNFTs`} />
                        </div>
                    </div>
                    <div class="flex flex-row items-center mt-4 space-x-4">
                        <button on:click={close} class="w-64 h-10 bg-blue-500 text-white rounded-md">Close</button>
                    </div>
                </div>
            {:else if sendingView === 'deleted'}
                <div class="flex flex-col items-center m-2">
                    <div class="text-xl font-bold">Token Listing Deleted</div>
                    <div class="mt-2 text-gray-400">
                        The token listing has been deleted
                    </div>
                    <div class="mt-2 text-gray-400 flex flex-col">
                        <div class="font-bold">Transaction ID</div>
                        <a href={"https://explorer.voi.network/explorer/transaction/" + transactionId} target="_blank" class="text-xs underline text-blue-500 hover:text-blue-600">{transactionId}</a>
                    </div>
                    <div class="flex flex-row items-center mt-4 space-x-4">
                        <button on:click={close} class="w-64 h-10 bg-blue-500 text-white rounded-md">Close</button>
                    </div>
                </div>
            {:else if sendingView === "error"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-xl font-bold">Error Listing Token</div>
                    <div class="mt-2 text-gray-400">There was an error listing the token.</div>
                    <div class="max-w-96">
                        <div class="mt-2 text-gray-400">{sendingError}</div>
                    </div>
                    <div class="flex flex-col items-center mt-4">
                        <button on:click={reset} class="w-64 h-10 bg-blue-500 text-white rounded-md">Start Over</button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</Modal>