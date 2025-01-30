<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { getCollections, getSales } from '$lib/utils/indexer';
	import type { Collection, Sale } from '$lib/data/types';
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

	const startDate = new Date('2025-02-14T00:00:00Z');
	const endDate = new Date('2025-02-28T00:00:00Z');
	const startTimestamp = startDate.getTime();
	const endTimestamp = endDate.getTime();

	let activeTab = 0;
	let collections: Collection[] = [];
	let allSales: Sale[] = [];
	let gameSales: Sale[] = [];
	let loading = true;
	let totalVolume = 0;
	let totalParticipants = 0;

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

			// No need to filter sales anymore since we're getting the correct date range from the API
			gameSales = allSales;

			// Calculate game statistics using filtered sales
			totalVolume = gameSales.reduce((acc, sale) => acc + sale.price, 0);
			const participants = new Set([
				...gameSales.map(s => s.buyer),
				...gameSales.map(s => s.seller)
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

<div class="min-h-screen bg-gray-100 dark:bg-gray-900">
	<!-- Dynamic Banner -->
	<div class="w-full">
		<DynamicBanner {collections} />
	</div>

	<div class="container mx-auto p-4 space-y-4">
		<div class="text-center relative z-0 mb-8">
			<div class="inline-block px-8 py-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg transform -translate-y-20">
				<h1 class="text-4xl font-bold mb-4">VOI NFT Winter Games 2025</h1>
				<p class="text-lg">
					{#if loading}
						Loading game statistics...
					{:else}
						<span class="font-bold">{formatNumber(totalVolume / VOI_FACTOR)} VOI</span> total volume • 
						<span class="font-bold">{totalParticipants}</span> participants
					{/if}
				</p>
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
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="flex border-b border-gray-200 dark:border-gray-700">
				{#each tabSet as tab, i}
					<button
						class="px-6 py-3 font-medium {activeTab === i ? 'text-blue-500 border-b-2 border-blue-500 -mb-px' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
						on:click={() => activeTab = i}
					>
						<i class="fas fa-{tab.icon} mr-2"></i>
						{tab.name}
					</button>
				{/each}
			</div>

			<div class="p-6">
				{#if activeTab === 0}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<RulesExplainer {startDate} {endDate} />
						<GameStats {totalVolume} {totalParticipants} {collections} sales={gameSales} {startDate} {endDate} />
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
