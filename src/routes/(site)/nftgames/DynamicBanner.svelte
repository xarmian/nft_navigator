<script lang="ts">
	import type { Collection } from '$lib/data/types';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { getImageUrl } from '$lib/utils/functions';

	export let collections: Collection[] = [];
	
	interface NFTImage {
		url: string;
		name: string;
		transform: string;
		zIndex: number;
		scale: number;
		opacity: number;
		x: number;  // Store actual position
		y: number;
	}

	let displayImages: NFTImage[] = [];
	let containerHeight = 400;
	let containerWidth = 1200;  // Approximate width for positioning

	// Helper function to calculate distance between two points
	function distance(x1: number, y1: number, x2: number, y2: number) {
		return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
	}

	// Generate a position that evenly spaces images horizontally
	function generatePosition(existingPositions: Array<{x: number, y: number}>, index: number, totalImages: number) {
		// Calculate evenly spaced X position
		const spacing = containerWidth / (totalImages - 1);
		const x = (spacing * index) - (containerWidth / 2);
		
		// Add some horizontal jitter to make it look more natural
		const jitter = spacing * 0.2; // 20% of spacing for random movement
		const jitteredX = x + (Math.random() * jitter * 2 - jitter);
		
		// Keep vertical randomness with upward bias
		const randomY = Math.random();
		const y = -150 + (randomY * randomY * 200);

		return { x: jitteredX, y };
	}

	// Generate a random transform for each image
	function generateTransform(x: number, y: number) {
		const rotateX = Math.random() * 40 - 20;
		const rotateY = Math.random() * 40 - 20;
		const rotateZ = Math.random() * 20 - 10;
		const translateZ = Math.random() * 100 - 50;
		const scale = 1.8 + Math.random() * 0.4;
		const opacity = 0.7 + Math.random() * 0.3;

		return {
			transform: `translate(${x}px, ${y}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) translateZ(${translateZ}px)`,
			scale,
			opacity,
			zIndex: Math.floor(translateZ),
			x,
			y
		};
	}

	// Process collections to get display images
	$: {
		const numImages = 6;
		const positions: Array<{x: number, y: number}> = [];
		
		// Filter collections that have images first
		const collectionsWithImages = collections.filter(c => {
			if (!c.firstToken?.metadata) return false;
			const metadata = JSON.parse(c.firstToken.metadata);
			if (metadata.image && !metadata.image.includes('highforge')) return false;
			return !!metadata.image;
		});

		// Randomly shuffle and take first 6
		const shuffledCollections = [...collectionsWithImages]
			.sort(() => Math.random() - 0.5)
			.slice(0, numImages);

		displayImages = shuffledCollections
			.map((c, index) => {
				const metadata = JSON.parse(c.firstToken!.metadata);
				const imageUrl = metadata.image;
				const name = metadata.name || 'Untitled';
				
				const pos = generatePosition(positions, index, numImages);
				positions.push(pos);
				const transformData = generateTransform(pos.x, pos.y);
				
				return {
					url: getImageUrl(imageUrl, 480),
					name,
					...transformData
				};
			});
	}

	// Remove interval-based movement
	onMount(() => {
		return () => {};
	});
</script>

<div 
	class="relative w-full overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800"
	style="height: 400px; perspective: 2000px;"
>
	<div class="absolute inset-0 bg-blue-500/10"></div>
	
	<!-- Grid overlay effect -->
	<div 
		class="absolute inset-0" 
		style="background-image: linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, .05) 25%, rgba(255, 255, 255, .05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, .05) 75%, rgba(255, 255, 255, .05) 76%, transparent 77%, transparent); background-size: 50px 50px;"
	></div>

	<!-- Images container -->
	<div class="absolute inset-0">
		{#each displayImages as image, i (image.url)}
			<div
				class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-xl rounded-lg overflow-hidden transition-all duration-300 ease-in-out hover:z-50"
				style="
					transform: {image.transform} scale({image.scale});
					z-index: {image.zIndex};
					opacity: {image.opacity};
				"
				transition:fade={{duration: 300}}
			>
				<img
					src={image.url}
					alt={image.name}
					class="w-48 h-48 object-cover"
					loading="lazy"
				/>
				<div class="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">
					{image.name}
				</div>
			</div>
		{/each}
	</div>

	<!-- Overlay gradients for depth effect -->
	<div class="absolute inset-0 bg-gradient-to-t from-gray-900/50 to-transparent"></div>
	<div class="absolute inset-0 bg-gradient-to-b from-gray-900/50 to-transparent"></div>

	<!-- Vignette effect -->
	<div 
		class="absolute inset-0"
		style="background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.4) 100%);"
	></div>
</div>

<style>
	/* Add a subtle glow effect to images on hover */
	img:hover {
		filter: brightness(1.1) drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
	}
</style> 