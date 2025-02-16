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

    const MAX_GROUP_SIZE = 16; // Maximum number of transactions in a group

    let sendingView: typeof SendingView[keyof typeof SendingView] = SendingView.Presend;
    if (tokens.length == 0 && token) tokens = [token];
    
    let transferTo = '';
    let transferToNFD = '';
    let tokenName = (tokens[0]) ? reformatTokenName(tokens[0].metadata?.name??'', tokens[0].tokenId) : ``;
    let isIndividualMode = false; // Toggle for individual sending mode
    let individualAddresses: { [key: string]: string } = {}; // Store addresses for individual tokens
    let individualNFDs: { [key: string]: string } = {}; // Store NFDs for individual addresses
    let pastedAddresses: string[] = []; // Store list of pasted addresses

    let selectedVoiBalance: number;
    let selectedNFTCount: number;
    let sendingError: string = '';
    let transactionId: string = '';
    let transactionIds: string[] = [];
    let tokenTransactions: { tokenId: string; txId: string; contractId: number }[] = [];
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

    function handlePastedAddresses(addresses: string[], currentTokenId: string) {
        console.log('Modal received pasted addresses:', addresses, 'for current token:', currentTokenId);
        if (!isIndividualMode) return;
        
        // Find the index of the current token
        const currentIndex = tokens.findIndex(t => `${t.contractId}-${t.tokenId}` === currentTokenId);
        if (currentIndex === -1) return;
        
        console.log('Current token index:', currentIndex);
        
        // Keep existing addresses for tokens before the current one
        const updatedAddresses = { ...individualAddresses };
        const updatedNFDs = { ...individualNFDs };
        
        // Populate addresses starting from the current token
        for (let i = 0; i < addresses.length; i++) {
            const tokenIndex = currentIndex + i;
            if (tokenIndex < tokens.length) {
                const token = tokens[tokenIndex];
                const key = `${token.contractId}-${token.tokenId}`;
                console.log(`Setting address for token ${tokenIndex}:`, addresses[i]);
                updatedAddresses[key] = addresses[i];
                
                // Update NFDs asynchronously
                getNFD([addresses[i]]).then((nfd) => {
                    if (nfd && nfd.length > 0) {
                        individualNFDs[key] = nfd[0].replacementValue;
                        // Force a UI update for NFDs
                        individualNFDs = { ...individualNFDs };
                    }
                });
            }
        }

        console.log('Updated individualAddresses:', updatedAddresses);
        // Update the addresses state
        individualAddresses = updatedAddresses;
    }

    async function sendToken(skipReset: boolean = false, retryCurrentToken: boolean = false) {
        console.log('send token to', isIndividualMode ? 'multiple addresses' : transferTo);
        if (!isIndividualMode && transferTo.length === 0) return;
        if (isIndividualMode && Object.keys(individualAddresses).length !== tokens.length) return;

        // Reset sentCount and tokenTransactions when starting a new send attempt, unless skipping or retrying
        if (!skipReset && !retryCurrentToken) {
            sentCount = 0;
            tokenTransactions = [];
        }

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
            const startIndex = retryCurrentToken ? sentCount : 0;
            const endIndex = retryCurrentToken ? sentCount + 1 : tokens.length;
            
            // Process tokens in groups of MAX_GROUP_SIZE
            for (let groupStart = startIndex; groupStart < endIndex; groupStart += MAX_GROUP_SIZE) {
                const groupEnd = Math.min(groupStart + MAX_GROUP_SIZE, endIndex);
                const currentGroupTokens = tokens.slice(groupStart, groupEnd);
                
                // Collect all transactions for the current group
                const groupTransactions: algosdk.Transaction[] = [];
                
                // First pass: collect all transactions
                for (const token of currentGroupTokens) {
                    const targetAddress = isIndividualMode ? 
                        individualAddresses[`${token.contractId}-${token.tokenId}`] : 
                        transferTo;

                    const contract = new Contract(token.contractId, algodClient, algodIndexer, opts);
                    const resp = type == 'send' 
                        ? await contract.arc72_transferFrom(token.owner, targetAddress, BigInt(token.tokenId), true, true)
                        : await contract.arc72_approve(targetAddress, Number(token.tokenId), true, true);

                    if (!resp || !resp.success) {
                        sendingError = resp?.error || 'Failed to prepare transaction';
                        sendingView = SendingView.Error;
                        return;
                    }

                    // Decode and collect transactions for this token
                    const suggestedParams = await algodClient.getTransactionParams().do();
                    
                    const tokenTransactions = resp.txns.map(txnB64 => {
                        const txnBytes = Buffer.from(txnB64, 'base64');
                        const decodedTxn = algosdk.decodeUnsignedTransaction(txnBytes);
                        
                        if (!decodedTxn.from) {
                            throw new Error('Transaction missing required from address');
                        }

                        // Create a new transaction while preserving all original parameters
                        let txn;
                        if (decodedTxn.type === algosdk.TransactionType.appl) {
                            // Format box references correctly
                            const formattedBoxes = decodedTxn.boxes?.map(box => ({
                                appIndex: box.appIndex || decodedTxn.appIndex || 0,
                                name: new Uint8Array(box.name)
                            }));

                            txn = algosdk.makeApplicationCallTxnFromObject({
                                from: algosdk.encodeAddress(decodedTxn.from.publicKey),
                                suggestedParams: suggestedParams,
                                appIndex: decodedTxn.appIndex,
                                appArgs: decodedTxn.appArgs,
                                boxes: formattedBoxes,
                                accounts: decodedTxn.appAccounts?.map(acc => algosdk.encodeAddress(acc.publicKey)),
                                foreignApps: decodedTxn.appForeignApps,
                                foreignAssets: decodedTxn.appForeignAssets,
                                note: decodedTxn.note,
                                onComplete: decodedTxn.appOnComplete || algosdk.OnApplicationComplete.NoOpOC
                            });
                        } else {
                            txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                                from: algosdk.encodeAddress(decodedTxn.from.publicKey),
                                to: decodedTxn.to ? algosdk.encodeAddress(decodedTxn.to.publicKey) : algosdk.encodeAddress(decodedTxn.from.publicKey),
                                amount: decodedTxn.amount || 0,
                                suggestedParams: suggestedParams,
                                note: decodedTxn.note
                            });
                        }

                        return txn;
                    });
                    
                    groupTransactions.push(...tokenTransactions);
                }

                // Assign group ID to the entire batch
                if (groupTransactions.length > 1) {
                    algosdk.assignGroupID(groupTransactions);
                }

                // Validate final group structure
                // After assigning group ID, verify all transactions have matching group
                if (groupTransactions.length > 1) {
                    const expectedGroup = groupTransactions[0].group;
                    const allSameGroup = expectedGroup && groupTransactions.every(t => 
                        t.group && Buffer.from(t.group).equals(Buffer.from(expectedGroup))
                    );
                    
                    if (!allSameGroup) {
                        sendingError = 'Transaction group validation failed';
                        sendingView = SendingView.Error;
                        return;
                    }
                }

                // Get transaction IDs before sending
                const currentTxIds = groupTransactions.map(txn => txn.txID());

                // Map transactions to tokens
                const newTransactions = currentGroupTokens.map((token, index) => {
                    // Each token operation requires 2 transactions (app call + payment)
                    // In a group, transactions alternate: [token1_app, token1_pay, token2_app, token2_pay, ...]
                    // For a single token, we get [app_call, payment]
                    // For two tokens, we get [token1_app, token1_pay]
                    const txIndex = index;  // Just use the index directly since we get one app call per token
                    return {
                        tokenId: String(token.tokenId),
                        contractId: token.contractId,
                        txId: currentTxIds[txIndex]
                    };
                });
                tokenTransactions = [...tokenTransactions, ...newTransactions];

                // Send the grouped transactions
                const status = await signAndSendTransactions([groupTransactions]);
                
                if (status === true) {
                    // If the transactions were successful, add their IDs
                    transactionIds.push(...currentTxIds);
                } else {
                    sendingError = 'Transaction failed';
                    sendingView = SendingView.Error;
                    return;
                }
                
                // Update sent count based on number of tokens processed
                sentCount += currentGroupTokens.length;
            }

            sendingView = SendingView.Waiting;

            // Wait for the last token's transaction to be confirmed
            if (tokens.length > 0) {
                const lastToken = tokens[tokens.length - 1];
                let t = null;

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
                } else {
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

                invalidateAll();
            }
        } catch(err) {
            console.error('error sending token', err);
            sendingError = (err instanceof Error) ? err.message : 'Unknown error';
            sendingView = SendingView.Error;
        }
    }

    function reset(preserveRecipient: boolean = false) {
        if (!preserveRecipient) {
            transferTo = '';
            transferToNFD = '';
            searchQuery = '';
        }
        sendingError = '';
        sendingView = SendingView.Presend;
        isIndividualMode = false;
        individualAddresses = {};
        individualNFDs = {};
        sentCount = 0;
        tokenTransactions = [];  // Also reset tokenTransactions when doing a full reset
    }

    function handleReset(preserveRecipient: boolean = false) {
        return (e: MouseEvent) => {
            e.preventDefault();
            reset(preserveRecipient);
        };
    }

    function afterClose() {
        console.log('afterClose');
        if (sendingView === SendingView.Sent) {
            onAfterSend(token??tokens[0]);
        }
        showModal = false;
        if (sendingView !== SendingView.Sent) {
            reset();
        }
        onClose();
    }

    function handleAddressSelect(address: string) {
        if (!isIndividualMode) {
            transferTo = address;
            searchQuery = address;
            isSearchOpen = false;  // Close the search dropdown
            if (transferTo) updateBalances();
        }
    }

    async function handleIndividualAddressSelect(tokenId: string, address: string) {
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
        // Force a UI update
        individualAddresses = { ...individualAddresses };
        individualNFDs = { ...individualNFDs };
    }

    function handleSearchChange(value: string) {
        searchQuery = value;
        // Only clear transferTo if the search query is empty or doesn't match the current transferTo
        if (!value || !transferTo.toLowerCase().includes(value.toLowerCase())) {
            transferTo = '';
            transferToNFD = '';
        }
        isSearchOpen = value.length > 0;
    }

    async function handleIndividualSearchChange(tokenId: string, value: string) {
        individualAddresses[tokenId] = value;
        if (value && value.length > 0) {
            const nfds = await getNFD([value]);
            if (nfds && nfds.length > 0) {
                individualNFDs[tokenId] = nfds[0].replacementValue;
            } else {
                individualNFDs[tokenId] = '';
            }
        } else {
            individualNFDs[tokenId] = '';
        }
        // Force a UI update
        individualAddresses = { ...individualAddresses };
        individualNFDs = { ...individualNFDs };
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
    <div class="w-full max-w-2xl mx-auto flex flex-col min-h-[400px]">
        <div class="flex-1 overflow-y-auto">
            <Breadcrumb class="w-full mb-6">
                <BreadcrumbItem><span class={sendingView === SendingView.Presend ? 'font-bold underline text-orange-500' : ''}>Select Wallet</span></BreadcrumbItem>
                <span class="mx-2">&gt;</span>
                <BreadcrumbItem><span class={sendingView === SendingView.Confirm ? 'font-bold underline text-orange-500' : ''}>Confirm</span></BreadcrumbItem>
                <span class="mx-2">&gt;</span>
                <BreadcrumbItem><span class={sendingView === SendingView.Sending || sendingView === SendingView.Waiting ? 'font-bold underline text-orange-500' : ''}>Sign</span></BreadcrumbItem>
                <span class="mx-2">&gt;</span>
                <BreadcrumbItem><span class={sendingView === SendingView.Sent ? 'font-bold underline text-orange-500' : ''}>Complete</span></BreadcrumbItem>
            </Breadcrumb>
            
            <div class="w-full max-w-xl mx-auto">
                {#if sendingView === "presend"}
                    <div class="flex flex-col items-center space-y-4 mb-4">
                        {#if tokens.length == 1}
                            <div class="flex flex-col items-center space-y-2">
                                <img src={imageUrl} alt={tokens[0].metadata?.name} class="h-24 w-24 object-contain rounded-lg shadow-sm"/>
                                <div class="text-xl font-bold">{tokenName}</div>
                                <div class="text-sm text-gray-500 dark:text-gray-400">{token?.contractId??''}</div>
                            </div>
                        {:else if tokens.length > 1}
                            <div class="w-full space-y-4">
                                <div class="text-xl font-bold text-center">Multiple Tokens ({tokens.length})</div>
                                <div class="flex items-center justify-center">
                                    <label class="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" bind:checked={isIndividualMode} class="sr-only peer">
                                        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                        <span class="ms-3 text-sm font-medium">Send to different addresses</span>
                                    </label>
                                </div>
                                <div class="max-h-[300px] overflow-auto p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full">
                                    {#each tokens as t}
                                        <div class="flex items-center space-x-4 p-4 mb-3 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                                            <img 
                                                src={t.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(t.metadataURI)}?w=240` : t.metadata?.image} 
                                                alt={t.metadata?.name} 
                                                class="h-16 w-16 object-contain rounded-md"
                                            />
                                            <div class="flex-grow">
                                                <div class="text-sm font-bold mb-2">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                                                {#if isIndividualMode}
                                                    <div class="relative walletSearchComponent w-full">
                                                        <WalletSearch
                                                            onSubmit={(addr) => handleIndividualAddressSelect(`${t.contractId}-${t.tokenId}`, addr)}
                                                            onChange={(value) => handleIndividualSearchChange(`${t.contractId}-${t.tokenId}`, value)}
                                                            onPasteAddresses={(addresses) => handlePastedAddresses(addresses, `${t.contractId}-${t.tokenId}`)}
                                                            showSubmitButton={false}
                                                            autoFocus={false}
                                                            value={individualAddresses[`${t.contractId}-${t.tokenId}`] ?? ''}
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
                            </div>
                        {/if}
                    </div>

                    <div class="flex flex-col items-center space-y-4 w-full">
                        {#if type == 'approve'}
                            <div class="text-center space-y-4 w-full max-w-md">
                                <div class="text-sm text-gray-500">An approved spender can transfer a token on your behalf. This is often used when listing a token on a marketplace.</div>
                                <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <div class="text-lg font-medium mb-1">Current Approved Spender</div>
                                    <div class="text-sm text-gray-500">{token?.approved == zeroAddress ? 'None' : `${token?.approved.slice(0, 8)}...${token?.approved.slice(-8)}`}</div>
                                </div>
                            </div>
                        {/if}

                        {#if !isIndividualMode}
                            <div class="w-full max-w-md space-y-3">
                                <div class="text-lg font-bold text-center">{type == 'send' ? 'Send to' : 'Change Approved Spender to'}</div>
                                <div class="relative walletSearchComponent w-full">
                                    <WalletSearch
                                        onSubmit={handleAddressSelect}
                                        onChange={handleSearchChange}
                                        showSubmitButton={false}
                                        value={searchQuery}
                                    />
                                </div>
                            </div>
                        {/if}
                    </div>

                    {#if type == 'approve' && token?.approved !== zeroAddress}
                        <div class="flex flex-col items-center mt-6 space-y-4">
                            <div class="text-gray-500">or</div>
                            <button on:click={() => revokeApproval()} class="w-64 h-10 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">Revoke Approval</button>
                        </div>
                    {/if}
                {:else if sendingView === "confirm"}
                    <div class="flex flex-col items-center w-full space-y-6">
                        <div class="text-xl font-bold">Please confirm the following transaction{tokens.length > 1 ? 's' : ''}</div>
                        {#if !isIndividualMode}
                            <div class="flex flex-col items-center space-y-4 w-full max-w-md max-h-[300px] overflow-auto">
                                {#if tokens.length == 1}
                                    <div class="flex flex-col items-center space-y-3">
                                        <img src={imageUrl} alt={tokenName} class="h-24 w-24 object-contain rounded-lg shadow-sm"/>
                                        <div class="text-lg font-medium">{tokenName}</div>
                                        <div class="text-sm text-gray-600 dark:text-gray-300">{type == 'send' ? 'Send to' : 'Change Approval to'}</div>
                                    </div>
                                {:else}
                                    <div class="flex flex-col items-center space-y-3 w-full">
                                        <div class="text-lg font-medium">{type == 'send' ? 'Send' : 'Change Approval for'} Multiple Tokens ({tokens.length})</div>
                                        <div class="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-lg space-y-2">
                                            {#each tokens as t}
                                                <div class="text-sm text-gray-600 dark:text-gray-300">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}

                                <div class="flex flex-col items-center space-y-1 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full">
                                    {#if type == 'send'}
                                        <div class="text-sm font-medium">Recipient Address</div>
                                    {:else}
                                        <div class="text-sm font-medium">New Approved Spender</div>
                                    {/if}
                                    <div class="text-sm text-gray-600 dark:text-gray-400 break-all text-center">{transferTo}</div>
                                    {#if transferToNFD.length > 0}
                                        <div class="text-sm text-blue-500">{transferToNFD}</div>
                                    {/if}
                                </div>

                                <div class="flex justify-center space-x-6 w-full">
                                    <div class="flex-1 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                                        <div class="text-sm font-medium mb-1">{type == 'send' ? 'Recipient\'s Balance' : 'Spender\'s Balance'}</div>
                                        <div class="text-lg">{selectedVoiBalance ?? 0} VOI</div>
                                    </div>
                                    <div class="flex-1 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
                                        <div class="text-sm font-medium mb-1">NFTs Owned</div>
                                        <div class="text-lg">{selectedNFTCount ?? 0}</div>
                                    </div>
                                </div>

                                {#if selectedVoiBalance == 0}
                                    <div class="p-4 bg-red-100 dark:bg-red-900 rounded-lg text-center w-full">
                                        <div class="text-lg font-bold text-red-600 dark:text-red-400 mb-1">Warning!</div>
                                        <div class="text-sm text-red-600 dark:text-red-400">
                                            {#if type == 'send'}
                                                The recipient address has no Voi. Please verify before sending.
                                            {:else}
                                                The approved spender address has no Voi. Please verify before approving.
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {:else}
                            <div class="w-full max-w-xl space-y-3 max-h-[300px] overflow-auto">
                                {#each tokens as t}
                                    <div class="flex items-center space-x-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <img 
                                            src={t.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(t.metadataURI)}?w=240` : t.metadata?.image} 
                                            alt={t.metadata?.name} 
                                            class="h-16 w-16 object-contain rounded-lg shadow-sm"
                                        />
                                        <div class="flex-grow">
                                            <div class="text-sm font-bold mb-2">{reformatTokenName(t.metadata?.name??'', t.tokenId)}</div>
                                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                                <div class="font-medium">{type == 'send' ? 'Sending to:' : 'Approving for:'}</div>
                                                <div class="break-all">{individualAddresses[`${t.contractId}-${t.tokenId}`]}</div>
                                                {#if individualNFDs[`${t.contractId}-${t.tokenId}`]}
                                                    <div class="text-sm text-blue-500 mt-1">{individualNFDs[`${t.contractId}-${t.tokenId}`]}</div>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {:else if sendingView === "sending"}
                    <div class="flex flex-col items-center space-y-4 py-10">
                        <div class="text-xl font-bold">Processing {type == 'send' ? 'Transfer' : 'Approval'}{transactionIds.length > 1 ? ' Group' : ''}</div>
                        {#if tokens.length > MAX_GROUP_SIZE}
                            <div class="text-lg text-gray-600 dark:text-gray-300">
                                Group {Math.floor(sentCount / MAX_GROUP_SIZE) + 1} of {Math.ceil(tokens.length / MAX_GROUP_SIZE)}
                            </div>
                        {/if}
                        <div class="flex flex-col items-center space-y-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full max-w-md">
                            <div class="flex flex-wrap gap-2">
                                {#each tokens.slice(sentCount, Math.min(sentCount + MAX_GROUP_SIZE, tokens.length)) as token}
                                    <div class="relative">
                                        <img 
                                            src={token.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=240` : token.metadata?.image} 
                                            alt={token.metadata?.name} 
                                            class="h-12 w-12 object-contain rounded-lg shadow-sm"
                                        />
                                        <div class="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            {token.tokenId}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                            <div class="w-full text-center">
                                <div class="text-sm font-bold mb-2">
                                    {#if type == 'send'}
                                        Sending {Math.min(MAX_GROUP_SIZE, tokens.length - sentCount)} Tokens
                                    {:else}
                                        Changing Approval for {Math.min(MAX_GROUP_SIZE, tokens.length - sentCount)} Tokens
                                    {/if}
                                </div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">
                                    <div class="font-medium">{type == 'send' ? 'Recipients:' : 'New Approved Spender:'}</div>
                                    {#if isIndividualMode}
                                        <div class="max-h-32 overflow-y-auto mt-2 space-y-2">
                                            {#each tokens.slice(sentCount, Math.min(sentCount + MAX_GROUP_SIZE, tokens.length)) as token}
                                                <div class="text-xs break-all bg-gray-200 dark:bg-gray-700 p-2 rounded">
                                                    Token #{token.tokenId} → {individualAddresses[`${token.contractId}-${token.tokenId}`]}
                                                </div>
                                            {/each}
                                        </div>
                                    {:else}
                                        <div class="break-all">{transferTo}</div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="mt-2">
                            <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l1.414-1.414C2.56 15.88 1.5 14.02 1.5 12H4c0 1.116.224 2.195.668 3.207l1.414-1.414zM12 20c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C9.12 16.56 10.98 15.5 13 15.5V18c-1.116 0-2.195.224-3.207.668l-1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414z"></path>
                            </svg>
                        </div>
                        <div class="mt-2 text-gray-400">Please sign the transaction{transactionIds.length > 1 ? ' group' : ''} in your wallet</div>
                        <div class="flex flex-col items-center mt-4">
                            <button on:click={handleReset()} class="w-64 h-10 bg-blue-500 text-white rounded-md">Cancel</button>
                        </div>
                    </div>
                {:else if sendingView === "waiting"}
                    <div class="flex flex-col items-center space-y-4 py-10">
                        <div class="text-xl font-bold">Waiting for Confirmation</div>
                        {#if tokens.length > MAX_GROUP_SIZE}
                            <div class="text-lg text-gray-600 dark:text-gray-300">
                                Processing group {Math.floor((sentCount - 1) / MAX_GROUP_SIZE) + 1} of {Math.ceil(tokens.length / MAX_GROUP_SIZE)}
                            </div>
                        {/if}
                        <div class="flex flex-col items-center space-y-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full max-w-md">
                            <div class="flex flex-wrap gap-2">
                                {#each tokens.slice(Math.max(0, sentCount - MAX_GROUP_SIZE), sentCount) as token}
                                    <div class="relative">
                                        <img 
                                            src={token.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=240` : token.metadata?.image} 
                                            alt={token.metadata?.name} 
                                            class="h-12 w-12 object-contain rounded-lg shadow-sm"
                                        />
                                        <div class="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            {token.tokenId}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                            <div class="w-full text-center">
                                <div class="text-sm font-bold mb-2">
                                    {#if type == 'send'}
                                        Confirming {Math.min(MAX_GROUP_SIZE, sentCount - Math.max(0, sentCount - MAX_GROUP_SIZE))} Tokens
                                    {:else}
                                        Confirming Approval for {Math.min(MAX_GROUP_SIZE, sentCount - Math.max(0, sentCount - MAX_GROUP_SIZE))} Tokens
                                    {/if}
                                </div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">
                                    <div class="font-medium">{type == 'send' ? 'Recipients:' : 'New Approved Spender:'}</div>
                                    {#if isIndividualMode}
                                        <div class="max-h-32 overflow-y-auto mt-2 space-y-2">
                                            {#each tokens.slice(Math.max(0, sentCount - MAX_GROUP_SIZE), sentCount) as token}
                                                <div class="text-xs break-all bg-gray-200 dark:bg-gray-700 p-2 rounded">
                                                    Token #{token.tokenId} → {individualAddresses[`${token.contractId}-${token.tokenId}`]}
                                                </div>
                                            {/each}
                                        </div>
                                    {:else}
                                        <div class="break-all">{transferTo}</div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="mt-2">
                            <svg class="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l1.414-1.414C2.56 15.88 1.5 14.02 1.5 12H4c0 1.116.224 2.195.668 3.207l1.414-1.414zM12 20c-3.042 0-5.824-1.135-7.938-3l1.414-1.414C9.12 16.56 10.98 15.5 13 15.5V18c-1.116 0-2.195.224-3.207.668l-1.414-1.414A7.962 7.962 0 0112 20zm5.291-6H12v-2h5.291l1.414 1.414-1.414 1.414z"></path>
                            </svg>
                        </div>
                        <div class="mt-2 text-gray-400">Transaction group signed, awaiting confirmation</div>
                    </div>
                {:else if sendingView === "sent"}
                    <div class="flex flex-col items-center space-y-4 py-20">
                        <div class="text-xl font-bold">{type == 'send' ? 'Token Sent' : 'Token Approval Changed'}</div>
                        <div class="mt-2 text-gray-400">
                            {#if type == 'send'}
                                {#if isIndividualMode}
                                    All tokens have been sent to their respective addresses
                                {:else}
                                    <div class="flex flex-col items-center">
                                        <span>The token{tokens.length > 1 ? 's have' : ' has'} been sent to</span>
                                        <span class="text-sm break-all">{transferTo}</span>
                                    </div>
                                {/if}
                            {:else}
                                {#if transferTo === zeroAddress}
                                    Token approval has been revoked.
                                {:else}
                                    <div class="flex flex-col items-center">
                                        <span>The token{tokens.length > 1 ? 's have' : ' has'} been approved for</span>
                                        <span class="text-sm break-all">{transferTo}</span>
                                    </div>
                                {/if}
                            {/if}
                        </div>
                        <div class="mt-2 text-gray-400 flex flex-col items-center">
                            <div class="font-bold mb-2">Transactions</div>
                            <div class="max-w-md w-full space-y-1">
                                {#each tokenTransactions as tx}
                                    <div class="flex flex-col bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <div class="flex items-center justify-between gap-2">
                                            {#if tokens.find(t => String(t.tokenId) === tx.tokenId && t.contractId === tx.contractId)?.metadata?.name}
                                                <div class="text-xs text-gray-500">
                                                    {tokens.find(t => String(t.tokenId) === tx.tokenId && t.contractId === tx.contractId)?.metadata?.name}
                                                </div>
                                            {/if}
                                            <a href={"https://explorer.voi.network/explorer/transaction/" + tx.txId} 
                                            target="_blank" 
                                            class="text-xs underline text-blue-500 hover:text-blue-600">
                                                {tx.txId ? `${tx.txId.slice(0, 8)}...${tx.txId.slice(-8)}` : 'Unknown'}
                                            </a>
                                        </div>
                                        {#if isIndividualMode}
                                            <div class="text-xs text-gray-500">
                                                {type == 'send' ? 'To:' : 'Approved For:'} {individualAddresses[`${tx.contractId}-${tx.tokenId}`]}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>
                        <div class="flex flex-row items-center mt-4 space-x-4">
                            <button on:click={afterClose} class="w-64 h-10 bg-blue-500 text-white rounded-md">Close</button>
                        </div>
                    </div>
                {:else if sendingView === "error"}
                    <div class="flex flex-col items-center space-y-4 py-10">
                        <div class="text-xl font-bold">Error Processing {type == 'send' ? 'Transfer' : 'Approval'} Group</div>
                        {#if tokens.length > MAX_GROUP_SIZE}
                            <div class="text-lg text-gray-600 dark:text-gray-300">
                                Error in group {Math.floor(sentCount / MAX_GROUP_SIZE) + 1} of {Math.ceil(tokens.length / MAX_GROUP_SIZE)}
                            </div>
                        {/if}
                        <div class="flex flex-col items-center space-y-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-full max-w-md">
                            <div class="grid grid-cols-4 gap-2">
                                {#each tokens.slice(sentCount, Math.min(sentCount + MAX_GROUP_SIZE, tokens.length)) as token}
                                    <div class="relative">
                                        <img 
                                            src={token.metadataURI ? `https://prod.cdn.highforge.io/i/${encodeURIComponent(token.metadataURI)}?w=240` : token.metadata?.image} 
                                            alt={token.metadata?.name} 
                                            class="h-12 w-12 object-contain rounded-lg shadow-sm opacity-50"
                                        />
                                        <div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            {token.tokenId}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                            <div class="w-full text-center">
                                <div class="text-sm font-bold mb-2 text-red-500">Failed to Process {Math.min(MAX_GROUP_SIZE, tokens.length - sentCount)} Tokens</div>
                                <div class="text-sm text-gray-600 dark:text-gray-400">
                                    <div class="font-medium">Recipients:</div>
                                    {#if isIndividualMode}
                                        <div class="max-h-32 overflow-y-auto mt-2 space-y-2">
                                            {#each tokens.slice(sentCount, Math.min(sentCount + MAX_GROUP_SIZE, tokens.length)) as token}
                                                <div class="text-xs break-all bg-gray-200 dark:bg-gray-700 p-2 rounded">
                                                    Token #{token.tokenId} → {individualAddresses[`${token.contractId}-${token.tokenId}`]}
                                                </div>
                                            {/each}
                                        </div>
                                    {:else}
                                        <div class="break-all">{transferTo}</div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                        <div class="mt-2 text-red-500">Error: {sendingError}</div>
                        <div class="flex flex-col items-center mt-4 space-y-4">
                            <div class="flex space-x-4">
                                {#if type == 'revoke'}
                                    <button on:click={revokeApproval} class="w-52 h-10 bg-blue-500 text-white rounded-md">Try Again</button>
                                {:else}
                                    <button on:click={() => sendToken(false, true)} class="w-52 h-10 bg-blue-500 text-white rounded-md">Retry Group</button>
                                    {#if tokens.length > sentCount + MAX_GROUP_SIZE}
                                        <button 
                                            on:click={() => {
                                                sentCount += MAX_GROUP_SIZE;
                                                sendingView = SendingView.Sending;
                                                sendToken(true);
                                            }} 
                                            class="w-52 h-10 bg-gray-500 text-white rounded-md"
                                        >
                                            Skip to Next Group
                                        </button>
                                    {/if}
                                {/if}
                            </div>
                            <div class="flex flex-row items-center mt-4 space-x-4">
                                <button on:click={handleReset()} class="w-52 h-10 bg-gray-500 text-white rounded-md">Start Over</button>
                                <button on:click={afterClose} class="w-52 h-10 border border-gray-500 text-gray-700 dark:text-gray-300 rounded-md">Cancel</button>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>

        {#if sendingView === "presend" || sendingView === "confirm"}
            <div class="mt-auto border-t border-gray-200 dark:border-gray-700 py-4">
                <div class="flex justify-between max-w-md mx-auto w-full space-x-4">
                    {#if sendingView === "presend"}
                        <button on:click={afterClose} class="flex-1 h-11 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">Cancel</button>
                        <button 
                            on:click={() => { if (isNextEnabled) sendingView = SendingView.Confirm; }} 
                            class="flex-1 h-11 rounded-lg transition-colors {isNextEnabled ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}"
                        >Next</button>
                    {:else if sendingView === "confirm"}
                        <button on:click={handleReset(true)} class="flex-1 h-11 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors">Back</button>
                        <button on:click={() => sendToken()} class="flex-1 h-11 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">Submit</button>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</Modal>