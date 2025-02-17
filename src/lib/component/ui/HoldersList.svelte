<script lang="ts">
    import type { Token } from '$lib/data/types';
    import { copy } from 'svelte-copy';
    import { toast } from '@zerodevx/svelte-toast';
	import { onMount, onDestroy } from 'svelte';
	import { getNFD } from '$lib/utils/nfd';
	import TokenCard from './TokenCard.svelte';
	import { inview } from 'svelte-inview';
    
    export let tokens: Token[] = [];
    export let showDownloadCSV = true;
    export let sortDirection: 'asc' | 'desc' = 'desc';
    export let searchText: string = '';
    let displayCount = 10;

    // build an array of unique holders and the tokens they hold, using token.owner
    let holders = {} as { [key: string]: Token[] };
    let loadedHolders = false;

    $: {
        if (tokens && !loadedHolders) {
            updateTokens(tokens);
        }
    }

    async function updateTokens(tokens: Token[]) {
        // Only process if we haven't loaded holders yet
        if (!loadedHolders) {
            holders = {};
            tokens.forEach(token => {
                if (!token.isBurned) {
                    if (holders[token.owner]) {
                        holders[token.owner].push(token);
                    } else {
                        holders[token.owner] = [token];
                    }
                }
            });

            // sort holders by number of tokens they hold
            holders = Object.fromEntries(Object.entries(holders).sort(([,a],[,b]) => b.length - a.length));

            const holderAddresses = Object.keys(holders);
            const nfds = await getNFD(holderAddresses);
            
            holders = Object.fromEntries(Object.entries(holders).map(([key, value]) => {
                return [key, value.map(token => {
                    const nfd = nfds.find(nfd => nfd.key === token.owner);
                    if (nfd) {
                        token.ownerNFD = nfd.replacementValue;
                        token.ownerAvatar = nfd.avatar;
                    }
                    return token;
                })];
            }));

            loadedHolders = true;
        }
    }

    $: filteredHolders = Object.entries(holders).map(([address, tokens]) => ({
        address,
        tokens,
        visible: !searchText || 
            address.toLowerCase().includes(searchText.toLowerCase()) || 
            (tokens[0].ownerNFD?.toLowerCase().includes(searchText.toLowerCase()))
    }))
    .sort((a, b) => sortDirection === 'asc' ? a.tokens.length - b.tokens.length : b.tokens.length - a.tokens.length);

    $: visibleCount = filteredHolders.filter(h => h.visible).length;

    function showMore() {
        displayCount = Math.min(displayCount + 10, Object.keys(holders).length);
    }

    function downloadCSV() {
        const headers = ['Address', 'NFD', 'Collection', 'Token', 'isListed', 'ListPrice', 'ListCurrency'];
        const holderArray = Object.entries(holders);

        const rows: any[] = [];
        holderArray.map(holder => {
            holder[1].forEach((token: Token) => {
                rows.push([token.owner,
                    token.ownerNFD ?? '', 
                    token.contractId, 
                    token.tokenId, 
                    token.marketData ? 'true' : 'false',
                    token.marketData ? token.marketData.price : '', 
                    token.marketData ? token.marketData.currency : '', 
                ]);
            });
        });

        let csvContent = headers.join(',') + '\n' + rows.map((e: any[]) => e.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const formattedDate = `${year}${month}${day}`;
        link.setAttribute('download', `collectors_${holderArray[0][1][0].contractId}_${formattedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
</script>
<div class="w-full m-0 md:p-4">
    {#if showDownloadCSV}
        <div class="flex justify-end items-center mb-4">
            <button on:click={downloadCSV} class="px-4 py-2 ml-2 bg-green-500 text-white rounded-lg shadow-md hover:bg-green-600 dark:bg-gray-700 dark:hover:bg-gray-600">Download CSV</button>
        </div>
    {/if}
    {#each filteredHolders.slice(0, displayCount) as holder (holder.address)}
        <div class="flex flex-col md:flex-row space-y-4 justify-start bg-slate-200 dark:bg-slate-700 rounded-xl m-2 p-4"
             class:hidden={!holder.visible}>
            <div class="flex flex-row space-x-4 items-start pb-6 md:pb-0">
                {#if holder.tokens[0].ownerAvatar}
                    <img src={holder.tokens[0].ownerAvatar} class="h-24 w-24 rounded-full" />
                {/if}
                <div class="flex flex-col justify-center">
                    <div class="flex flex-row space-x-2">
                        <a href="/portfolio/{holder.tokens[0].owner}">
                            <div class="text-xl font-bold">{holder.tokens[0].owner.slice(0, 8)}...{holder.tokens[0].owner.slice(-8)}</div>
                        </a>
                        <i use:copy={holder.tokens[0].owner} class="fas fa-copy cursor-pointer place-self-center" on:svelte-copy={() => toast.push(`Wallet Copied to Clipboard:<br/> ${holder.tokens[0].owner.substring(0,20)}...`)}></i>
                    </div>
                    {holder.tokens[0].ownerNFD ?? ''}
                    <div class="flex flex-row space-x-2 mt-8">
                        <div class="text-xs font-bold">Tokens:</div>
                        <div class="text-xs">{holder.tokens.length}</div>
                    </div>
                </div>
            </div>
            <div class="flex flex-row flex-wrap md:justify-end w-full md:mx-12" style="margin-top:-3rem; margin-bottom:1.5rem;">
                {#each holder.tokens.slice(0,5) as token (token.tokenId)}
                    <div class="transform scale-50 w-36 h-40 mx-1">
                        <TokenCard {token} />
                    </div>
                {/each}
            </div>
        </div>
    {/each}
    {#if visibleCount > displayCount}
        <div class="sentinel" use:inview={{ threshold: 1 }} on:inview_enter={showMore}></div>
    {/if}
</div>
