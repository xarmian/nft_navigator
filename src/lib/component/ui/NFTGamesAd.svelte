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

<div class="relative w-full overflow-hidden bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 rounded-lg shadow-xl my-8">
	<!-- Grid overlay effect -->
	<div 
		class="absolute inset-0" 
		style="background-image: linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent); background-size: 50px 50px;"
	></div>

	<div class="relative p-8 text-center text-white">
		<div in:fly={{ y: -20, duration: 800 }} class="text-4xl font-bold mb-4 tracking-tight">
			🎮 VOI NFT Winter Games 2025 🎮
		</div>
		<div in:fly={{ y: -20, duration: 800, delay: 200 }} class="text-xl mb-6">
			Compete for a Prize Pool of up to 100 Million VOI!
		</div>

		{#if isGamePending}
			<div in:fly={{ y: -20, duration: 800, delay: 400 }} class="mb-6">
				<div class="text-lg text-yellow-300 font-bold mb-2">
					Games Start In
				</div>
				<div class="flex justify-center gap-2 sm:gap-8">
					<div class="text-center">
						<div class="text-2xl sm:text-4xl font-bold">{countdown.days}</div>
						<div class="text-sm sm:text-base text-gray-300 uppercase">Days</div>
					</div>
					<div class="text-2xl sm:text-4xl font-bold">:</div>
					<div class="text-center">
						<div class="text-2xl sm:text-4xl font-bold">{countdown.hours.toString().padStart(2, '0')}</div>
						<div class="text-sm sm:text-base text-gray-300 uppercase">Hours</div>
					</div>
					<div class="text-2xl sm:text-4xl font-bold">:</div>
					<div class="text-center">
						<div class="text-2xl sm:text-4xl font-bold">{countdown.minutes.toString().padStart(2, '0')}</div>
						<div class="text-sm sm:text-base text-gray-300 uppercase">Minutes</div>
					</div>
					<div class="text-2xl sm:text-4xl font-bold">:</div>
					<div class="text-center">
						<div class="text-2xl sm:text-4xl font-bold">{countdown.seconds.toString().padStart(2, '0')}</div>
						<div class="text-sm sm:text-base text-gray-300 uppercase">Seconds</div>
					</div>
				</div>
			</div>
		{:else if isGameActive}
			<div in:fly={{ y: -20, duration: 800, delay: 400 }} class="text-2xl font-bold text-yellow-300 mb-6">
				🔥 Games are LIVE! Join Now! 🔥
			</div>
		{:else}
			<div in:fly={{ y: -20, duration: 800, delay: 400 }} class="text-2xl font-bold text-red-300 mb-6">
				Games have ended. Stay tuned for the next event!
			</div>
		{/if}

		<div in:fly={{ y: -20, duration: 800, delay: 600 }} class="flex flex-wrap justify-center gap-8 mb-6">
			<div class="flex flex-col items-center">
				<div class="text-xl font-bold text-blue-300 mb-4">Trader Rewards (85%)</div>
				<div class="flex gap-4">
					<div class="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-blue-500/30">
						<div class="text-2xl font-bold text-yellow-300">42.5%</div>
						<div class="text-sm">Volume Prize Pool</div>
					</div>
					<div class="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-blue-500/30">
						<div class="text-2xl font-bold text-yellow-300">42.5%</div>
						<div class="text-sm">Profit Prize Pool</div>
					</div>
				</div>
			</div>

			<div class="w-px h-24 bg-white/20 hidden sm:block"></div>

			<div class="flex flex-col items-center">
				<div class="text-xl font-bold text-green-300 mb-4">Creator Rewards (15%)</div>
				<div class="flex gap-4">
					<div class="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-green-500/30">
						<div class="text-2xl font-bold text-yellow-300">10%</div>
						<div class="text-sm">Minting Prize Pool</div>
					</div>
					<div class="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-green-500/30">
						<div class="text-2xl font-bold text-yellow-300">5%</div>
						<div class="text-sm">Social Prize Pool</div>
					</div>
				</div>
			</div>
		</div>

		<div in:fly={{ y: -20, duration: 800, delay: 800 }} class="flex justify-center">
			<a 
				href="/nftgames"
				class="inline-block px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-full transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
			>
				{#if isGamePending}
					Register Now & Learn More
				{:else if isGameActive}
					View Leaderboards & Join Now
				{:else}
					View Final Results
				{/if}
			</a>
		</div>
	</div>

	<!-- Animated snow effect -->
	<div class="absolute inset-0 pointer-events-none">
		{#each Array(30) as _, i}
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
		width: 6px;
		height: 6px;
		background: white;
		border-radius: 50%;
		opacity: 0.3;
		animation-name: fall;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		box-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
	}

	.snow:nth-child(2n) {
		width: 8px;
		height: 8px;
		opacity: 0.4;
	}

	.snow:nth-child(3n) {
		width: 10px;
		height: 10px;
		opacity: 0.35;
	}

	.snow:nth-child(4n) {
		width: 4px;
		height: 4px;
		opacity: 0.25;
	}

	.snow:nth-child(3n) {
		animation-name: fall-left;
	}

	.snow:nth-child(3n + 1) {
		animation-name: fall-right;
	}

	@keyframes fall {
		from {
			transform: translateY(0) rotate(0deg);
		}
		to {
			transform: translateY(1000px) rotate(360deg);
		}
	}

	@keyframes fall-left {
		from {
			transform: translate(0, 0) rotate(0deg);
		}
		to {
			transform: translate(-200px, 1000px) rotate(360deg);
		}
	}

	@keyframes fall-right {
		from {
			transform: translate(0, 0) rotate(0deg);
		}
		to {
			transform: translate(200px, 1000px) rotate(360deg);
		}
	}
</style> 