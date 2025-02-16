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
    let isIndividualMode = false; // Toggle for individual sending mode
    let individualAddresses: { [key: string]: string } = {}; // Store addresses for individual tokens
    let individualNFDs: { [key: string]: string } = {}; // Store NFDs for individual addresses

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
    let isNextEnabled = false;

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

    $: {
        if (!isIndividualMode) {
            isNextEnabled = transferTo.length > 0;
        } else {
            isNextEnabled = tokens.every(t => {
                const addr = individualAddresses[`${t.contractId}-${t.tokenId}`];
                return addr && addr.length > 0;
            });
        }
    }

    $: if (transferTo && transferTo.length > 0 && !isIndividualMode) {
        updateBalances();

        // get nfd for transferTo address
        transferToNFD = '';
        getNFD([transferTo]).then((nfd) => {
            if (nfd && nfd.length > 0) transferToNFD = nfd[0].replacementValue;
        });
    }
    else if (!isIndividualMode) {
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

    // New function to handle individual address updates
    async function updateIndividualAddress(tokenId: string, address: string) {
        individualAddresses[tokenId] = address;
        if (address && address.length > 0) {
            const nfds = await getNFD([address]);
            if (nfds && nfds.length > 0) {
                individualNFDs[tokenId] = nfds[0].replacementValue;
            } else {
                individualNFDs[tokenId] = '';
            }
        } else {
            individualNFDs[tokenId] = '';
        }
    }

    async function sendToken() {
        console.log('send token to', isIndividualMode ? 'multiple addresses' : transferTo);
        if (!isIndividualMode && transferTo.length === 0) return;
        if (isIndividualMode && Object.keys(individualAddresses).length !== tokens.length) return;

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
                const targetAddress = isIndividualMode ? 
                    individualAddresses[`${tokens[i].contractId}-${tokens[i].tokenId}`] : 
                    transferTo;

                const contract = new Contract(tokens[i].contractId, algodClient, algodIndexer, opts);
                if (type == 'send') {
                    resp = await contract.arc72_transferFrom(tokens[i].owner, targetAddress, BigInt(tokens[i].tokenId), true, true);
                }
                else {
                    resp = await contract.arc72_approve(targetAddress, Number(tokens[i].tokenId), true, true);
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
        isIndividualMode = false;
        individualAddresses = {};
        individualNFDs = {};
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

    function handleAddressSelect(address: string) {
        if (!isIndividualMode) {
            transferTo = address;
            searchQuery = address;
            if (transferTo) updateBalances();
        }
    }

    function handleIndividualAddressSelect(tokenId: string, address: string) {
        updateIndividualAddress(tokenId, address);
    }

    function handleSearchChange(value: string) {
        searchQuery = value;
        if (!value) {
            transferTo = '';
            transferToNFD = '';
        }
    }

    function handleIndividualSearchChange(tokenId: string, value: string) {
        updateIndividualAddress(tokenId, value);
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
            handleAddressSelect(filteredWallets[selected].address);
        }
    }

    function removeToken(tokenToRemove: Token) {
        tokens = tokens.filter(t => !(t.contractId === tokenToRemove.contractId && t.tokenId === tokenToRemove.tokenId));
        // Clean up individual addresses if in individual mode
        if (isIndividualMode) {
            delete individualAddresses[`${tokenToRemove.contractId}-${tokenToRemove.tokenId}`];
            delete individualNFDs[`${tokenToRemove.contractId}-${tokenToRemove.tokenId}`];
        }
        // If no tokens left, close the modal
        if (tokens.length === 0) {
            afterClose();
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
                        <div class="flex items-center mt-2 mb-4">
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" bind:checked={isIndividualMode} class="sr-only peer">
                                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                <span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Send to different addresses</span>
                            </label>
                        </div>
                        <div class="max-h-96 overflow-auto p-1 m-1 border-gray-500 bg-gray-200 dark:bg-gray-700 rounded-lg w-full">
                            {#each tokens as t}
                                <div class="flex items-center space-x-4 p-4 border-b border-gray-600">
                                    <img 
                                        src={t.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(t.metadataURI)}?w=240` : t.metadata?.image} 
                                        alt={t.metadata?.name} 
                                        class="h-16 w-16 object-contain rounded-md"
                                    />
                                    <div class="flex-grow">
                                        <div class="text-sm font-bold mb-2 text-gray-800 dark:text-gray-300">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                                        {#if isIndividualMode}
                                            <div class="relative walletSearchComponent w-full">
                                                <WalletSearch
                                                    onSubmit={(addr) => handleIndividualAddressSelect(`${t.contractId}-${t.tokenId}`, addr)}
                                                    onChange={(value) => handleIndividualSearchChange(`${t.contractId}-${t.tokenId}`, value)}
                                                    showSubmitButton={false}
                                                />
                                                {#if individualNFDs[`${t.contractId}-${t.tokenId}`]}
                                                    <div class="text-xs text-gray-500 mt-1">{individualNFDs[`${t.contractId}-${t.tokenId}`]}</div>
                                                {/if}
                                            </div>
                                        {/if}
                                    </div>
                                    <button 
                                        on:click={() => removeToken(t)} 
                                        class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                                        title="Remove Token"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                    <div class="text-sm text-gray-400">{token?.contractId??''}</div>
                </div>
                <div class="flex flex-col items-center mt-4 w-full">
                    {#if type == 'approve'}
                        <div class="text-xs mb-2 text-gray-400 max-w-96">An approved spender can transfer a token on your behalf. This is often used when listing a token on a marketplace.</div>
                        <div class="mb-2">
                            <div class="text-lg">Current Approved Spender</div>
                            <div class="text-sm text-gray-400">{token?.approved == zeroAddress ? 'None' : `${token?.approved.slice(0, 8)}...${token?.approved.slice(-8)}`}</div>
                        </div>
                    {/if}
                    {#if !isIndividualMode}
                        <div class="text-xl font-bold">{type == 'send' ? 'Send to' : 'Change Approved Spender to'}</div>
                        <div class="relative walletSearchComponent w-full max-w-md">
                            <WalletSearch
                                onSubmit={handleAddressSelect}
                                onChange={handleSearchChange}
                                showSubmitButton={false}
                            />
                        </div>
                    {/if}
                </div>
                {#if type == 'approve' && token?.approved !== zeroAddress}
                    <div class="flex flex-col items-center mt-4">
                        <div class="mb-4">or</div>
                        <button on:click={() => revokeApproval()} class="w-64 h-10 bg-blue-500 text-white rounded-md">Revoke Approval</button>
                    </div>
                {/if}
                <div class="flex flex-row justify-between mt-4 space-x-2">
                    <button on:click={afterClose} class="w-52 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                    <button 
                        on:click={() => { if (isNextEnabled) sendingView = SendingView.Confirm; }} 
                        class="w-52 h-10 bg-blue-500 text-white rounded-md {!isNextEnabled ? 'bg-gray-400 cursor-default' : ''}"
                    >Next</button>
                </div>
            {:else if sendingView === "confirm"}
                <div class="flex flex-col items-center m-2">
                    <div class="text-lg font-bold">Please confirm the following transaction{tokens.length > 1 ? 's' : ''}:</div>
                    {#if !isIndividualMode}
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
                        <div class="flex flex-col items-center mt-2">
                            <div class="text-sm text-gray-400">{transferTo}</div>
                            {#if transferToNFD.length > 0}
                                <div class="text-sm text-gray-400">{transferToNFD}</div>
                            {/if}
                        </div>
                        <div class="flex flex-row justify-center">
                            <div class="m-1 p-3">
                                <div class="text-sm font-bold">Recipient's Voi Balance</div>
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
                    {:else}
                        <div class="w-full max-w-2xl mt-4 max-h-96 overflow-auto">
                            {#each tokens as t}
                                <div class="flex items-center space-x-4 mb-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <img 
                                        src={t.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(t.metadataURI)}?w=240` : t.metadata?.image} 
                                        alt={t.metadata?.name} 
                                        class="h-16 w-16 object-contain rounded-md"
                                    />
                                    <div class="flex-grow">
                                        <div class="text-sm font-bold mb-2">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                                        <div class="text-sm text-gray-600 dark:text-gray-400">
                                            Sending to: {individualAddresses[`${t.contractId}-${t.tokenId}`]}
                                            {#if individualNFDs[`${t.contractId}-${t.tokenId}`]}
                                                <div class="text-xs text-gray-500">{individualNFDs[`${t.contractId}-${t.tokenId}`]}</div>
                                            {/if}
                                        </div>
                                    </div>
                                    <button 
                                        on:click={() => removeToken(t)} 
                                        class="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                                        title="Remove Token"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
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
                    <div class="flex flex-row items-center mt-4 space-x-4">
                        {#if type == 'revoke'}
                            <button on:click={revokeApproval} class="w-52 h-10 bg-blue-500 text-white rounded-md">Try Again</button>
                        {:else}
                            <button on:click={sendToken} class="w-52 h-10 bg-blue-500 text-white rounded-md">Try Again</button>
                        {/if}
                        <button on:click={reset} class="w-52 h-10 bg-gray-500 text-white rounded-md">Start Over</button>
                        <button on:click={afterClose} class="w-52 h-10 border border-gray-500 text-gray-700 dark:text-gray-300 rounded-md">Cancel</button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</Modal>