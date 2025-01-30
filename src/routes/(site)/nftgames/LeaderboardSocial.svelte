<script lang="ts">
	import { onMount } from 'svelte';
	import { formatNumber } from '$lib/utils/format';
	import { getNFD } from '$lib/utils/nfd';

	interface SocialEntry {
		address: string;
		nfd: string | null;
		projectName: string;
		impressions: number;
		posts: number;
		xHandle: string;
	}

	let socialLeaderboard: SocialEntry[] = [];
	let loading = true;

	export let startDate: Date;
	export let endDate: Date;

	// This is a placeholder until we have actual social media data integration
	onMount(async () => {
		loading = true;
		try {
			// TODO: Replace with actual social media data fetching
			// For now, we'll show a message about data collection
			loading = false;
		} catch (error) {
			console.error('Error loading social data:', error);
			loading = false;
		}
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
		<h2 class="text-2xl font-bold">Social Engagement</h2>
		<div class="px-3 py-1 bg-pink-500 text-white rounded-full text-sm">
			15% of Prize Pool
		</div>
	</div>

	<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
		<div class="text-center space-y-4">
			<h3 class="text-xl font-semibold">Coming Soon</h3>
			<p class="text-gray-600 dark:text-gray-400">
				Social engagement tracking and rewards will be announced soon. Follow us on Twitter for updates!
			</p>
			<a 
				href="https://twitter.com/voinftnavigator" 
				target="_blank" 
				rel="noopener noreferrer"
				class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
			>
				<i class="fab fa-twitter"></i>
				Follow @voinftnavigator
			</a>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center p-4">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else}
		<div class="card variant-ghost-warning p-6 text-center">
			<i class="fas fa-chart-line text-4xl mb-4"></i>
			<h3 class="h3 mb-2">Social Media Tracking Coming Soon</h3>
			<p class="mb-4">
				We're currently setting up social media tracking for the NFT Winter Games.
				Points will be awarded based on post impressions that include:
			</p>
			<div class="flex justify-center gap-4 mb-4">
				<div class="badge variant-filled">#VoiGames</div>
				<div class="badge variant-filled">@Voi_Net</div>
			</div>
			<ul class="text-left max-w-md mx-auto space-y-2">
				<li><i class="fas fa-check text-success-500 mr-2"></i> 1 impression = 1 point</li>
				<li><i class="fas fa-check text-success-500 mr-2"></i> Only project account posts count</li>
				<li><i class="fas fa-check text-success-500 mr-2"></i> Comments and replies excluded</li>
				<li><i class="fas fa-check text-success-500 mr-2"></i> Limited to 1 X account per project</li>
			</ul>
		</div>

		{#if socialLeaderboard.length > 0}
			<div class="card variant-ghost p-4">
				<table class="table table-compact w-full">
					<thead>
						<tr>
							<th class="w-16">Rank</th>
							<th>Creator</th>
							<th class="text-right">Impressions</th>
							<th class="text-right">Posts</th>
						</tr>
					</thead>
					<tbody>
						{#each socialLeaderboard as entry, i}
							<tr class="hover:bg-warning-500/20">
								<td>
									<span class="font-bold {getPositionClass(i)}">
										#{i + 1}
									</span>
								</td>
								<td>
									<div class="flex flex-col">
										{#if entry.nfd}
											<span class="font-medium">{entry.nfd}</span>
										{:else}
											<span class="font-mono text-sm">{entry.address.slice(0, 8)}...</span>
										{/if}
										<span class="text-xs opacity-75">{entry.projectName}</span>
									</div>
								</td>
								<td class="text-right font-medium">
									{formatNumber(entry.impressions)}
								</td>
								<td class="text-right">
									<div class="flex flex-col items-end">
										<span class="font-medium">{entry.posts}</span>
										<a href="https://x.com/{entry.xHandle}" target="_blank" rel="noopener" class="text-xs text-blue-500 hover:underline">
											@{entry.xHandle}
										</a>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<p class="text-center text-sm opacity-75">
			Top 25 creators will be entered into raffle for prizes
		</p>
	{/if}
</div> 