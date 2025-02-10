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
		collection: Collection;  // Add reference to full collection
	}

	let displayImages: NFTImage[] = [];
	let selectedCollections: Collection[] = [];
	let containerHeight = 400;
	let containerWidth = 1200;  // Default width for SSR
	let isMounted = false;
	let bannerOpacity = 1;  // New variable to control banner opacity
	let hoveredImage: NFTImage | null = null;
	let infoPosition = { x: 0, y: 0 };

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

	// Function to handle mouse enter
	function handleMouseEnter(image: NFTImage, event: MouseEvent) {
		hoveredImage = image;
		// Position info panel based on image position
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const containerRect = (event.currentTarget as HTMLElement).closest('.relative')?.getBoundingClientRect();
		if (containerRect) {
			const panelWidth = 320; // w-80 = 20rem = 320px
			const halfPanelWidth = panelWidth / 2;
			
			// Calculate initial x position
			let x = rect.left - containerRect.left + rect.width / 2;
			
			// Adjust x if panel would go off screen
			if (x - halfPanelWidth < 0) {
				// Too far left, adjust to keep panel fully visible
				x = halfPanelWidth;
			} else if (x + halfPanelWidth > containerRect.width) {
				// Too far right, adjust to keep panel fully visible
				x = containerRect.width - halfPanelWidth;
			}
			
			infoPosition = {
				x,
				y: rect.top - containerRect.top
			};
		}
	}

	// Function to handle mouse leave
	function handleMouseLeave() {
		hoveredImage = null;
	}

	// Function to update image positions
	function updateImagePositions() {
		if (selectedCollections.length === 0) return;
		
		const positions: Array<{x: number, y: number}> = [];
		displayImages = selectedCollections
			.map((collection, index) => {
				const metadata = JSON.parse(collection.firstToken!.metadata);
				const imageUrl = metadata.image;
				const name = metadata.name || 'Untitled';
				
				const pos = generatePosition(positions, index, selectedCollections.length);
				positions.push(pos);
				const transformData = generateTransform(pos.x, pos.y);
				
				return {
					url: getImageUrl(imageUrl, 480),
					name,
					contractId: collection.contractId,
					collection,  // Store the full collection
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
				class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-xl rounded-lg overflow-hidden transition-all duration-300 ease-in-out hover:z-[45]"
				style="
					transform: {image.transform} scale({image.scale});
					z-index: {image.zIndex};
					opacity: {image.opacity};
				"
				on:mouseenter={(e) => handleMouseEnter(image, e)}
				on:mouseleave={handleMouseLeave}
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

		<!-- Floating Info Panel -->
		{#if hoveredImage}
			<div
				class="absolute z-[100] w-80 bg-gray-900/90 rounded-lg p-4 backdrop-blur-sm text-white shadow-2xl pointer-events-none"
				style="left: {infoPosition.x}px; top: {Math.max(20, infoPosition.y - 220)}px; transform: translateX(-50%); max-width: calc(100% - 2rem);"
				in:fly={{ y: 20, duration: 300 }}
				out:fade
			>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-bold truncate flex-1 mr-2">{hoveredImage.collection.highforgeData?.title ?? hoveredImage.name}</h3>
						<div class="text-sm text-blue-400 whitespace-nowrap">#{hoveredImage.collection.contractId}</div>
					</div>
					
					<div class="grid grid-cols-2 gap-2 text-sm">
						<div class="bg-gray-800/50 rounded p-2">
							<div class="text-gray-400">Supply</div>
							<div class="font-medium">{hoveredImage.collection.totalSupply}</div>
						</div>
						<div class="bg-gray-800/50 rounded p-2">
							<div class="text-gray-400">Unique Owners</div>
							<div class="font-medium">{hoveredImage.collection.uniqueOwners || 'N/A'}</div>
						</div>
					</div>

					{#if hoveredImage.collection.firstToken?.metadata}
						{@const metadata = JSON.parse(hoveredImage.collection.firstToken.metadata)}
						{#if metadata.description}
							<div class="text-sm text-gray-300 line-clamp-2">
								{metadata.description}
							</div>
						{/if}
					{/if}

					{#if hoveredImage.collection.gameData?.description}
						<div class="text-sm text-gray-300 line-clamp-2 border-t border-gray-700/50 pt-2">
							{hoveredImage.collection.gameData.description}
						</div>
					{/if}

					<div class="text-xs text-gray-400 truncate">
						Created by {hoveredImage.collection.creatorName || hoveredImage.collection.creator}
					</div>
				</div>
			</div>
		{/if}
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