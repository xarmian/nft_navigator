<script lang="ts">
    import * as d3 from "d3";
    import type { Collection } from '$lib/data/types';
    import { getImageUrl } from '$lib/utils/functions';

    interface ChartData {
        name: string;
        value: number;
    }

    // Receive plot data as prop.
    export let data: ChartData[];
    export let collections: Collection[] = []; // Add collections prop for additional data

    // Specify the chart's dimensions.
    const width = 500;
    const height = 500;
    const listWidth = 250;

    // Track hovered collection
    let hoveredCollection: string | null = null;

    // Create the color scale.
    $: colourScale = d3.scaleOrdinal<string>()
        .domain(data.map(d => d.name))
        .range(d3.quantize((t: number) => d3.interpolateSpectral(t * 0.8 + 0.1), data.length).reverse())

    // Create the pie layout and arc generator.
    const pie = d3.pie<ChartData>()
        .sort(null)
        .value((d: ChartData) => d.value);

    const arcPath = d3.arc<d3.PieArcDatum<ChartData>>()
        .innerRadius(0)
        .outerRadius(Math.min(width, height) / 2 - 1);

    $: arcs = pie(data);

    // Calculate total NFTs for portfolio percentage
    $: totalNFTs = data.reduce((sum: number, d: ChartData) => sum + d.value, 0);

    // Function to get collection data
    function getCollectionData(name: string): Collection | undefined {
        return collections.find(c => c.highforgeData?.title === name || `Collection #${c.contractId}` === name);
    }

    // Function to format tooltip content
    function getTooltipContent(slice: d3.PieArcDatum<ChartData>): string {
        const collection = getCollectionData(slice.data.name);
        if (!collection) return '';

        const ownedNFTs = slice.data.value;
        const totalSupply = collection.totalSupply - collection.burnedSupply;
        const ownershipPercent = Math.round((ownedNFTs / totalSupply) * 100);
        const portfolioPercent = Math.round((ownedNFTs / totalNFTs) * 100);

        return `
            <div class="p-4 max-w-sm">
                <div class="flex items-start gap-4">
                    <div class="flex-shrink-0">
                        ${collection.highforgeData?.coverImageURL 
                            ? `<img src="${getImageUrl(collection.highforgeData.coverImageURL, 100)}" 
                                   alt="${collection.highforgeData?.title || 'Collection Cover'}"
                                   class="w-16 h-16 rounded-lg object-cover">`
                            : `<div class="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                 <i class="fas fa-image text-2xl text-gray-400"></i>
                               </div>`
                        }
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-bold text-lg truncate mb-2">
                            ${collection.highforgeData?.title || `Collection #${collection.contractId}`}
                        </h3>
                        <div class="grid grid-cols-2 gap-2 text-sm">
                            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                                <div class="text-gray-500 dark:text-gray-400">NFTs Owned</div>
                                <div class="font-semibold">${ownedNFTs.toLocaleString()}</div>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                                <div class="text-gray-500 dark:text-gray-400">Total Supply</div>
                                <div class="font-semibold">${totalSupply.toLocaleString()}</div>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                                <div class="text-gray-500 dark:text-gray-400">Collection Ownership</div>
                                <div class="font-semibold">${ownershipPercent}%</div>
                            </div>
                            <div class="bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                                <div class="text-gray-500 dark:text-gray-400">Portfolio Share</div>
                                <div class="font-semibold">${portfolioPercent}%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Function to position tooltip
    function positionTooltip(e: MouseEvent, tooltip: HTMLElement) {
        // Get the SVG element's position
        const svg = document.querySelector('svg');
        if (!svg) return;
        
        const svgRect = svg.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Calculate position relative to the viewport
        let left = e.clientX + 15; // Offset from cursor
        let top = e.clientY + 15;
        
        // Adjust if tooltip would go off the right edge
        if (left + tooltipRect.width > window.innerWidth) {
            left = e.clientX - tooltipRect.width - 15;
        }
        
        // Adjust if tooltip would go off the bottom edge
        if (top + tooltipRect.height > window.innerHeight) {
            top = e.clientY - tooltipRect.height - 15;
        }
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    // Function to handle collection hover
    function handleCollectionHover(collectionName: string | null, e?: MouseEvent) {
        hoveredCollection = collectionName;
        
        if (collectionName && e) {
            const tooltip = document.getElementById('pie-tooltip');
            if (tooltip) {
                const slice = arcs.find(s => s.data.name === collectionName);
                if (slice) {
                    tooltip.innerHTML = getTooltipContent(slice);
                    tooltip.style.display = 'block';
                    positionTooltip(e, tooltip);
                }
            }
        } else {
            const tooltip = document.getElementById('pie-tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        }
    }
</script>

<div class="flex justify-evenly w-full">
    <svg
        {width}
        {height}
        viewBox="{-width / 2}, {-height / 2}, {width}, {height}"
        style:max-width="100%"
        style:height="auto"
    >
        <g class="data">
            {#each arcs as slice}
                <path 
                    d={arcPath(slice)}
                    fill={colourScale(slice.data.name)}
                    stroke="white"
                    class="cursor-pointer transition-opacity"
                    class:opacity-80={hoveredCollection === slice.data.name}
                    on:mouseenter={(e) => handleCollectionHover(slice.data.name, e)}
                    on:mousemove={(e) => {
                        const tooltip = document.getElementById('pie-tooltip');
                        if (tooltip) {
                            positionTooltip(e, tooltip);
                        }
                    }}
                    on:mouseleave={() => handleCollectionHover(null)}
                />
            {/each}
        </g>
    </svg>

    <div class="hidden sm:block w-[250px] h-[500px] overflow-y-auto pr-4">
        <div class="space-y-2">
            {#each data.sort((a, b) => b.value - a.value) as item}
                <div 
                    class="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                    class:bg-gray-100={hoveredCollection === item.name}
                    class:dark:bg-gray-700={hoveredCollection === item.name}
                    on:mouseenter={(e) => handleCollectionHover(item.name, e)}
                    on:mouseleave={() => handleCollectionHover(null)}
                >
                    <span class="font-medium truncate">{item.name}</span>
                    <span class="text-sm text-gray-500 dark:text-gray-400 ml-4">{item.value}</span>
                </div>
            {/each}
        </div>
    </div>
</div>

<div id="pie-tooltip" 
     class="fixed hidden bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50"
     style="pointer-events: none; transform: translate(0, 0);">
</div>

<style>
    svg {
        font-size: 10px;
    }
    
    #pie-tooltip {
        transition: opacity 0.2s ease-in-out;
    }

    /* Custom scrollbar styles */
    .overflow-y-auto {
        scrollbar-width: thin;
        scrollbar-color: #CBD5E0 #EDF2F7;
    }

    .overflow-y-auto::-webkit-scrollbar {
        width: 6px;
    }

    .overflow-y-auto::-webkit-scrollbar-track {
        background: #EDF2F7;
        border-radius: 3px;
    }

    .overflow-y-auto::-webkit-scrollbar-thumb {
        background-color: #CBD5E0;
        border-radius: 3px;
    }

</style>
