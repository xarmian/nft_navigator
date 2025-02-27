<script lang="ts">
	import type { Collection, Sale } from '$lib/data/types';
	import { formatNumber } from '$lib/utils/format';
	import { algodClient } from '$lib/utils/algod';
	import { onMount } from 'svelte';

	export let totalVolume: number;
	export let totalParticipants: number;
	export let collections: Collection[];
	export let sales: Sale[];
	export let startDate: Date;
	export let endDate: Date;
	export let activeTab: number;

	const VOI_DECIMALS = 6;
	const VOI_FACTOR = Math.pow(10, VOI_DECIMALS);

	let poolBalance = 0;
	
	onMount(async () => {
		try {
			const poolAddress1 = 'GAMESB74MIL32A5FZTS2F4YYDGG6YQKBO6TDG6PHITCIIVQAA77GE253CQ';
			const poolAddress2 = 'JFHP4IL4D3I4FDQFWGFDMCZLFSLGQAL4OZGQQKTPEE4SSW6JXSYQPZY2PM';
			const poolAccount1 = await algodClient.accountInformation(poolAddress1).do();
			const poolAccount2 = await algodClient.accountInformation(poolAddress2).do();
			poolBalance = poolAccount1.amount + (poolAccount2.amount * .667);
		} catch (error) {
			console.error('Error fetching pool balance:', error);
		}
	});

	// Check if game has started
	$: now = new Date();
	$: isGameStarted = now >= startDate;

	// Calculate statistics
	$: averagePrice = sales.length > 0 ? totalVolume / sales.length / VOI_FACTOR : 0;
	$: uniqueBuyers = new Set(sales.map(s => s.buyer)).size;
	$: uniqueSellers = new Set(sales.map(s => s.seller)).size;
	$: uniqueCreators = new Set(collections.map(c => c.creator)).size;
	$: participatingCollections = collections.length;

	// Calculate additional statistics
	// $: prizePool = (totalVolume / VOI_FACTOR) * 0.1; // 10% of volume
	$: prizePool = poolBalance / VOI_FACTOR;
	$: matchedPool = Math.min(prizePool, 50_000_000); // Max 50M VOI match
	$: totalPool = prizePool + matchedPool;

	// Prize pool distribution
	$: traderPool = totalPool * 0.85;
	$: creatorPool = totalPool * 0.15;

	// Calculate individual category pools
	$: volumePool = totalPool * 0.425;
	$: profitPool = totalPool * 0.425;
	$: mintingPool = totalPool * 0.10;
	$: socialPool = totalPool * 0.05;

	// Progress towards 1M VOI goal
	$: poolProgress = (totalPool / 3_000_000) * 100;
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
	<h2 class="text-2xl font-bold mb-4">Game Statistics</h2>
	<div class="space-y-6">
		<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
			<h3 class="text-xl font-semibold mb-2">Prize Pool Progress</h3>
			{#if isGameStarted}
				<p class="text-lg mb-2">
					<span class="font-bold">{formatNumber(totalPool)} VOI</span>
					<span class="text-sm opacity-75"> of 3M goal</span>
				</p>
				
				<!-- Custom Progress Bar -->
				<div class="h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
					<div 
						class="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500"
						style="width: {Math.min(poolProgress, 100)}%"
					></div>
				</div>
				
				<div class="grid grid-cols-2 gap-4 mt-4 text-sm">
					<div>
						<p>From Fees:</p>
						<p class="font-bold">{formatNumber(prizePool)} VOI</p>
					</div>
					<div>
						<p>Foundation Match:</p>
						<p class="font-bold">{formatNumber(matchedPool)} VOI</p>
					</div>
				</div>
			{:else}
				<div class="text-center py-4">
					<p class="text-sm text-gray-500 mb-2">The prize pool will be funded by:</p>
					<ul class="list-disc list-inside space-y-2 text-sm">
						<li>10% fee from all NFT trades during the games</li>
						<li>Foundation match up to 50M VOI</li>
					</ul>
				</div>
			{/if}
		</div>

		<!-- Prize Pool Distribution -->
		<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
			<h4 class="text-lg font-semibold mb-4">Prize Distribution</h4>
			{#if isGameStarted}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div class="space-y-4">
						<button 
							class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors duration-200 w-full"
							on:click={() => activeTab = 1}
						>
							<h5 class="font-semibold text-blue-500 mb-2">Volume Trading</h5>
							<p class="text-2xl font-bold">{formatNumber(volumePool)} VOI</p>
							<p class="text-sm opacity-75">42.5% of total pool</p>
						</button>
						<button 
							class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors duration-200 w-full"
							on:click={() => activeTab = 2}
						>
							<h5 class="font-semibold text-green-500 mb-2">Profit Trading</h5>
							<p class="text-2xl font-bold">{formatNumber(profitPool)} VOI</p>
							<p class="text-sm opacity-75">42.5% of total pool</p>
						</button>
					</div>
					<div class="space-y-4">
						<button 
							class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors duration-200 w-full"
							on:click={() => activeTab = 3}
						>
							<h5 class="font-semibold text-amber-500 mb-2">Minting</h5>
							<p class="text-2xl font-bold">{formatNumber(mintingPool)} VOI</p>
							<p class="text-sm opacity-75">10% of total pool</p>
						</button>
						<button 
							class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors duration-200 w-full"
							on:click={() => activeTab = 4}
						>
							<h5 class="font-semibold text-pink-500 mb-2">Social Media</h5>
							<p class="text-2xl font-bold">{formatNumber(socialPool)} VOI</p>
							<p class="text-sm opacity-75">5% of total pool</p>
						</button>
					</div>
				</div>
			{:else}
				<div class="space-y-4">
					<div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
						<h5 class="font-semibold text-blue-500">Trading Rewards (85%)</h5>
						<ul class="mt-2 space-y-2 text-sm">
							<li>• Volume Trading: 42.5% of pool</li>
							<li>• Profit Trading: 42.5% of pool</li>
							<li class="text-gray-500 mt-1">Rewards based on your trading activity during the games</li>
						</ul>
					</div>
					<div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
						<h5 class="font-semibold text-amber-500">Creator Rewards (15%)</h5>
						<ul class="mt-2 space-y-2 text-sm">
							<li>• Minting: 10% of pool</li>
							<li>• Social Media: 5% of pool</li>
							<li class="text-gray-500 mt-1">Rewards for collection creators and social engagement</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
				<h4 class="text-lg font-semibold mb-2">Trading Activity</h4>
				{#if isGameStarted}
					<ul class="space-y-2">
						<li>
							<span class="opacity-75">Avg Price:</span>
							<br />
							<span class="font-bold">{formatNumber(averagePrice)} VOI</span>
						</li>
						<li>
							<span class="opacity-75">Total Sales:</span>
							<br />
							<span class="font-bold">{sales.length}</span>
						</li>
					</ul>
				{:else}
					<div class="text-center py-2">
						<p class="text-sm text-gray-500">Will track all NFT sales and average prices during the games</p>
					</div>
				{/if}
			</div>

			<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
				<h4 class="text-lg font-semibold mb-2">Participants</h4>
				{#if isGameStarted}
					<ul class="space-y-2">
						<li>
							<span class="opacity-75">Unique Buyers:</span>
							<br />
							<span class="font-bold">{uniqueBuyers}</span>
						</li>
						<li>
							<span class="opacity-75">Unique Sellers:</span>
							<br />
							<span class="font-bold">{uniqueSellers}</span>
						</li>
						<li>
							<span class="opacity-75">Unique Creators:</span>
							<br />
							<span class="font-bold">{uniqueCreators}</span>
						</li>
					</ul>
				{:else}
					<div class="text-center py-2">
						<p class="text-sm text-gray-500">Will track unique buyers and sellers participating in the games</p>
					</div>
				{/if}
			</div>
		</div>

		<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
			<h4 class="text-lg font-semibold mb-2">Collections</h4>
			{#if isGameStarted}
				<ul class="space-y-2">
					<li>
						<span class="opacity-75">Eligible Collections:</span>
						<br />
						<span class="font-bold">{participatingCollections}</span>
					</li>
					<li>
						<span class="opacity-75">Total NFTs Minted:</span>
						<br />
						<span class="font-bold">
							{formatNumber(collections.reduce((acc, c) => acc + c.totalSupply, 0))}
						</span>
					</li>
				</ul>
			{:else}
				<div class="text-center py-2">
					<p class="text-sm text-gray-500">Will track collections and total NFTs minted during the games</p>
				</div>
			{/if}
		</div>
	</div>
</div> 