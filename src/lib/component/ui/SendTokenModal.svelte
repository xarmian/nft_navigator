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
	import { showConfetti } from '../../../stores/collection';
	import { toast } from '@zerodevx/svelte-toast';
	import { invalidateAll } from '$app/navigation';
    import { searchEnvoi, type EnvoiSearchResult } from '$lib/utils/envoi';
    import { onMount, onDestroy } from 'svelte';

    export let showModal: boolean;
    export let token: Token | null = null;
    export let tokens: Token[] = [];
    export let fromAddr: string;
    export let type: string = 'send'; // send or approve or revoke

    export let onClose: () => void = () => {};
    export let onAfterSend: (t: Token) => void = () => {};

    const SendingView = {
        Presend: "presend",
        Confirm: "confirm",
        Sending: "sending",
        Waiting: "waiting",
        Error: "error",
        Sent: "sent",
    } as const;

    let sendingView: typeof SendingView[keyof typeof SendingView] = SendingView.Presend;
    if (tokens.length == 0 && token) tokens = [token];
    
    let transferTo = '';
    let transferToNFD = '';
    let tokenName = (tokens[0]) ? reformatTokenName(tokens[0].metadata?.name??'', tokens[0].tokenId) : ``;

    let selectedVoiBalance: number;
    let selectedNFTCount: number;
    let sendingError: string = '';
    let transactionId: string = '';
    let sentCount = 0;
    $: imageUrl = (tokens[0] && tokens[0].metadataURI) ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(tokens[0].metadataURI)}?w=240` : tokens[0]?.metadata?.image;

    let searchQuery = '';
    let isSearchOpen = false;
    let filteredWallets: EnvoiSearchResult[] = [];
    let selected = 0;

    $: {
        if (searchQuery.length == 58) {
            filteredWallets = [ { address: searchQuery, name: searchQuery, metadata: {} } ];
        }
        else if (searchQuery.length >= 2) {
            searchEnvoi(searchQuery).then((data) => {
                filteredWallets = data;
            });
        }
        else {
            filteredWallets = [];
        }
    }

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
    
    if (type === 'revoke') {
        revokeApproval();
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

        try {
            for (let i = 0; i < tokens.length; i++) {
                sentCount++;
                let resp;

                const contract = new Contract(tokens[i].contractId, algodClient, algodIndexer, opts);
                if (type == 'send') {
                    resp = await contract.arc72_transferFrom(tokens[i].owner, transferTo, BigInt(tokens[i].tokenId), true, true);
                }
                else {
                    resp = await contract.arc72_approve(transferTo, Number(tokens[i].tokenId), true, true);
                }

                if (resp && resp.success) {
                    const decodedTxns: algosdk.Transaction[] = [];
                    const txnsForSigning = resp.txns;

                    // base64 decode signed transactions
                    for (let i = 0; i < txnsForSigning.length; i++) {
                        const bytes = Buffer.from(txnsForSigning[i],'base64');
                        let tx = algosdk.decodeUnsignedTransaction(bytes);
                        transactionId = tx.txID();
                        decodedTxns.push(tx);
                    }

                    const status = await signAndSendTransactions([decodedTxns]);
                    sendingView = status ? SendingView.Waiting : SendingView.Error;
                    if (!status) {
                        sendingError = 'Failed to sign transaction';
                        return;
                    }
                    console.log('signing status', status);
                }
                else {
                    sendingError = resp.error;
                    sendingView = SendingView.Error;
                    return;
                }
            }

            let t = null;

            if (tokens.length > 0) {
                const lastToken = tokens[tokens.length - 1];
                if (type == 'send') {
                    let owner = lastToken.owner;
                    let newOwner = owner;
                    let i = 0;
                    while (owner === newOwner && i < 10) {
                        await new Promise(r => setTimeout(r, 1000));
                        t = await getTokens({contractId: lastToken.contractId, tokenId: lastToken.tokenId, invalidate: true});
                        newOwner = t[0].owner;
                        i++;
                    }
                }
                else {
                    let approved = lastToken.approved;
                    let newApproved = approved;
                    let i = 0;
                    while (approved === newApproved && i < 10) {
                        await new Promise(r => setTimeout(r, 1000));
                        t = await getTokens({contractId: lastToken.contractId, tokenId: lastToken.tokenId, invalidate: true});
                        newApproved = t[0].approved;
                        i++;
                    }
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
                            token: String(lastToken.contractId)+'-'+String(lastToken.tokenId),
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
        }
        catch(err) {
            console.error('error sending token', err);
            sendingError = (err instanceof Error) ? err.message : 'Unknown error';
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
            onAfterSend(token??tokens[0]);
        }
        showModal = false;
        reset();
        onClose();
    }

    function handleWalletSelect(wallet: EnvoiSearchResult) {
        transferTo = wallet.address;
        searchQuery = wallet.name;
        isSearchOpen = false;
        if (transferTo) updateBalances();
    }

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;
        if (!target.closest('.walletSearchComponent')) {
            isSearchOpen = false;
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (!isSearchOpen) return;
        
        const maxIndex = filteredWallets.length - 1;
        if (event.key === 'ArrowDown') {
            selected = Math.min(selected + 1, maxIndex);
        } else if (event.key === 'ArrowUp') {
            selected = Math.max(selected - 1, 0);
        } else if (event.key === 'Enter' && filteredWallets.length > 0) {
            handleWalletSelect(filteredWallets[selected]);
        }
    }

    onMount(() => {
        window.addEventListener('click', handleClickOutside);
        window.addEventListener('keydown', handleKeydown);
    });

    onDestroy(() => {
        window.removeEventListener('click', handleClickOutside);
        window.removeEventListener('keydown', handleKeydown);
    });
</script>
<Modal title="{type == 'send' ? 'Transfer NFT Token' : 'Change NFT Token Approval'}" bind:showModal onClose={afterClose} showTopCloseButton={true} showBottomCloseButton={false}>
    <Breadcrumb class="w-full">
        <BreadcrumbItem><span class={sendingView === SendingView.Presend ? 'font-bold underline text-orange-500' : ''}>Select Wallet</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Confirm ? 'font-bold underline text-orange-500' : ''}>Confirm</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Sending || sendingView === SendingView.Waiting ? 'font-bold underline text-orange-500' : ''}>Sign</span></BreadcrumbItem>
        <span class="mx-2">&gt;</span>
        <BreadcrumbItem><span class={sendingView === SendingView.Sent ? 'font-bold underline text-orange-500' : ''}>Complete</span></BreadcrumbItem>
    </Breadcrumb>
    <div class="min-h-96 flex items-center w-full">
        <div class="flex flex-col w-full">
            {#if sendingView === "presend"}
                <div class="flex flex-col items-center m-2">
                    {#if tokens.length == 1}
                        <img src={imageUrl} alt={tokens[0].metadata?.name} class="h-20 w-20 object-contain rounded-md"/>
                        <div class="text-xl font-bold">{tokenName}</div>
                    {:else if tokens.length > 1}
                        <div class="text-xl font-bold">Multiple Tokens ({tokens.length})</div>
                        <div class="max-h-32 overflow-auto p-1 m-1 border-gray-500 bg-gray-200 dark:bg-gray-700 rounded-lg">
                            {#each tokens as t}
                                <div class="text-sm text-gray-800 dark:text-gray-300">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                            {/each}
                        </div>
                    {/if}
                    <div class="text-sm text-gray-400">{token?.contractId??''}</div>
                </div>
                <div class="flex flex-col items-center mt-4">
                    {#if type == 'approve'}
                        <div class="text-xs mb-2 text-gray-400 max-w-96">An approved spender can transfer a token on your behalf. This is often used when listing a token on a marketplace.</div>
                        <div class="mb-2">
                            <div class="text-lg">Current Approved Spender</div>
                            <div class="text-sm text-gray-400">{token?.approved == zeroAddress ? 'None' : `${token?.approved.slice(0, 8)}...${token?.approved.slice(-8)}`}</div>
                        </div>
                    {/if}
                    <div class="text-xl font-bold">{type == 'send' ? 'Send to' : 'Change Approved Spender to'}</div>
                    <div class="relative walletSearchComponent w-full max-w-md">
                        <input 
                            type="text" 
                            bind:value={searchQuery}
                            on:focus={() => isSearchOpen = true}
                            placeholder="Search by enVoi name or paste address..." 
                            class="p-2 w-full border rounded-md bg-gray-100 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-400 text-black dark:text-white" 
                        />
                        {#if isSearchOpen && filteredWallets.length > 0}
                            <ul class="absolute left-0 bg-white dark:bg-gray-800 border rounded-md mt-0.5 w-full max-h-80 overflow-auto shadow-md z-50">
                                {#each filteredWallets as wallet, index}
                                    <li class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer text-black dark:text-white {selected === index ? 'bg-blue-200 dark:bg-blue-700' : ''}">
                                        <button on:click={() => handleWalletSelect(wallet)} class="w-full">
                                            <div class="flex items-center gap-3">
                                                {#if wallet.metadata?.avatar}
                                                    <img 
                                                        src={wallet.metadata.avatar} 
                                                        alt={`${wallet.name} avatar`}
                                                        class="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                                    />
                                                {:else}
                                                    <div class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                                        <span class="text-gray-600 dark:text-gray-300 text-base">
                                                            {wallet.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                {/if}
                                                <div class="flex flex-col flex-grow min-w-0">
                                                    <span class="text-lg font-medium truncate self-start">{wallet.name}</span>
                                                    <span class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{wallet.address}</span>
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </div>
                {#if type == 'approve' && token?.approved !== zeroAddress}
                    <div class="flex flex-col items-center mt-4">
                        <div class="mb-4">or</div>
                        <button on:click={() => revokeApproval()} class="w-64 h-10 bg-blue-500 text-white rounded-md">Revoke Approval</button>
                    </div>
                {/if}
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={afterClose} class="w-52 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    <button on:click={() => { if (transferTo.length > 0) sendingView = SendingView.Confirm; }} class="w-52 h-10 bg-blue-500 text-white rounded-md {transferTo.length == 0 ? 'bg-gray-400 cursor-default' : ''}">Next</button>
                </div>
            {:else if sendingView === "confirm"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-lg font-bold">Please confirm the following transaction:</div>
                    <div class="mt-2 flex flex-col items-center">
                        {#if tokens.length == 1}
                            <img src={imageUrl} alt={tokenName} class="h-20 w-20 object-contain rounded-md"/>
                            <div class="text-sm text-gray-800 dark:text-gray-200">{type == 'send' ? 'Send' : 'Change Approval for'} {tokenName} to</div>
                        {:else}
                            <div class="text-sm text-gray-800 dark:text-gray-200">{type == 'send' ? 'Send' : 'Change Approval for'} Multiple Tokens ({tokens.length})</div>
                            {#each tokens as t}
                                <div class="text-sm text-gray-400">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                            {/each}
                            <div>to</div>
                        {/if}
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
                    {#if sentCount > 0}
                        <div class="mt-2 text-gray-400">Sending {sentCount} of {tokens.length} tokens.</div>
                    {/if}
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
                    {#if sentCount > 0}
                        <div class="mt-2 text-gray-400">Sending {sentCount} of {tokens.length} tokens.</div>
                    {/if}
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
                        <a href={"https://explorer.voi.network/explorer/transaction/" + transactionId} target="_blank" class="text-xs underline text-blue-500 hover:text-blue-600">{transactionId}</a>
                    </div>
                    <div class="flex flex-row items-center mt-4 space-x-4">
                        <button on:click={afterClose} class="w-64 h-10 bg-blue-500 text-white rounded-md">Close</button>
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
                        {#if type == 'revoke'}
                            <button on:click={revokeApproval} class="w-64 h-10 bg-blue-500 text-white rounded-md">Try Again</button>
                        {:else}
                            <button on:click={reset} class="w-64 h-10 bg-blue-500 text-white rounded-md">Start Over</button>
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    </div>
</Modal>