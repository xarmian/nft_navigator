<script lang="ts">
	import type { PageData } from './$types';
    import type { Token } from '$lib/data/types';
    import TokenComponent from '$lib/component/ui/TokenDetail.svelte';
	import { A } from 'flowbite-svelte';
    import { Tabs, TabItem, Indicator, Breadcrumb, BreadcrumbItem } from 'flowbite-svelte';
    import { HomeOutline, ChevronDoubleRightOutline } from 'flowbite-svelte-icons';

    export let data: PageData;
    $: walletId = data.props.walletId;
    $: walletIds = walletId.split(',');
    $: walletNFD = data.props.walletNFD;
    $: tokens = data.props.tokens;
    $: approvals = data.props.approvals;

    $: formattedWallet = (walletIds) ? (walletIds[0].length > 8
        ? `${walletIds[0].slice(0, 8)}...${walletIds[0].slice(-8)}`
        : walletIds[0]) : '';
</script>

<Breadcrumb aria-label="Navigation breadcrumb" solid>
    <BreadcrumbItem href="/" class="hover:text-blue-800" >
        <svelte:fragment slot="icon">
            <HomeOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>Collections
    </BreadcrumbItem>
    <BreadcrumbItem href="/portfolio/{walletIds[0]}" class="hover:text-blue-800">
        <svelte:fragment slot="icon">
            <ChevronDoubleRightOutline class="w-4 h-4 me-2 inline" />
          </svelte:fragment>Portfolio (<A href="https://voi.observer/explorer/account/{walletIds[0]}" target="_blank">{walletNFD??formattedWallet}</A>)
    </BreadcrumbItem>
</Breadcrumb>
<div class="text-center">
    <Tabs style="underline" defaultClass="flex rounded-lg divide-x rtl:divide-x-reverse divide-gray-200 shadow dark:divide-gray-700 justify-center">
        <TabItem open>
            <div slot="title">
                <div class="inline">Portfolio</div>
                <Indicator color="blue" size="xl" class="text-xs font-bold text-white">{tokens.length}</Indicator>
            </div>
            <div class="m-4">
                {#each tokens as token}
                    <div class="m-4">
                        <TokenComponent token={token}></TokenComponent>
                    </div>
                {/each}
                {#if tokens.length == 0}
                    <div class="text-2xl font-bold">No tokens found! Want to get some? <A href="https://nautilus.sh/" target="_blank">Check out the ARC-72 Marketplace</A></div>
                {/if}
            </div>
        </TabItem>
        <TabItem>
            <div slot="title">
                <div class="inline">Approvals</div>
                <Indicator color="blue" size="xl" class="text-xs font-bold text-white">{approvals.length}</Indicator>
            </div>
            <div class="m-4">
                {#each approvals as token}
                    <div class="m-4">
                        <TokenComponent token={token}></TokenComponent>
                    </div>
                {/each}
                {#if approvals.length == 0}
                    <div class="text-2xl font-bold">No approvals found.</div>
                {/if}
            </div>
        </TabItem>
        <TabItem>
            <div slot="title">
                <div class="inline">Manage</div>
                <Indicator class="invisible" size="xl">&nbsp;</Indicator>
            </div>
            <div class="m-4">
                <div class="text-2xl font-bold">Coming soon!</div>
            </div>
        </TabItem>
    </Tabs>
</div>