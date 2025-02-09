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
		contractId: number;
	}

	let displayImages: NFTImage[] = [];
	let selectedCollections: Collection[] = [];
	let containerHeight = 400;
	let containerWidth = 1200;  // Default width for SSR
	let isMounted = false;
	let bannerOpacity = 1;  // New variable to control banner opacity

	// Update container width on mount and window resize
	onMount(() => {
		isMounted = true;
		const updateWidth = () => {
			containerWidth = window.innerWidth;
			if (collections.length > 0) {
				updateImagePositions();
			}
		};
		
		// Add scroll listener
		const handleScroll = () => {
			const scrollY = window.scrollY;
			const fadeStartPoint = 0;
			const fadeEndPoint = 300;  // Adjust this value to control how quickly the banner fades
			
			bannerOpacity = Math.max(0, 1 - (scrollY - fadeStartPoint) / (fadeEndPoint - fadeStartPoint));
		};
		
		updateWidth();
		window.addEventListener('resize', updateWidth);
		window.addEventListener('scroll', handleScroll);
		
		return () => {
			isMounted = false;
			window.removeEventListener('resize', updateWidth);
			window.removeEventListener('scroll', handleScroll);
		};
	});

	// Helper function to calculate distance between two points
	function distance(x1: number, y1: number, x2: number, y2: number) {
		return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
	}

	// Generate a position that fans out images in an arc
	function generatePosition(existingPositions: Array<{x: number, y: number}>, index: number, totalImages: number) {
		// Calculate horizontal spread across full width
		const x = (containerWidth * (index / (totalImages - 1))) - containerWidth/2;
		
		// Calculate y position based on parabolic arc
		// Maximum height at center, lower at edges
		const normalizedX = (x + containerWidth/2) / containerWidth; // 0 to 1
		const y = 100 - (100 * (1 - Math.pow(2 * normalizedX - 1, 2))); // Deeper parabola
		
		return { x, y };
	}

	// Generate a transform that orients images along the arc
	function generateTransform(x: number, y: number) {
		// Calculate rotation proportional to distance from center
		const normalizedX = (x + containerWidth/2) / containerWidth; // 0 to 1
		const rotateZ = (normalizedX * 2 - 1) * 45; // Scales from -45 to 45 degrees linearly
		const rotateY = 0; // Remove Y rotation for cleaner look
		const rotateX = 15; // Slight forward tilt
		const scale = 1.8 + Math.random() * 0.2; // Reduced scale to prevent overlap
		const opacity = 0.9 + Math.random() * 0.1;
		const translateZ = Math.random() * 30;

		return {
			transform: `translate(${x}px, ${y-100}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) translateZ(${translateZ}px)`,
			scale,
			opacity,
			zIndex: Math.floor(translateZ),
			x,
			y
		};
	}

	// Function to select images initially
	function selectImages() {
		const numImages = 6;
		
		// Filter collections that have images first
		const collectionsWithImages = collections.filter(c => {
			if (!c.firstToken?.metadata) return false;
			const metadata = JSON.parse(c.firstToken.metadata);
			if (metadata.image && !metadata.image.includes('highforge')) return false;
			return !!metadata.image;
		});

		// Randomly shuffle and take first 6
		selectedCollections = [...collectionsWithImages]
			.sort(() => Math.random() - 0.5)
			.slice(0, numImages);
	}

	// Function to update image positions
	function updateImagePositions() {
		if (selectedCollections.length === 0) return;
		
		const positions: Array<{x: number, y: number}> = [];
		displayImages = selectedCollections
			.map((c, index) => {
				const metadata = JSON.parse(c.firstToken!.metadata);
				const imageUrl = metadata.image;
				const name = metadata.name || 'Untitled';
				
				const pos = generatePosition(positions, index, selectedCollections.length);
				positions.push(pos);
				const transformData = generateTransform(pos.x, pos.y);
				
				return {
					url: getImageUrl(imageUrl, 480),
					name,
					contractId: c.contractId,
					...transformData
				};
			});
	}

	// Watch collections for changes and update display images when ready
	$: if (isMounted && collections.length > 0) {
		if (selectedCollections.length === 0) {
			selectImages();
		}
		updateImagePositions();
	}
</script>

<div 
	class="relative w-full"
	style="height: 400px; perspective: 2000px; opacity: {bannerOpacity};"
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
			<a
				class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-xl rounded-lg overflow-hidden transition-all duration-300 ease-in-out hover:z-50"
				style="
					transform: {image.transform} scale({image.scale});
					z-index: {image.zIndex};
					opacity: {image.opacity};
				"
				transition:fade={{duration: 300}}
				href={`/collection/${image.contractId}`}
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
			</a>
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