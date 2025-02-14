<script lang="ts">
	import type { Sale } from '$lib/data/types';
	import { formatNumber } from '$lib/utils/format';
	import { getNFD } from '$lib/utils/nfd';
	import type { AggregatedNFD } from '$lib/utils/nfd';
	import { onMount } from 'svelte';

	export let sales: Sale[];
	export let startDate: Date;
	export let endDate: Date;

	const VOI_DECIMALS = 6;
	const VOI_FACTOR = Math.pow(10, VOI_DECIMALS);
	const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

	interface VolumeEntry {
		address: string;
		nfd: AggregatedNFD | null;
		volume: number;
		transactions: number;
	}

	let volumeLeaderboard: VolumeEntry[] = [];
	let loading = true;

	onMount(async () => {
		console.log('Total sales received:', sales.length);
		console.log('Sample of first few sales:', sales.slice(0, 3));

		// Calculate volume per address (combining buyer and seller volumes)
		const volumeMap = new Map<string, VolumeEntry>();

		let mintCount = 0;
		let secondarySaleCount = 0;

		sales.forEach(sale => {
			const adjustedPrice = sale.price / VOI_FACTOR;
			
			// For mints (seller is zero address), only buyer gets volume points
			if (sale.seller === ZERO_ADDRESS) {
				mintCount++;
				console.log('Found mint:', {
					buyer: sale.buyer,
					price: adjustedPrice,
					timestamp: new Date(sale.timestamp * 1000)
				});

				if (!volumeMap.has(sale.buyer)) {
					volumeMap.set(sale.buyer, {
						address: sale.buyer,
						nfd: null,
						volume: 0,
						transactions: 0
					});
				}
				const buyerEntry = volumeMap.get(sale.buyer)!;
				buyerEntry.volume += adjustedPrice;
				buyerEntry.transactions += 1;
			} else {
				secondarySaleCount++;
				// For secondary sales, both buyer and seller get volume points
				// Add buyer volume
				if (!volumeMap.has(sale.buyer)) {
					volumeMap.set(sale.buyer, {
						address: sale.buyer,
						nfd: null,
						volume: 0,
						transactions: 0
					});
				}
				const buyerEntry = volumeMap.get(sale.buyer)!;
				buyerEntry.volume += adjustedPrice;
				buyerEntry.transactions += 1;

				// Add seller volume
				if (!volumeMap.has(sale.seller)) {
					volumeMap.set(sale.seller, {
						address: sale.seller,
						nfd: null,
						volume: 0,
						transactions: 0
					});
				}
				const sellerEntry = volumeMap.get(sale.seller)!;
				sellerEntry.volume += adjustedPrice;
				sellerEntry.transactions += 1;
			}
		});

		console.log('Transaction breakdown:', {
			mints: mintCount,
			secondarySales: secondarySaleCount,
			total: mintCount + secondarySaleCount
		});

		// Convert to array and sort by volume
		volumeLeaderboard = Array.from(volumeMap.values())
			.filter(entry => entry.address !== ZERO_ADDRESS) // Exclude zero address
			.sort((a, b) => b.volume - a.volume)
			.slice(0, 50); // Top 50 traders

		console.log('Top 3 volume leaders:', volumeLeaderboard.slice(0, 3));

		// Resolve NFDs for addresses
		const addresses = volumeLeaderboard.map(entry => entry.address);
		const nfdResults = await getNFD(addresses);
		
		volumeLeaderboard.forEach(entry => {
			const nfdResult = nfdResults.find(n => n.key === entry.address);
			if (nfdResult) {
				entry.nfd = nfdResult;
			}
		});

		loading = false;
	});

	function getPositionClass(index: number): string {
		if (index === 0) return 'text-yellow-500';
		if (index === 1) return 'text-gray-400';
		if (index === 2) return 'text-amber-600';
		return 'text-gray-600';
	}
</script>

<div class="space-y-4">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold">Volume Leaderboard</h2>
		<div class="px-3 py-1 bg-blue-500 text-white rounded-full text-sm">
			42.5% of Prize Pool
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center p-4">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
			<table class="w-full">
				<thead>
					<tr>
						<th class="w-16 text-left p-2">Rank</th>
						<th class="text-left p-2">Trader</th>
						<th class="text-right p-2">Volume</th>
						<th class="text-right p-2">Trades</th>
					</tr>
				</thead>
				<tbody>
					{#each volumeLeaderboard as entry, i}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="p-2">
								<span class="font-bold {getPositionClass(i)}">
									#{i + 1}
								</span>
							</td>
							<td class="p-2">
								<a class="flex items-center gap-2 hover:underline" href={`/portfolio/${entry.address}`}>
									{#if entry.nfd}
										<img src={entry.nfd.avatar} alt={entry.nfd.replacementValue} class="w-10 h-10 rounded-full" />
										<span class="font-medium">{entry.nfd.replacementValue}</span>
									{:else}
										<img src="/blank_avatar_small.png" alt={entry.address} class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50" />
										<span class="font-mono text-sm">
											<span class="hidden md:inline">{entry.address.slice(0, 12)}...{entry.address.slice(-12)}</span>
											<span class="inline md:hidden">{entry.address.slice(0, 4)}...{entry.address.slice(-4)}</span>
										</span>
									{/if}
								</a>
							</td>
							<td class="text-right p-2 font-medium">
								{formatNumber(entry.volume)} VOI
							</td>
							<td class="text-right p-2 text-sm opacity-75">
								{entry.transactions}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-center text-sm opacity-75 hidden">
			Top 25 traders will be entered into raffle for prizes
		</p>
	{/if}
</div> 