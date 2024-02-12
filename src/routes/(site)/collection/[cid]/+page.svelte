<script lang="ts">
	import type { PageData } from './$types';
    import type { Token } from '$lib/data/types';
	import { onMount } from 'svelte';
    import { Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
    import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';
	import TokenCard from '$lib/component/ui/TokenCard.svelte';
    import BreadcrumbCustom from '$lib/component/ui/BreadcrumbCustom.svelte';
    //@ts-ignore
    import Device from 'svelte-device-info';
    //@ts-ignore
    // import { mp as Contract } from 'ulujs';
    import { algodClient, algodIndexer } from '$lib/utils/algod';

    export let data: PageData;
    let contractId = data.contractId;
    let tokens = [] as Token[];
    let categories = {} as { [key: string]: {} };
    let collectionName = '';
    let filteredTokens = [] as Token[];
    let filters = {} as { [key: string]: string };
    let isMobile = false;

    const zeroAddress = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

    onMount(() => {
        isMobile = Device.isMobile;
        getTokens();
    });

    /*const getMarketplaceData = async (token: Token) => {
        if (token.approved == zeroAddress || token.approved == token.owner) return null;
        console.log(token);

        try {
            // Search for transactions involving the escrow account
            let transactions = await algodIndexer.searchForTransactions().address(token.approved).txType('appl').do();
            let contractId = null;
            console.log(transactions);

            for(let tx of transactions.transactions) {
                if (tx['tx-type'] === 'appl') {
                    console.log(`Found application call transaction: ${tx.id}`);
                    console.log(`Application ID involved: ${tx['application-transaction']['application-id']}`);
                    contractId = tx['application-transaction']['application-id'];
                    break;
                }
            }

            if (contractId == null) return null;

            const ctc = new Contract(contractId,algodClient,algodIndexer);
            const escrowData = await ctc.getEvents();
            console.log(escrowData);

        } catch (error) {
            console.error('Error searching transactions:', error);
        }
        return null;
    }*/

    const getTokens = async () => {
        if (contractId) {
            const url = `https://arc72-idx.voirewards.com/nft-indexer/v1/tokens?contractId=${contractId}`;
            try {
                const data = await fetch(url).then((response) => response.json());
                if (data.tokens.length > 0) {
                    tokens = data.tokens.map((token: any) => {
                        const metadata = JSON.parse(token.metadata);
                        
                        return {
                            contractId: token.contractId,
                            tokenId: token.tokenId,
                            owner: token.owner,
                            metadataURI: token.metadataURI,
                            metadata: metadata,
                            mintRound: token['mint-round'],
                            approved: token.approved,
                            //marketId: token.marketId,
                        }
                    });
                    collectionName = tokens[0].metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';

                    // for each token in tokens, get the marketplace data
                    /*for (let token of tokens) {
                        let mpData = await getMarketplaceData(token);
                        if (mpData) break;
                    }*/

                    tokens = tokens;
                }

            }
            catch(err) {
                console.error(err);
            }

            /*try {
                const nfd = await getNFD([walletId]); // nfd is array of objects with key = owner, replacementValue = nfd
                const nfdObj: any = nfd.find((n: any) => n.key === walletId);
                if (nfdObj) {
                    walletNFD = nfdObj.replacementValue;
                }

            }
            catch(err) {
                console.error(err);
            }*/
        }
    }

    // reactive stuff
    $: {
        let combinedProperties = {} as { [key: string]: { [key: string]: number } };
        tokens.forEach(token => {
            Object.entries(token.metadata.properties).forEach(([key, value]) => {
                if (combinedProperties[key]) {
                    if (combinedProperties[key][value]) {
                        combinedProperties[key][value]++;
                    } else {
                        combinedProperties[key][value] = 1;
                    }
                } else {
                    combinedProperties[key] = { [value]: 1 };
                }
            });
        });

        Object.keys(combinedProperties).forEach(key => {
            let sortedObject = Object.entries(combinedProperties[key])
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
            combinedProperties[key] = sortedObject;
        });

        categories = combinedProperties;

        // filter tokens using filters
        filteredTokens = tokens.filter(token => {
            return Object.entries(filters).every(([key, value]) => {
                if (value === '') return true;
                //@ts-ignore
                return token.metadata.properties[key] === value;
            });
        });
    }
</script>

<BreadcrumbCustom aria-label="Navigation breadcrumb" solidClass="flex px-5 py-3 text-gray-700 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 justify-between" solid>
    <BreadcrumbItem href="/" class="hover:text-blue-800" >
        <svelte:fragment slot="icon">
            <HomeOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>Home
    </BreadcrumbItem>
    <BreadcrumbItem href="/collection/{contractId}" class="hover:text-blue-800">
        <svelte:fragment slot="icon">
            <ChevronDoubleRightOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>Collection ({collectionName})
    </BreadcrumbItem>
    <svelte:fragment slot="right">
        <div></div>
    </svelte:fragment>
</BreadcrumbCustom>
<div class="flex">
    {#if !isMobile}
        <div class="p-4">
            {#each Object.entries(categories) as [category, traits]}
                <div class="mb-4">
                    <label class="block text-gray-700 text-sm font-bold mb-2" for={category}>
                        {category}
                    </label>
                    <div class="relative">
                        <select bind:value={filters[category]} class="block appearance-none w-48 bg-white border border-gray-200 text-gray-700 py-3 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-gray-500" id={category}>
                            <option value="">All</option>
                            {#each Object.entries(traits) as [trait, count]}
                                <option value={trait}>{trait+' ('+count+')'}</option>
                            {/each}
                        </select>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
    <div class="flex flex-wrap flex-grow justify-center">
        {#each filteredTokens as token}
            <div class="p-4">
                <TokenCard {token} />
            </div>
        {/each}
    </div>
</div>