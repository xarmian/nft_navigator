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

    export let showModal: boolean;
    export let token: Token;
    export let fromAddr: string;
    export let onClose: (didSend: boolean, addr: string | undefined) => void;

    enum SendingView {
        Presend = "presend",
        Sending = "sending",
        Error = "error",
        Sent = "sent"
    }

    let sendingView: SendingView = SendingView.Presend;
    
    let transferTo = '';
    let tokenName = reformatTokenName(token.metadata?.name);

    let selectedVoiBalance: number;
    let selectedNFTCount: number;

    let didSend = false;

    $: if (transferTo && transferTo.length > 0) {
        updateBalances();
    }

    async function updateBalances() {
        selectedVoiBalance = await getWalletBalance(transferTo, 0) / Math.pow(10, 6);
        
        const tokens = await getTokens({
            owner: transferTo
        });
        selectedNFTCount = tokens.length;
    }

    async function sendToken() {
        console.log('send token to', transferTo);

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
        const resp = await contract.arc72_transferFrom(token.owner, transferTo, BigInt(token.tokenId), true, true);

        if (resp && resp.success) {
            const txnsForSigning = resp.txns;
            const decodedTxns: algosdk.Transaction[] = [];

            // base64 decode signed transactions
            for (let i = 0; i < txnsForSigning.length; i++) {
                const bytes = Buffer.from(txnsForSigning[i],'base64');
                decodedTxns.push(algosdk.decodeUnsignedTransaction(bytes));
            }
            
            const status = await signAndSendTransactions([decodedTxns]);
            console.log('signing status', status);
            sendingView = status ? SendingView.Sent : SendingView.Error;
        }
    }

    function doOnClose() {
        const didSend = sendingView === SendingView.Sent;
        onClose(didSend, transferTo);
    }
</script>
<Modal title="Transfer NFT Token" bind:showModal onClose={doOnClose} showTopCloseButton={true} showBottomCloseButton={false}>
    {#if sendingView === "presend"}
        <div class="flex flex-col items-center m-2">
            <img src={token.metadata?.image} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
            <div class="text-xl font-bold">{tokenName}</div>
            <div class="text-sm text-gray-400">{token.contractId}</div>
        </div>
        <div class="flex flex-col items-center mt-4">
            <div class="text-xl font-bold">Send to</div>
            <!--<input type="text" class="w-64 h-10 border border-gray-300 rounded-md p-2 mt-2" placeholder="Voi Wallet or NFD"/>-->
            <WalletSearch onSubmit={(v) => transferTo = v} loadPreviousValue={false} />
        </div>
        {#if transferTo.length > 0}
            <div class="flex flex-col items-center mt-4">
                <div class="text-xl font-bold">Sending to...</div>
                <div class="text-sm text-gray-400">{transferTo}</div>
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
        {/if}
        <div class="flex flex-row justify-between mt-4 space-x-2">
            <button on:click={() => showModal = false} class="w-52 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
            <button on:click={sendToken} class="w-52 h-10 bg-blue-500 text-white rounded-md">Send</button>
        </div>
    {:else if sendingView === "sending"}
        <div class="flex flex-col items-center m-2">
            <div class="text-xl font-bold">Processing Transaction</div>
            <div class="mt-2">
                <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l1.414-1.414C2.56 15.88 1.5 14.02 1.5 12H4c0 1.116.224 2.195.668 3.207l1.414-1.414zM12 20c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C9.12 16.56 10.98 15.5 13 15.5V18c-1.116 0-2.195.224-3.207.668l-1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414zM12 4c3.042 0 5.824 1.135 7.938 3l-1.414 1.414C14.88 7.44 13.02 6.5 11 6.5V4c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm-5.291 6H12V8H6.709l-1.414 1.414L6.709 11zM12 12c-1.116 0-2.195-.224-3.207-.668l-1.414 1.414A7.962 7.962 0 0012 12zm0-8c1.116 0 2.195.224 3.207.668l1.414-1.414A7.962 7.962 0 0012 4zm0 16c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C7.44 16.88 6.5 15.02 6.5 13H4c0 1.116.224 2.195.668 3.207l1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414z"></path>
                </svg>
            </div>
            <div class="mt-2 text-gray-400">Please sign the transaction in your wallet.</div>
            <div class="flex flex-col items-center mt-4">
                <button on:click={() => sendingView = SendingView.Presend} class="w-64 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
            </div>
        </div>
    {:else if sendingView === "sent"}
        <div class="flex flex-col items-center m-2">
            <div class="text-xl font-bold">Token Sent</div>
            <div class="mt-2 text-gray-400">The token has been sent to {transferTo}</div>
            <div class="flex flex-row items-center mt-4 space-x-4">
                <button on:click={() => showModal = false} class="w-64 h-10 bg-blue-500 text-white rounded-md">Close</button>
            </div>
        </div>
    {:else if sendingView === "error"}
        <div class="flex flex-col items-center m-2">
            <div class="text-xl font-bold">Error Sending Token</div>
            <div class="mt-2 text-gray-400">There was an error sending the token.</div>
            <div class="flex flex-col items-center mt-4">
                <button on:click={() => sendingView = SendingView.Presend} class="w-64 h-10 bg-blue-500 text-white rounded-md">Try Again</button>
            </div>
        </div>
    {/if}
</Modal>