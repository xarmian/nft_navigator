<script lang="ts">
	import type { Currency, Listing, Token } from '$lib/data/types';
    import Modal from './Modal.svelte';
    import { reformatTokenName, getTokens } from "$lib/utils/indexer";
    import { mp } from 'ulujs';
    import { algodClient, algodIndexer } from '$lib/utils/algod';
    import { selectedWallet, signAndSendTransactions } from 'avm-wallet-svelte';
    import algosdk from 'algosdk';
	import { getWalletBalance, getCurrency } from '$lib/utils/currency';
	import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
	import { showConfetti } from '../../../stores/collection';
	import { toast } from '@zerodevx/svelte-toast';
	import type { NFTIndexerListingI } from 'ulujs/types/mp';
	import { invalidate, invalidateAll } from '$app/navigation';
	import { onDestroy } from 'svelte';
    import { WVOI2_CONTRACT_ID as TOKEN_WVOI2} from '$lib/data/constants';

    export let showModal: boolean;
    export let token: Token;
    export let listing: Listing;
    export let fromAddr: string;

    export let onClose: () => void = () => {};
    export let onAfterSend: (t: Token) => void = () => {};

    const SendingView = {
        Confirm: "confirm",
        Sending: "sending",
        Waiting: "waiting",
        Error: "error",
        Sent: "sent",
    } as const;

    let sendingView: typeof SendingView[keyof typeof SendingView] = SendingView.Confirm;
    let tokenName = reformatTokenName(token.metadata?.name??'', token.tokenId);

    let walletBalance: number;
    let sendingError: string = '';
    let transactionId: string = '';
    let listingCurrency: Currency | null = null;
    let buyCurrency: Currency | null = null;

    $: imageUrl = (token && token.metadataURI) ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=240` : token?.metadata?.image ?? '';
    $: if (listing) {
        getCurrency(listing.currency).then((c) => {
            listingCurrency = c;
        });

        getCurrency(listing.currency, true).then((c) => {
            buyCurrency = c;
        });
    }

    const unsub = selectedWallet.subscribe(async (wallet) => {
        if (wallet && listing) {
            walletBalance = await getWalletBalance(wallet.address, (listing.currency === TOKEN_WVOI2 ? 0 : listing.currency));
        }
    });

    onDestroy(() => {
        unsub();
    });

    async function buyToken() {
        console.log('buying token');
        sendingView = SendingView.Sending;
        
        const c = { 
            ...buyCurrency, 
            symbol: (buyCurrency?.unitName??''), 
            tokenId: (listing.currency === TOKEN_WVOI2 ? 0 : listing.currency).toString()
        };

        const opts = {
            paymentTokenId: listing.currency === 0 ? TOKEN_WVOI2 : listing.currency, // which token to use for payment with network token as wrapped network 
            wrappedNetworkTokenId: TOKEN_WVOI2, // which token to use for wrapped network token
            extraTxns: [], // optional extra transactions to include in the atomic transfer such voi swap to payment token if available
            algodClient,
            indexerClient: algodIndexer,
            skipEnsure: false
        };

        const resp = await mp.buy(
            fromAddr,  // Address of buyer
            {
                ...listing,
                token: {
                    ...listing.token,
                    metadata: (typeof listing.token?.metadata === 'object' ? JSON.stringify(listing.token.metadata) : listing.token?.metadata) ?? ''
                }
            } as Listing,
            c, // ARC200IndexerToken
            opts,
        );

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

                let owner = token.owner;
                let newOwner = owner;
                let i = 0;
                while (owner === newOwner && i < 30) {
                    await new Promise(r => setTimeout(r, 1000));
                    t = await getTokens({contractId: token.contractId, tokenId: token.tokenId, invalidate: true});
                    newOwner = t[0].owner;
                    i++;
                }

                if (t && t.length > 0) token = t[0];
                sendingView = SendingView.Sent;

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
                onAfterSend(token);
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
        if (sendingView === SendingView.Sent) {
            onAfterSend(token);
        }
        reset();
        onClose();
    }
</script>
<Modal title="Buy NFT Token" bind:showModal onClose={afterClose} showTopCloseButton={true} showBottomCloseButton={false}>
    <Breadcrumb class="w-full">
        <BreadcrumbItem><span class={sendingView === SendingView.Confirm ? 'font-bold underline text-orange-500' : ''}>Confirm</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Sending || sendingView === SendingView.Waiting ? 'font-bold underline text-orange-500' : ''}>Sign</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Sent ? 'font-bold underline text-orange-500' : ''}>Complete</span></BreadcrumbItem>
    </Breadcrumb>
    <div class="min-h-96 flex items-center w-full">
        <div class="flex flex-col w-full">
            {#if sendingView === "confirm" && listingCurrency}
                <div class="flex flex-col items-center m-2">
                    <div class="text-lg font-bold">Please confirm the following transaction:</div>
                    <div class="mt-2 flex flex-col items-center">
                        <img src={imageUrl} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                        <div class="text-sm text-gray-800 dark:text-gray-200">Buying {tokenName}</div>
                        <br/>
                        <div class="text-lg text-gray-800 dark:text-gray-200">Price: {listing.price / Math.pow(10,listingCurrency.decimals)} {listingCurrency.unitName}</div>
                    </div>
                </div>
                <div class="flex flex-row justify-center">
                    <div class="m-1 p-3">
                        <div class="text-sm font-bold">Your {listingCurrency?.unitName} Balance:</div>
                        <div class="text-sm text-gray-400">{(walletBalance / Math.pow(10,listingCurrency.decimals))??0}</div>
                    </div>
                </div>
                {#if walletBalance == 0}
                    <div class="flex flex-col items-center">
                        <div class="text-xl font-bold text-red-500">Warning!</div>
                        <div class="text-sm text-gray-400">The selected address has no Voi.</div>
                    </div>
                {/if}
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={close} class="w-52 h-10 bg-blue-500 text-white rounded-md">Close</button>
                    <button on:click={buyToken} class="w-52 h-10 bg-blue-500 text-white rounded-md">Submit</button>
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
            {:else if sendingView === "sent"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-xl font-bold">Token Purchase Complete</div>
                    <div class="mt-2 text-gray-400">
                        The token purchase is complete
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
                    <div class="text-xl font-bold">Error Purchasing Token</div>
                    <div class="mt-2 text-gray-400">There was an error purchasing the token.</div>
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