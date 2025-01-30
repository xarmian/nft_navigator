<script lang="ts">
	import type { Collection, Sale } from '$lib/data/types';
	import { formatNumber } from '$lib/utils/format';

	export let totalVolume: number;
	export let totalParticipants: number;
	export let collections: Collection[];
	export let sales: Sale[];
	export let startDate: Date;
	export let endDate: Date;

	const VOI_DECIMALS = 6;
	const VOI_FACTOR = Math.pow(10, VOI_DECIMALS);

	// Calculate statistics
	$: averagePrice = sales.length > 0 ? totalVolume / sales.length / VOI_FACTOR : 0;
	$: uniqueBuyers = new Set(sales.map(s => s.buyer)).size;
	$: uniqueSellers = new Set(sales.map(s => s.seller)).size;
	$: participatingCollections = collections.length;

	// Calculate additional statistics
	$: prizePool = (totalVolume / VOI_FACTOR) * 0.1; // 10% of volume
	$: matchedPool = Math.min(prizePool, 50_000_000); // Max 50M VOI match
	$: totalPool = prizePool + matchedPool;

	// Prize pool distribution
	$: traderPool = totalPool * 0.85;
	$: creatorPool = totalPool * 0.15;

	// Progress towards 100M VOI goal
	$: poolProgress = (totalPool / 100_000_000) * 100;
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
	<h2 class="text-2xl font-bold mb-4">Game Statistics</h2>
	<div class="space-y-6">
		<div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
			<h3 class="text-xl font-semibold mb-2">Prize Pool Progress</h3>
			<p class="text-lg mb-2">
				<span class="font-bold">{formatNumber(totalPool)} VOI</span>
				<span class="text-sm opacity-75"> of 100M goal</span>
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
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
				<h4 class="text-lg font-semibold mb-2">Trading Activity</h4>
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
			</div>

			<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
				<h4 class="text-lg font-semibold mb-2">Participants</h4>
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
				</ul>
			</div>
		</div>

		<div class="bg-white dark:bg-gray-700 rounded-lg p-4 shadow">
			<h4 class="text-lg font-semibold mb-2">Collections</h4>
			<ul class="space-y-2">
				<li>
					<span class="opacity-75">Participating Collections:</span>
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
		</div>
	</div>
</div> 