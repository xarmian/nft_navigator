<script lang="ts">
	import type { Token } from '$lib/data/types';
    import Modal from './Modal.svelte';
    import { reformatTokenName, getTokens } from "$lib/utils/indexer";
    import WalletSearch from '../WalletSearch.svelte';
    import { arc72 as Contract } from 'ulujs';
    import { algodClient, algodIndexer } from '$lib/utils/algod';
    import { selectedWallet, signAndSendTransactions } from 'avm-wallet-svelte';
    import algosdk from 'algosdk';
	import { getWalletBalance } from '$lib/utils/currency';
	import { zeroAddress } from '$lib/data/constants';
    import { getNFD } from '$lib/utils/nfd';
	import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';

    export let showModal: boolean;
    export let token: Token;
    export let fromAddr: string;
    export let type: string = 'send'; // send or approve

    export let onClose: () => void = () => {};
    export let onAfterSend: (t: Token) => void = () => {};

    enum SendingView {
        Presend = "presend",
        Confirm = "confirm",
        Sending = "sending",
        Waiting = "waiting",
        Error = "error",
        Sent = "sent",
    }

    let sendingView: SendingView = SendingView.Presend;
    
    let transferTo = '';
    let transferToNFD = '';
    let tokenName = reformatTokenName(token.metadata?.name);

    let selectedVoiBalance: number;
    let selectedNFTCount: number;
    let sendingError: string = '';
    let transactionId: string = '';

    $: if (transferTo && transferTo.length > 0) {
        updateBalances();

        // get nfd for transferTo address
        transferToNFD = '';
        getNFD([transferTo]).then((nfd) => {
            if (nfd && nfd.length > 0) transferToNFD = nfd[0].replacementValue;
        });
    }
    else {
        transferToNFD = '';
    }

    async function updateBalances() {
        selectedVoiBalance = await getWalletBalance(transferTo, 0) / Math.pow(10, 6);
        
        const tokens = await getTokens({
            owner: transferTo
        });
        selectedNFTCount = tokens.length;
    }

    function revokeApproval() {
        transferTo = zeroAddress;
        sendToken();
    }

    async function sendToken() {
        console.log('send token to', transferTo);
        if (transferTo.length === 0) return;

        const opts = {
            acc: {
                addr: fromAddr,
                sk: new Uint8Array(0),
            },
            formatBytes: false,
            simulate: true,
        }

        sendingView = SendingView.Sending;
        const contract = new Contract(token.contractId, algodClient, algodIndexer, opts);
        let resp;
        if (type == 'send') {
            resp = await contract.arc72_transferFrom(token.owner, transferTo, BigInt(token.tokenId), true, true);
        }
        else {
            resp = await contract.arc72_approve(transferTo, Number(token.tokenId), true, true);
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

                if (type == 'send') {
                    let owner = token.owner;
                    let newOwner = owner;
                    let i = 0;
                    while (owner === newOwner && i < 10) {
                        await new Promise(r => setTimeout(r, 1000));
                        t = await getTokens({contractId: token.contractId, tokenId: token.tokenId, invalidate: true});
                        token = t[0];
                        newOwner = t[0].owner;
                        i++;
                    }
                }
                else {
                    let approved = token.approved;
                    let newApproved = approved;
                    let i = 0;
                    while (approved === newApproved && i < 10) {
                        await new Promise(r => setTimeout(r, 1000));
                        t = await getTokens({contractId: token.contractId, tokenId: token.tokenId, invalidate: true});
                        token = t[0];
                        newApproved = t[0].approved;
                        i++;
                    }
                }

                sendingView = SendingView.Sent;

                // submit POST to /api/quests to record action
                const response = await fetch('/api/quests', {
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
        transferTo = '';
        transferToNFD = '';
        sendingError = '';
        sendingView = SendingView.Presend;
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
<Modal title="{type == 'send' ? 'Transfer NFT Token' : 'Change NFT Token Approval'}" bind:showModal onClose={afterClose} showTopCloseButton={true} showBottomCloseButton={false}>
    <Breadcrumb separator=">" class="w-full">
        <BreadcrumbItem><span class={sendingView === SendingView.Presend ? 'font-bold underline text-orange-500' : ''}>Select Wallet</span></BreadcrumbItem>
        <BreadcrumbItem><span class={sendingView === SendingView.Confirm ? 'font-bold underline text-orange-500' : ''}>Confirm</span></BreadcrumbItem>
        <BreadcrumbItem><span class={sendingView === SendingView.Sending || sendingView === SendingView.Waiting ? 'font-bold underline text-orange-500' : ''}>Sign</span></BreadcrumbItem>
        <BreadcrumbItem><span class={sendingView === SendingView.Sent ? 'font-bold underline text-orange-500' : ''}>Complete</span></BreadcrumbItem>
    </Breadcrumb>
    <div class="min-h-96 flex items-center w-full">
        <div class="flex flex-col w-full">
            {#if sendingView === "presend"}
                <div class="flex flex-col items-center m-2">
                    <img src={token.metadata?.image} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                    <div class="text-xl font-bold">{tokenName}</div>
                    <div class="text-sm text-gray-400">{token.contractId}</div>
                </div>
                <div class="flex flex-col items-center mt-4">
                    {#if type == 'approve'}
                        <div class="text-xs mb-2 text-gray-400 max-w-96">An approved spender can transfer a token on your behalf. This is often used when listing a token on a marketplace.</div>
                        <div class="mb-2">
                            <div class="text-lg">Current Approved Spender</div>
                            <div class="text-sm text-gray-400">{token.approved == zeroAddress ? 'None' : `${token.approved.slice(0, 8)}...${token.approved.slice(-8)}`}</div>
                        </div>
                    {/if}
                    <div class="text-xl font-bold">{type == 'send' ? 'Send to' : 'Change Approved Spender to'}</div>
                    <WalletSearch onSubmit={(v) => transferTo = v} loadPreviousValue={false} showSubmitButton={false} />
                </div>
                {#if type == 'approve' && token.approved !== zeroAddress}
                    <div class="flex flex-col items-center mt-4">
                        <div class="mb-4">or</div>
                        <button on:click={() => revokeApproval()} class="w-64 h-10 bg-blue-500 text-white rounded-md">Revoke Approval</button>
                    </div>
                {/if}
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={() => showModal = false} class="w-52 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    <button on:click={() => { if (transferTo.length > 0) sendingView = SendingView.Confirm; }} class="w-52 h-10 bg-blue-500 text-white rounded-md {transferTo.length == 0 ? 'bg-gray-400 cursor-default' : ''}">Next</button>
                </div>
            {:else if sendingView === "confirm"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-lg font-bold">Please confirm the following transaction:</div>
                    <div class="mt-2 flex flex-col items-center">
                        <img src={token.metadata?.image} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                        <div class="text-sm text-gray-800 dark:text-gray-200">{type == 'send' ? 'Send' : 'Change Approval for'} {tokenName} to</div>
                    </div>
                </div>
                <div class="flex flex-col items-center mt-2">
                    <div class="text-sm text-gray-400">{transferTo}</div>
                    {#if transferToNFD.length > 0}
                        <div class="text-sm text-gray-400">{transferToNFD}</div>
                    {/if}
                </div>
                <div class="flex flex-row justify-center">
                    <div class="m-1 p-3">
                        <div class="text-sm font-bold">Voi Balance</div>
                        <div class="text-sm text-gray-400">{selectedVoiBalance??''}</div>
                    </div>
                    <div class="m-1 p-3">
                        <div class="text-sm font-bold"># NFTs</div>
                        <div class="text-sm text-gray-400">{selectedNFTCount??''}</div>
                    </div>
                </div>
                {#if selectedVoiBalance == 0}
                    <div class="flex flex-col items-center">
                        <div class="text-xl font-bold text-red-500">Warning!</div>
                        <div class="text-sm text-gray-400">The selected address has no Voi. Please verify before sending.</div>
                    </div>
                {/if}
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={reset} class="w-52 h-10 bg-blue-500 text-white rounded-md">Back</button>
                    <button on:click={sendToken} class="w-52 h-10 bg-blue-500 text-white rounded-md">Submit</button>
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
                    <div class="text-xl font-bold">{type == 'send' ? 'Token Sent' : 'Token Approval Changed'}</div>
                    <div class="mt-2 text-gray-400">
                        {#if type == 'send'}
                            The token has been sent to {transferTo}
                        {:else}
                            {#if transferTo === zeroAddress}
                                Token approval has been revoked.
                            {:else}
                                Token approval has been changed to {transferTo}
                            {/if}
                        {/if}
                    </div>
                    <div class="mt-2 text-gray-400 flex flex-col">
                        <div class="font-bold">Transaction ID</div>
                        <a href={"https://voi.observer/explorer/transaction/" + transactionId} target="_blank" class="text-xs underline text-blue-500 hover:text-blue-600">{transactionId}</a>
                    </div>
                    <div class="flex flex-row items-center mt-4 space-x-4">
                        <button on:click={() => showModal = false} class="w-64 h-10 bg-blue-500 text-white rounded-md">Close</button>
                    </div>
                </div>
            {:else if sendingView === "error"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-xl font-bold">Error Sending Token</div>
                    <div class="mt-2 text-gray-400">There was an error sending the token.</div>
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