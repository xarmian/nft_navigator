<script lang="ts">
	import type { Token } from '$lib/data/types';
    import Modal from './Modal.svelte';
    import { reformatTokenName } from "$lib/utils/indexer";
    import WalletSearch from '../WalletSearch.svelte';
    import { arc72 as Contract } from 'ulujs';
    import { algodClient, algodIndexer } from '$lib/utils/algod';
    import { signAndSendTransactions } from 'avm-wallet-svelte';
    import algosdk from 'algosdk';

    export let showModal: boolean;
    export let token: Token;
    export let fromAddr: string;

    $: sendingView = "presend"; // presend, sending, sent
    
    let transferTo = '';
    let tokenName = reformatTokenName(token.metadata?.name);

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
        }
    }
</script>
<Modal title="Transfer NFT Token" bind:showModal={showModal} showTopCloseButton={true} showBottomCloseButton={false}>
    {#if sendingView === "presend"}
        <div class="flex flex-col items-center m-2">
            <img src={token.metadata?.image} alt={token.metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
            <div class="text-xl font-bold">{tokenName}</div>
            <div class="text-sm text-gray-500">{token.contractId}</div>
        </div>
        <div class="flex flex-col items-center mt-4">
            <div class="text-xl font-bold">Send to</div>
            <!--<input type="text" class="w-64 h-10 border border-gray-300 rounded-md p-2 mt-2" placeholder="Voi Wallet or NFD"/>-->
            <WalletSearch onSubmit={(v) => transferTo = v}/>
        </div>
        <div class="flex flex-col items-center mt-4">
            <button on:click={sendToken} class="w-64 h-10 bg-blue-500 text-white rounded-md">Send</button>
        </div>
    {:else if sendingView === "sending"}
        <div class="flex flex-col items-center m-2">
            <div class="text-xl font-bold">Transaction sent to Wallet</div>
        </div>
    {:else if sendingView === "sent"}
        <div class="flex flex-col items-center m-2">
            <div class="text-xl font-bold">Token Sent</div>
        </div>
    {/if}
</Modal>