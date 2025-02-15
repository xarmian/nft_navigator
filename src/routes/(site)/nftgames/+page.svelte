<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getCollections, getSales, getTransfers, getSalesAndTransfers } from '$lib/utils/indexer';
	import type { Collection, Sale, Transfer } from '$lib/data/types';
	import { formatNumber } from '$lib/utils/format';
	import LeaderboardVolume from './LeaderboardVolume.svelte';
	import LeaderboardProfit from './LeaderboardProfit.svelte';
	import LeaderboardMinting from './LeaderboardMinting.svelte';
	import LeaderboardSocial from './LeaderboardSocial.svelte';
	import RulesExplainer from './RulesExplainer.svelte';
	import GameStats from './GameStats.svelte';
	import DynamicBanner from './DynamicBanner.svelte';

	const VOI_DECIMALS = 6;
	const VOI_FACTOR = Math.pow(10, VOI_DECIMALS);

	export let data;
	const startDate = new Date(data.startDate);
	const endDate = new Date(data.endDate);

	const startTimestamp = startDate.getTime();
	const endTimestamp = endDate.getTime();

	let activeTab = 0;
	let collections: Collection[] = [];
	let allSales: Sale[] = [];
	let gameSales: Sale[] = [];
	let loading = true;
	let totalVolume = 0;
	let totalParticipants = 0;
	let totalMintVolume = 0;
	let totalMints = 0;

	const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

	onMount(async () => {
		try {
			collections = await getCollections({ fetch });
			allSales = await getSales({ 
				fetch,
				sortBy: 'timestamp',
				limit: 10000, // Increased limit to ensure we get all game period sales
				minTime: Math.floor(startTimestamp / 1000), // Convert milliseconds to seconds
				maxTime: Math.floor(endTimestamp / 1000)
			});

			// Get all mints during game period
			const transfers = await getTransfers({ 
				fetch,
				from: ZERO_ADDRESS,
				minRound: "4801760"
			});

			// Filter transfers that occurred during game period
			let gamePeriodMints = transfers.filter(transfer => {
				const transferTime = transfer.timestamp;
				return transferTime >= startTimestamp / 1000 && transferTime <= endTimestamp / 1000;
			});

			// Calculate mint volume using collection pricing and convert mints to sales format
			totalMints = gamePeriodMints.length;
			totalMintVolume = 0;
			const mintSales: Sale[] = [];

			for (const transfer of gamePeriodMints) {
				const collection = collections.find(c => c.contractId === transfer.contractId);
				if (collection?.creator === transfer.to) {
					// remove from gamePeriodMints
					gamePeriodMints = gamePeriodMints.filter(m => m.transactionId !== transfer.transactionId);
					continue;
				}

				const globalState = collection?.globalState;
				if (!globalState) continue;

				const getValue = (key: string): number => {
					const value = globalState.find(gs => gs.key === key)?.value;
					return value ? Number(value) : 0;
				};

				const pricing = {
					wlPrice: getValue('wlPrice'),
					publicPrice: getValue('price'),
					launchStart: getValue('launchStart'),
					wlLaunchStart: getValue('wlLaunchStart')
				};

				// Determine price based on timestamp
				let price = pricing.publicPrice;
				if (transfer.timestamp < pricing.launchStart && transfer.timestamp >= pricing.wlLaunchStart) {
					price = pricing.wlPrice;
				}

				totalMintVolume += price;

				// Convert mint transfer to sale format
				mintSales.push({
					transactionId: transfer.transactionId,
					seller: ZERO_ADDRESS,
					buyer: transfer.to,
					price: price,
					currency: 0, // VOI
					timestamp: transfer.timestamp,
					tokenId: transfer.tokenId,
					collectionId: transfer.contractId,
					round: transfer.round,
					listing: null as any // Not needed for mints
				});
			}

			// Get all secondary market sales during game period
			gameSales = [...allSales, ...mintSales];

			// Calculate total volume from all sales plus mint volume
			const secondaryVolume = allSales.reduce((acc, sale) => acc + sale.price, 0);
			totalVolume = secondaryVolume + totalMintVolume;

			// Calculate participants (include both traders and minters)
			const participants = new Set([
				...gameSales.map(s => s.buyer),
				...gameSales.map(s => s.seller),
				...gamePeriodMints.map(m => m.to) // Add minters to participants
			]);
			totalParticipants = participants.size;
		} catch (error) {
			console.error('Error loading game data:', error);
		} finally {
			loading = false;
		}
	});

	const tabSet = [
		{ name: 'Overview', icon: 'info-circle' },
		{ name: 'Volume', icon: 'chart-line' },
		{ name: 'Profit', icon: 'chart-bar' },
		{ name: 'Minting', icon: 'plus-circle' },
		{ name: 'Social', icon: 'share-nodes' }
	];

	// Calculate time remaining
	$: now = new Date();
	$: nowTimestamp = now.getTime();
	$: isGameActive = nowTimestamp >= startTimestamp && nowTimestamp <= endTimestamp;
	$: isGamePending = nowTimestamp < startTimestamp;
	$: timeRemaining = isGamePending 
		? startTimestamp - nowTimestamp
		: isGameActive 
			? endTimestamp - nowTimestamp
			: 0;
	$: daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

	// Countdown timer state
	let countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
	let countdownInterval: ReturnType<typeof setInterval>;

	// Update countdown every second when game is pending
	onMount(() => {
		if (isGamePending) {
			updateCountdown();
			countdownInterval = setInterval(updateCountdown, 1000);
		}
		return () => {
			if (countdownInterval) clearInterval(countdownInterval);
		};
	});

	function updateCountdown() {
		const now = new Date();
		const nowTimestamp = now.getTime();
		const diff = startTimestamp - nowTimestamp;
		
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		
		countdown = { days, hours, minutes, seconds };
	}

	// Format date with timezone
	function formatLocalDate(date: Date) {
		const options: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			timeZoneName: 'short'
		};
		return new Intl.DateTimeFormat(undefined, options).format(date);
	}
</script>

<div class="min-h-screen bg-gray-100 dark:bg-gray-900 w-screen overflow-x-hidden">
	<!-- Dynamic Banner -->
	<div class="w-full">
		<DynamicBanner {collections} />
	</div>

	<div class="container mx-auto px-2 sm:px-4 space-y-4 mb-12">
		<div class="text-center relative z-0 -mb-10">
			<div class="inline-block px-8 py-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg transform -translate-y-20">
				<h1 class="text-4xl font-bold mb-4 flex items-center">
					<i class="fas fa-trophy mr-2 text-yellow-500"></i>
					VOI NFT Winter Games 2025
					<i class="fas fa-trophy ml-2 text-yellow-500"></i>
				</h1>
				{#if isGameActive}
					<p class="text-lg">
						{#if loading}
							Loading game statistics...
						{:else}
							<span class="font-bold">{formatNumber(totalVolume / VOI_FACTOR)} VOI</span> total volume • 
							<span class="font-bold">{totalParticipants}</span> participants • 
							<span class="font-bold">{totalMints}</span> mints
						{/if}
					</p>
				{/if}
				<div class="flex justify-center gap-4 mt-2">
					<div 
						class="px-3 py-1 bg-blue-500 text-white rounded-full text-sm relative group cursor-help"
					>
						<span>Starts: {startDate.toUTCString().replace('GMT', 'UTC')}</span>
						<div class="absolute left-1/2 -translate-x-1/2 -bottom-14 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
							Your time: {formatLocalDate(startDate)}
						</div>
					</div>
					<div 
						class="px-3 py-1 bg-purple-500 text-white rounded-full text-sm relative group cursor-help"
					>
						<span>Ends: {endDate.toUTCString().replace('GMT', 'UTC')}</span>
						<div class="absolute left-1/2 -translate-x-1/2 -bottom-14 bg-gray-900 text-white px-4 py-2 rounded shadow-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
							Your time: {formatLocalDate(endDate)}
						</div>
					</div>
				</div>
				{#if isGameActive}
					<div class="mt-2 text-sm text-green-500 font-medium">
						Game in Progress • {daysRemaining} days remaining
					</div>
				{:else if isGamePending}
					<div class="mt-4 text-center">
						<div class="text-lg text-yellow-500 font-bold mb-2">
							Game Starts In
						</div>
						<div class="flex justify-center gap-4">
							<div class="text-center">
								<div class="text-3xl font-bold">{countdown.days}</div>
								<div class="text-xs text-gray-500 uppercase">Days</div>
							</div>
							<div class="text-3xl font-bold">:</div>
							<div class="text-center">
								<div class="text-3xl font-bold">{countdown.hours.toString().padStart(2, '0')}</div>
								<div class="text-xs text-gray-500 uppercase">Hours</div>
							</div>
							<div class="text-3xl font-bold">:</div>
							<div class="text-center">
								<div class="text-3xl font-bold">{countdown.minutes.toString().padStart(2, '0')}</div>
								<div class="text-xs text-gray-500 uppercase">Minutes</div>
							</div>
							<div class="text-3xl font-bold">:</div>
							<div class="text-center">
								<div class="text-3xl font-bold">{countdown.seconds.toString().padStart(2, '0')}</div>
								<div class="text-xs text-gray-500 uppercase">Seconds</div>
							</div>
						</div>
						<div class="mt-2 text-sm text-yellow-500">
							Get Ready for the VOI NFT Winter Games!
						</div>
						<div class="mt-4">
							<a 
								href="http://bit.ly/4jd94OO" 
								target="_blank" 
								rel="noopener noreferrer" 
								class="inline-block px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
							>
								Register Your Collection for the Games
							</a>
						</div>
					</div>
				{:else}
					<div class="mt-2 text-sm text-red-500 font-medium">
						Game has ended
					</div>
				{/if}
			</div>
		</div>

		<!-- Custom Tab Navigation -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow relative">
			<div class="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto relative z-0">
				{#each tabSet as tab, i}
					<div class="flex-1 relative">
						<button
							class="absolute inset-0 px-6 py-3 font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 {activeTab === i ? 'text-blue-500 border-b-2 border-blue-500 -mb-px bg-gray-50 dark:bg-gray-700' : 'text-gray-500 dark:text-gray-400'}"
							on:click={() => (activeTab = i)}
							role="tab"
							aria-selected={activeTab === i}
						>
							<div class="flex items-center justify-center">
								<i class="fas fa-{tab.icon} mr-2"></i>
								<span>{tab.name}</span>
							</div>
						</button>
						<!-- Spacer to maintain layout -->
						<div class="invisible px-6 py-3 font-medium">
							<div class="flex items-center justify-center">
								<i class="fas fa-{tab.icon} mr-2"></i>
								<span>{tab.name}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			<div class="py-2 sm:p-6 relative z-0">
				{#if activeTab === 0}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<RulesExplainer {startDate} {endDate} bind:activeTab />
						<GameStats 
							{totalVolume} 
							{totalParticipants} 
							{collections} 
							sales={gameSales} 
							{startDate} 
							{endDate}
							bind:activeTab
						/>
					</div>
				{:else if activeTab === 1}
					<LeaderboardVolume sales={gameSales} {startDate} {endDate} />
				{:else if activeTab === 2}
					<LeaderboardProfit sales={gameSales} {startDate} {endDate} />
				{:else if activeTab === 3}
					<LeaderboardMinting {collections} {startDate} {endDate} />
				{:else if activeTab === 4}
					<LeaderboardSocial {startDate} {endDate} />
				{/if}
			</div>
		</div>
	</div>
</div>
