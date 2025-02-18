<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	let countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
	let countdownInterval: ReturnType<typeof setInterval>;

	const startDate = new Date('2025-02-14T17:00:00Z');
	const endDate = new Date('2025-02-28T17:00:00Z');
	const startTimestamp = startDate.getTime();
	const endTimestamp = endDate.getTime();

	$: now = new Date();
	$: nowTimestamp = now.getTime();
	$: isGameActive = nowTimestamp >= startTimestamp && nowTimestamp <= endTimestamp;
	$: isGamePending = nowTimestamp < startTimestamp;

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

	onMount(() => {
		if (isGamePending) {
			updateCountdown();
			countdownInterval = setInterval(updateCountdown, 1000);
		}
		return () => {
			if (countdownInterval) clearInterval(countdownInterval);
		};
	});
</script>

<div class="relative overflow-hidden bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 rounded-xl shadow-xl">
	<!-- Grid overlay effect -->
	<div 
		class="absolute inset-0" 
		style="background-image: linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent); background-size: 50px 50px;"
	></div>

	<div class="relative p-6 text-white">
		<div class="flex flex-col md:flex-row items-center justify-between gap-6">
			<!-- Left side: Title and Description -->
			<div class="flex-1">
				<h3 class="text-2xl font-bold mb-2">🎮 VOI NFT Winter Games 2025</h3>
				<p class="text-blue-200 mb-4">Compete for a Prize Pool of up to 100M VOI!</p>
				
				{#if isGamePending}
					<div class="flex items-center gap-4 text-yellow-300">
						<span class="font-medium">Starts in:</span>
						<div class="flex gap-2">
							<span class="font-bold">{countdown.days}d</span>
							<span class="font-bold">{countdown.hours.toString().padStart(2, '0')}h</span>
							<span class="font-bold">{countdown.minutes.toString().padStart(2, '0')}m</span>
						</div>
					</div>
				{:else if isGameActive}
					<div class="text-lg font-bold text-yellow-300">
						🔥 Games are LIVE! Join Now!
					</div>
				{:else}
					<div class="text-lg font-bold text-red-300">
						Games have ended. Stay tuned for the next event!
					</div>
				{/if}
			</div>

			<!-- Right side: CTA Button -->
			<div class="flex-shrink-0">
				<a 
					href="/nftgames"
					class="inline-block px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl whitespace-nowrap"
				>
					{#if isGamePending}
						Learn More
					{:else if isGameActive}
						View Leaderboards
					{:else}
						View Results
					{/if}
				</a>
			</div>
		</div>
	</div>

	<!-- Animated snow effect (reduced number) -->
	<div class="absolute inset-0 pointer-events-none">
		{#each Array(15) as _, i}
			<div
				class="snow"
				style="
					left: {Math.random() * 100}%;
					top: -{Math.random() * 20}%;
					animation-duration: {3 + Math.random() * 2}s;
					animation-delay: -{Math.random() * 5}s;
				"
			/>
		{/each}
	</div>
</div>

<style>
	.snow {
		position: absolute;
		width: 4px;
		height: 4px;
		background: white;
		border-radius: 50%;
		opacity: 0.3;
		animation-name: fall;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		box-shadow: 0 0 3px rgba(255, 255, 255, 0.3);
	}

	@keyframes fall {
		from {
			transform: translateY(0) rotate(0deg);
		}
		to {
			transform: translateY(300px) rotate(360deg);
		}
	}
</style> 