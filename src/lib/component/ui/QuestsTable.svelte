<script lang="ts">
    import { supabasePublicClient } from '$lib/supabase';
    import { onMount } from 'svelte';

    export let wallet: string;
    let loading = true;
    let completedActions: string[] = [];

    const quests = [
        {
            id: 1,
            name: 'connect_wallet',
            desc: 'Connect your Wallet to NFT Navigator',
            guide: 'https://wind-bolt-806.notion.site/Quest-1-Connect-your-Wallet-to-NFTNavigator-dbe44f75bf1948d6a947920af97570df',
        },
        {
            id: 2,
            name: 'auth_wallet',
            desc: 'Authenticate your Wallet',
            guide: 'https://wind-bolt-806.notion.site/Quest-2-Authenticate-your-Wallet-bd8a312141e0403688953625e14106df',
        },
        {
            id: 3,
            name: 'token_approve',
            desc: 'Set an approved spender for a token in your wallet',
            guide: 'https://wind-bolt-806.notion.site/Quest-3-Set-an-approved-spender-for-a-token-in-your-wallet-8beac53d87ab4492a5009cc5db8d69b5?pvs=25',
        },
        {
            id: 4,
            name: 'token_transfer',
            desc: 'Transfer a Token to someone else',
            guide: 'https://wind-bolt-806.notion.site/Quest-4-Transfer-a-token-to-someone-else-23a00accea9b4dd299d43a52c6dadf76?pvs=25',
        },
        {
            id: 5,
            name: 'post_public',
            desc: 'Create a Public post in the NFT Lounge',
            guide: 'https://wind-bolt-806.notion.site/Quest-5-Create-a-Public-post-in-the-NFT-Lounge-d242603d980e47bda36866d723fdfcad?pvs=25',
        },
        {
            id: 6,
            name: 'post_private',
            desc: 'Create a Private post in the NFT Lounge',
            guide: 'https://wind-bolt-806.notion.site/Quest-6-Create-a-Private-post-in-the-NFT-Lounge-e6254158fb994c189a19308f74478f80?pvs=25',
        },
        {
            id: 7,
            name: 'post_poll_vote',
            desc: 'Vote in a Poll in the NFT Lounge',
            guide: 'https://wind-bolt-806.notion.site/Quest-7-Vote-in-a-Poll-in-the-NFT-Lounge-355b4f18a068470fb4f4c4cc3d981a2d',
        }
    ]

    onMount(async () => {
        loadData();
     
        loading = false;
    });

    async function loadData() {
        const { data, error } = await supabasePublicClient
            .from('actions')
            .select('*')
            .eq('address', wallet);

        if (error) {
            console.error('Failed to fetch quests', error);
        }
        else {
            completedActions = [...new Set(data.map(item => item.action))];
        }
    }

    // if wallet changes, reload the data
    $: {
        if (wallet) {
            loadData();
        }
    }

</script>
<p class="">Complete quests to earn Voi during the <a target="_blank" class="text-blue-500 hover:text-blue-400" href="https://medium.com/@voifoundation/phase-2-of-the-incentivised-testnet-bf32d880e8f4">Voiage to Mainnet!</a></p>
<p>Looking for more Quest? <a class="text-blue-500 hover:text-blue-400" href="https://quests.voirewards.com" target="_blank">Visit Voirewards.com/phase2</a> and check back here regularly.</p>
<br/>
<div class="flex flex-col md:flex-row shadow-2xl rounded-xl bg-opacity-0 bg-black dark:bg-white dark:bg-opacity-10 my-2">
    <div class="w-full overflow-hidden rounded-lg shadow-xs">
        <div class="w-full overflow-x-auto">
            {#if loading}
                <div class="flex items-center justify-center h-32">
                    <i class="fas fa-spinner fa-spin text-3xl text-gray-500"></i>
                </div>
            {:else}
                <table class="w-full whitespace-no-wrap">
                    <thead>
                        <tr class="text-xs font-semibold tracking-wide text-left text-gray-500 dark:text-gray-100 uppercase border-b bg-gray-50 dark:bg-gray-700">
                            <th class="px-4 py-3 align-top">Quest</th>
                            <th class="px-4 py-3 align-top">Description</th>
                            <th class="px-4 py-3 align-top">Guide</th>
                            <th class="px-4 py-3 align-top">Completed?</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-700 divide-y text-left">
                        {#each quests as quest}
                            <tr class="text-gray-700 dark:text-gray-100">
                                <td class="px-4 py-3">#{quest.id}</td>
                                <td class="px-4 py-3">{quest.desc}</td>
                                <td class="px-4 py-3">
                                    <a class="text-blue-500 hover:text-blue-400" target="_blank" href={quest.guide}>
                                        View Guide
                                    </a>
                                </td>
                                <td class="px-4 py-3">
                                    {#if completedActions.includes(quest.name)}
                                        <i class="fas fa-check text-green-500 text-3xl"></i>
                                    {:else}
                                        <i class="fas fa-times text-red-500 text-3xl"></i>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            {/if}
        </div>
    </div>
</div>