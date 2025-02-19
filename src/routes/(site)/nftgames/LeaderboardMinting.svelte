<script lang="ts">
	import type { Collection } from '$lib/data/types';
	import { getTransfers } from '$lib/utils/indexer';
	import { formatNumber } from '$lib/utils/format';
	import { onMount } from 'svelte';
	import { gameStats, mintingLeaderboard } from '../../../stores/gameStats';
	import { getImageUrl } from '$lib/utils/functions';

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
				minRound: "4801760",
				from: ZERO_ADDRESS
			});

			// Filter transfers that occurred during game period
			let gamePeriodMints = transfers.filter(transfer =>  {
				const c = collections.find(c => c.contractId === transfer.contractId);
				return transfer.timestamp >= startTimestampNum && 
				transfer.timestamp <= endTimestampNum &&
				c?.creator !== transfer.to;
			});

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
		<div class="px-3 py-1 bg-amber-500 text-white rounded-full text-sm">
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
								<div class="flex items-center space-x-3">
									{#if collection?.highforgeData?.coverImageURL}
										<a href="/collection/{stats.contractId}">
											<img src={getImageUrl(collection?.highforgeData?.coverImageURL)} alt={collection?.highforgeData?.title} class="w-10 h-10 rounded-full" />
										</a>
									{:else}
										<img src="/blank_avatar_small.png" alt={collection?.highforgeData?.title ?? collection?.gameData?.title ?? `Collection #${stats.contractId}`} class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50" />
									{/if}
									<div class="flex flex-col w-full">
										<div class="flex flex-wrap items-center gap-2 justify-between">
											<div class="flex items-center space-x-2 min-w-[200px]">
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
											{#if collection?.globalState}
												{@const totalMinted = Number(collection.globalState.find((gs) => gs.key === 'totalMinted')?.value) || 0}
												{@const maxSupply = Number(collection.globalState.find((gs) => gs.key === 'maxSupply')?.value) || 0}
												{@const launchStart = Number(collection.globalState.find((gs) => gs.key === 'launchStart')?.value) || 0}
												{@const launchEnd = Number(collection.globalState.find((gs) => gs.key === 'launchEnd')?.value) || 0}
												{@const currentTime = Math.floor(Date.now() / 1000)}
												{@const isMintable = maxSupply > 0 && totalMinted < maxSupply && 
													(launchStart === 0 || currentTime >= launchStart) && 
													(launchEnd === 0 || currentTime <= launchEnd)}
												{#if isMintable}
													<a href="https://highforge.io/project/{stats.contractId}" 
														target="_blank" 
														class="group relative flex items-center gap-3 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full px-3 py-1"
														aria-label="Mint and View on Highforge">
														<div class="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
															Mint and View on Highforge
														</div>
														<div class="flex items-center gap-2 bg-green-500/10 rounded-full px-3 py-1">
															<i class="fas fa-fire text-green-500"></i>
															<span class="text-green-600 dark:text-green-400 font-medium">Minting</span>
														</div>
														<div class="flex items-center gap-2">
															<div class="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
																<div class="bg-green-500 h-1.5 rounded-full" style="width: {(totalMinted / maxSupply * 100)}%"></div>
															</div>
															<span class="text-gray-500 whitespace-nowrap">{totalMinted}/{maxSupply}</span>
														</div>
														{#if collection.globalState.find((gs) => gs.key === 'price')?.value}
															<div class="text-gray-500 whitespace-nowrap">
																<span class="font-medium">{(Number(collection.globalState.find((gs) => gs.key === 'price')?.value) / Math.pow(10, 6)).toLocaleString()} VOI</span>
															</div>
														{/if}
													</a>
												{/if}
											{/if}
										</div>
										{#if collection}
											<div class="text-xs text-gray-500 mt-1">
												Created by {collection.creatorName ?? 
													`${collection.creator.slice(0, 6)}...${collection.creator.slice(-4)}`}
											</div>
										{/if}
									</div>
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

		<p class="text-center text-sm text-gray-500 mt-4 hidden">
			Top 25 collections will be entered into raffle for prizes
		</p>
	{/if}
</div> 