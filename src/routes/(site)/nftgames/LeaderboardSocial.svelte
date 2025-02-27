<script lang="ts">
	import { onMount } from 'svelte';
	import { formatNumber } from '$lib/utils/format';

	interface SocialEntry {
		username: string;
		points: number;
		lastActive: string;
		projectName: string;
	}

	let socialLeaderboard: SocialEntry[] = [];
	let loading = true;
	let error: string | null = null;

	export let startDate: Date;
	export let endDate: Date;

	onMount(async () => {
		loading = true;
		try {
			const response = await fetch('/api/social');
			if (!response.ok) throw new Error('Failed to fetch social data');
			socialLeaderboard = await response.json();
			loading = false;
		} catch (err) {
			console.error('Error loading social data:', err);
			error = 'Failed to load social leaderboard data';
			loading = false;
		}
	});

	function getPositionClass(index: number): string {
		if (index === 0) return 'text-yellow-500'; // Gold
		if (index === 1) return 'text-gray-400';  // Silver
		if (index === 2) return 'text-amber-600'; // Bronze
		return 'text-gray-500';
	}

	function formatPoints(points: number): string {
		if (points >= 1000) {
			return (points / 1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
		}
		return points.toString();
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'numeric',
			day: 'numeric',
			year: 'numeric'
		}).replace(/\//g, '/');
	}
</script>

<div class="space-y-4">
	<div class="flex justify-between items-center mb-6">
		<h2 class="text-2xl font-bold">Social Engagement</h2>
		<div class="px-3 py-1 bg-pink-500 text-white rounded-full text-sm">
			5% of Prize Pool
		</div>
	</div>

	<div class="card variant-ghost p-4 mb-6">
		<div class="flex items-start gap-4">
			<div class="flex-1">
				<h3 class="text-lg font-semibold mb-2">How Points Are Earned</h3>
				<ul class="space-y-2 text-sm">
					<li class="flex items-center gap-2">
						<i class="fas fa-check text-success-500"></i>
						<span>1 post view = 1 point</span>
					</li>
					<li class="flex items-center gap-2">
						<i class="fas fa-check text-success-500"></i>
						<span>Posts must include <span class="text-blue-400">#VoiGames</span> or mention <span class="text-blue-400">@Voi_Net</span></span>
					</li>
					<li class="flex items-center gap-2">
						<i class="fas fa-check text-success-500"></i>
						<span>Only official project account posts are counted</span>
					</li>
					<li class="flex items-center gap-2">
						<i class="fas fa-check text-success-500"></i>
						<span>Limited to 1 X account per project</span>
					</li>
					<li class="flex items-center gap-2 text-gray-400">
						<i class="fas fa-info-circle"></i>
						<span>Comments and replies are not counted</span>
					</li>
				</ul>
			</div>
			<a 
				href="https://twitter.com/voinftnavigator" 
				target="_blank" 
				rel="noopener noreferrer"
				class="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
			>
				<i class="fab fa-x-twitter"></i>
				Follow for Updates
			</a>
		</div>
	</div>

	<div class="card variant-ghost-warning p-4">
		<div class="flex items-center gap-3">
			<i class="fas fa-info-circle text-warning-500"></i>
			<p class="text-sm">These statistics are currently a work in progress and updates may be delayed. Final numbers will be tallied following the completion of the Games.</p>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center p-4">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if error}
		<div class="card variant-ghost-error p-4 text-center">
			<p>{error}</p>
		</div>
	{:else if socialLeaderboard.length === 0}
		<div class="card variant-ghost-warning p-6 text-center">
			<i class="fas fa-chart-line text-4xl mb-4"></i>
			<h3 class="h3 mb-2">No Social Activity Yet</h3>
			<p class="mb-4">
				Be the first to earn points! Share your project using:
			</p>
			<div class="flex justify-center gap-4 mb-4">
				<div class="badge variant-filled">#VoiGames</div>
				<div class="badge variant-filled">@Voi_Net</div>
			</div>
			<ul class="text-left max-w-md mx-auto space-y-2">
				<li><i class="fas fa-check text-success-500 mr-2"></i> 1 view = 1 point</li>
				<li><i class="fas fa-check text-success-500 mr-2"></i> Only project account posts count</li>
				<li><i class="fas fa-check text-success-500 mr-2"></i> Comments and replies excluded</li>
				<li><i class="fas fa-check text-success-500 mr-2"></i> Limited to 1 X account per project</li>
			</ul>
		</div>
	{:else}
		<div class="card variant-ghost p-4">
			<table class="w-full">
				<thead>
					<tr class="text-gray-400">
						<th class="w-24 text-left pb-4">Rank</th>
						<th class="text-left pb-4">Project</th>
						<th class="text-right pb-4">Points</th>
						<th class="text-right pb-4 pr-2">Last Active</th>
					</tr>
				</thead>
				<tbody>
					{#each socialLeaderboard as entry, i}
						<tr class="hover:bg-warning-500/20">
							<td class="py-2">
								<span class="font-bold {getPositionClass(i)} text-lg">
									#{i + 1}
								</span>
							</td>
							<td class="py-2">
								{#if entry.projectName !== entry.username}
									<div class="flex flex-col">
										<span class="font-medium text-white">{entry.projectName}</span>
										<a href="https://x.com/{entry.username}" target="_blank" rel="noopener" class="text-sm text-blue-400 hover:underline">
											@{entry.username}
										</a>
									</div>
								{:else}
									<a href="https://x.com/{entry.username}" target="_blank" rel="noopener" class="text-sm text-blue-400 hover:underline">
										@{entry.username}
									</a>
								{/if}
							</td>
							<td class="text-right py-2 font-medium text-white">
								{formatPoints(entry.points)}
							</td>
							<td class="text-right py-2 pr-2 text-sm text-gray-400">
								{formatDate(entry.lastActive)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div> 