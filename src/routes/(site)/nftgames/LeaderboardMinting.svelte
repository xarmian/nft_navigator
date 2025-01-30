<script lang="ts">
	import type { Collection } from '$lib/data/types';
	import { getTransfers } from '$lib/utils/indexer';
	import { formatNumber } from '$lib/utils/format';
	import { onMount } from 'svelte';
	import { gameStats, mintingLeaderboard } from '../../../stores/gameStats';

	export let collections: Collection[] = [];
	export let startDate: Date;
	export let endDate: Date;

	let loading = true;

	// Convert dates to timestamps (in seconds)
	$: startTimestampNum = Math.floor(startDate.getTime() / 1000);
	$: endTimestampNum = Math.floor(endDate.getTime() / 1000);

	const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

	onMount(async () => {
		try {
			// Get all mints during game period in a single call
			const transfers = await getTransfers({ 
				fetch,
				minRound: "3865654",
				from: ZERO_ADDRESS
			});

			// Filter transfers that occurred during game period
			const gamePeriodMints = transfers.filter(transfer => 
				transfer.timestamp >= startTimestampNum && 
				transfer.timestamp <= endTimestampNum
			);

			// Update game stats with mint data
			gameStats.updateMintStats(collections, gamePeriodMints);
		} catch (error) {
			console.error('Error fetching mints:', error);
		}

		loading = false;
	});
</script>

<div class="space-y-4">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold">Collection Minting Leaderboard</h2>
		<div class="px-3 py-1 bg-green-500 text-white rounded-full text-sm">
			10% of Prize Pool
		</div>
	</div>

	{#if loading}
		<div class="text-center py-8">Loading minting data...</div>
	{:else if $mintingLeaderboard.length === 0}
		<div class="text-center py-8">No minting activity found during the game period.</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
				<thead>
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Collection</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" title="Number of NFTs minted during the game period">
							Game Mints
						</th>
						<th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" title="Total value of NFTs minted during the game period">
							Mint Value
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
					{#each $mintingLeaderboard as stats, i}
						{@const collection = collections.find(c => c.contractId === stats.contractId)}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
							<td class="px-6 py-4 whitespace-nowrap text-sm">
								<span class="font-bold {i < 3 ? ['text-yellow-500', 'text-gray-400', 'text-amber-600'][i] : 'text-gray-600'}">
									#{i + 1}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">
								<div class="flex flex-col">
									<div class="flex items-center space-x-2">
										<a href="/collection/{stats.contractId}" class="hover:text-blue-500">
											<span class="font-medium">
												{collection?.highforgeData?.title ?? collection?.gameData?.title ?? `Collection #${stats.contractId}`}
											</span>
										</a>
										<a href="/analytics/{stats.contractId}" class="text-xs text-gray-500 hover:text-blue-500">
											<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
												Analytics
											</span>
										</a>
									</div>
									{#if collection}
										<div class="text-xs text-gray-500 mt-1">
											Created by {collection.creatorName ?? 
												`${collection.creator.slice(0, 6)}...${collection.creator.slice(-4)}`}
										</div>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-right">
								{stats.mintCount}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
								{formatNumber(stats.totalValue)} VOI
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-center text-sm text-gray-500 mt-4">
			Top 25 collections will be entered into raffle for prizes
		</p>
	{/if}
</div> 