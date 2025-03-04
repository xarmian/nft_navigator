<script lang="ts">
	import type { Sale } from '$lib/data/types';
	import { formatNumber } from '$lib/utils/format';
	import { getNFD } from '$lib/utils/nfd';
	import { onMount } from 'svelte';
	import SpinWheel from './SpinWheel.svelte';
	import Raffle from './Raffle.svelte';
	import type { ProfitEntry, BaseLeaderboardEntry } from './types';

	export let sales: Sale[];
	export let showDrawing: boolean;
	//export let startDate: Date;
	//export let endDate: Date;

	const VOI_DECIMALS = 6;
	const VOI_FACTOR = Math.pow(10, VOI_DECIMALS);
	const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

	let profitLeaderboard: ProfitEntry[] = [];
	let loading = true;
	let showSpinWheel = false;
	let showRaffle = false;
	let selectedWinners: ProfitEntry[] = [];
	let drawingMethod: 'wheel' | 'raffle' = 'raffle';

	interface TokenBasePrices {
		[key: string]: number; // contractId_tokenId -> base price
	}

	onMount(async () => {
		// Track base prices for each token
		const baseTokenPrices: TokenBasePrices = {};
		const profitMap = new Map<string, ProfitEntry>();

		// Sort sales by timestamp to process in chronological order
		const sortedSales = [...sales].sort((a, b) => a.timestamp - b.timestamp);

		sortedSales.forEach(sale => {
			const tokenKey = `${sale.collectionId}_${sale.tokenId}`;
			const adjustedPrice = sale.price / VOI_FACTOR;
			
			// Initialize seller's profit entry if not exists
			if (!profitMap.has(sale.seller)) {
				profitMap.set(sale.seller, {
					address: sale.seller,
					nfd: null,
					totalProfit: 0,
					profitableTrades: 0,
					totalTrades: 0
				});
			}

			const sellerEntry = profitMap.get(sale.seller)!;
			sellerEntry.totalTrades += 1;

			const profit = adjustedPrice - (baseTokenPrices[tokenKey] || 0);
			if (profit > 0) {
				sellerEntry.totalProfit += profit;
				sellerEntry.profitableTrades += 1;
			}

			// Update base price (always increases)
			if (!baseTokenPrices[tokenKey] || adjustedPrice > baseTokenPrices[tokenKey]) {
				baseTokenPrices[tokenKey] = adjustedPrice;
			}
		});

		// Convert to array and sort by total profit
		profitLeaderboard = Array.from(profitMap.values())
			.filter(entry => entry.address !== ZERO_ADDRESS) // Exclude zero address
			.sort((a, b) => b.totalProfit - a.totalProfit)
			.slice(0, 50); // Top 50 traders

		// Resolve NFDs for addresses
		const addresses = profitLeaderboard.map(entry => entry.address);
		const nfdResults = await getNFD(addresses);
		
		profitLeaderboard.forEach(entry => {
			const nfdResult = nfdResults.find(n => n.key === entry.address);
			if (nfdResult) {
				entry.nfd = nfdResult;
			}
		});

		// Get top 25 for prize drawing
		selectedWinners = profitLeaderboard.slice(0, 25);

		loading = false;
	});

	function getPositionClass(index: number): string {
		if (index === 0) return 'text-yellow-500';
		if (index === 1) return 'text-gray-400';
		if (index === 2) return 'text-amber-600';
		return 'text-gray-600';
	}

	function calculateSuccessRate(entry: ProfitEntry): string {
		return ((entry.profitableTrades / entry.totalTrades) * 100).toFixed(1);
	}

	function downloadCSV() {
		const csvContent = profitLeaderboard.map((entry, index) => {
			const position = index + 1;
			const address = entry.address;
			const name = entry.nfd ? entry.nfd.replacementValue : address;
			const volume = Math.round(entry.totalProfit);
			
			return `${position},"${address}","${name}",${volume}`;
		}).join('\n');

		const header = 'Position,Address,Name,Volume (VOI)\n';
		const blob = new Blob([header + csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.setAttribute('href', url);
		a.setAttribute('download', 'leaderboard.csv');
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		window.URL.revokeObjectURL(url);
	}

	function openDrawing() {
		if (drawingMethod === 'wheel') {
			showSpinWheel = true;
		} else {
			showRaffle = true;
		}
	}

	function closeSpinWheel() {
		showSpinWheel = false;
	}

	function closeRaffle() {
		showRaffle = false;
	}

	function handleWinner(event: CustomEvent<{winner: BaseLeaderboardEntry}>) {
		console.log('Winner selected:', event.detail.winner as ProfitEntry);
		// You could save this winner, display it prominently, etc.
	}
</script>

<div class="space-y-4">
	<div class="flex justify-between items-center">
		<h2 class="text-2xl font-bold">Profit Leaderboard</h2>
		<div class="flex gap-4 items-center">
			{#if showDrawing}
				<button 
					on:click={downloadCSV}
					class="px-3 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
					disabled={loading}
				>
					Download CSV
				</button>
			
				<div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-1">
					<button 
						class="px-3 py-1 rounded-full text-sm {drawingMethod === 'wheel' ? 'bg-green-500 text-white' : 'text-gray-600 dark:text-gray-300'}"
						on:click={() => drawingMethod = 'wheel'}
					>
						<i class="fas fa-sync mr-1"></i> Wheel
					</button>
					<button 
						class="px-3 py-1 rounded-full text-sm {drawingMethod === 'raffle' ? 'bg-green-500 text-white' : 'text-gray-600 dark:text-gray-300'}"
						on:click={() => drawingMethod = 'raffle'}
					>
						<i class="fas fa-ticket-alt mr-1"></i> Raffle
					</button>
				</div>
				
				<button 
					on:click={openDrawing}
					class="px-3 py-1 bg-green-500 text-white rounded-full text-sm hover:bg-green-600 transition-colors"
					disabled={loading || selectedWinners.length === 0}
				>
					<i class="fas fa-random mr-1"></i> Draw Winner
				</button>
			{/if}
			<div class="px-3 py-1 bg-green-500 text-white rounded-full text-sm">
				42.5% of Prize Pool
			</div>
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
						<th class="text-right p-2">Total Profit</th>
						<th class="text-right p-2">Success Rate</th>
					</tr>
				</thead>
				<tbody>
					{#each profitLeaderboard as entry, i}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="p-2">
								<span class="font-bold {getPositionClass(i)}">
									#{i + 1}
								</span>
							</td>
							<td class="p-2">
								<a class="flex items-center gap-2 hover:underline" href={`/portfolio/${entry.address}`}>
									{#if entry.nfd}
										{#if entry.nfd.avatar}
											<img src={entry.nfd.avatar} alt={entry.nfd.replacementValue} class="w-10 h-10 rounded-full" />
										{:else}
											<img src="/blank_avatar_small.png" alt={entry.address} class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50" />
										{/if}
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
								{formatNumber(entry.totalProfit)} VOI
							</td>
							<td class="text-right p-2">
								<div class="flex flex-col items-end">
									<span class="font-medium">{calculateSuccessRate(entry)}%</span>
									<span class="text-xs opacity-75">
										{entry.profitableTrades}/{entry.totalTrades} trades
									</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-center text-sm opacity-75 mt-4">
			Top 25 traders will be entered into drawing for profit category prizes.
			<button 
				on:click={openDrawing}
				class="text-green-500 hover:text-green-600 hover:underline"
			>
				Click here to draw the winners using {drawingMethod === 'wheel' ? 'the wheel' : 'a raffle'}.
			</button>
		</p>
	{/if}
</div> 

{#if showSpinWheel}
	<SpinWheel 
		entries={selectedWinners} 
		valueProperty="totalProfit" 
		colorScheme="green"
		on:close={closeSpinWheel}
		on:winner={handleWinner}
	/>
{/if}

{#if showRaffle}
	<Raffle 
		entries={selectedWinners} 
		valueProperty="totalProfit" 
		colorScheme="green"
		on:close={closeRaffle}
		on:winner={handleWinner}
	/>
{/if} 