<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { formatNumber } from '$lib/utils/format';
  import { fly, fade } from 'svelte/transition';
  import type { BaseLeaderboardEntry } from './types';

  export let entries: BaseLeaderboardEntry[] = []; // This will accept different entry types from different leaderboards
  export let valueProperty: string = 'totalProfit'; // Property to use for ticket allocation (e.g., totalProfit, volume)
  export let nameProperty: string = 'nfd'; // Property to display on wheel (can be nfd object or string)
  export let colorScheme: 'blue' | 'green' | 'amber' | 'pink' = 'blue'; // To allow different colors per leaderboard

  // Define interface for wheel segments
  interface WheelSegment {
    entry: BaseLeaderboardEntry;
    size: number;
    percentage: number;
    color: string;
    startAngle?: number;
    endAngle?: number;
  }

  const dispatch = createEventDispatcher<{
    close: void;
    winner: { winner: BaseLeaderboardEntry };
  }>();
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let canvasWidth = 500;
  let canvasHeight = 580;
  let centerX = canvasWidth / 2;
  let centerY = canvasHeight / 2;
  let radius = Math.min(centerX, centerY) - 10;
  
  let isSpinning = false;
  let winner: BaseLeaderboardEntry | null = null;
  let spinAngle = 0;
  let spinVelocity = 0;
  let requestId: number;
  let lastTimestamp: number;
  let showWinner = false;
  
  // Auto-spin variables
  let autoSpinning = false;
  let remainingSpins = 0;
  let autoSpinTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Track winners history
  let winnersHistory: {entry: BaseLeaderboardEntry, count: number}[] = [];
  
  // Track total spins
  let spinCount = 0;

  // Tooltip variables
  let showTooltip = false;
  let tooltipX = 0;
  let tooltipY = 0;
  let hoveredSegment: WheelSegment | null = null;
  let tooltipElement: HTMLElement | null = null;

  // Single-color schemes for different leaderboards
  const colorSchemes = {
    blue: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
    green: ['#065f46', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    amber: ['#92400e', '#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'],
    pink: ['#9d174d', '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8']
  };

  // Colorful rainbow scheme
  const rainbowColors = [
    '#E53935', // Red
    '#D81B60', // Pink
    '#8E24AA', // Purple
    '#5E35B1', // Deep Purple
    '#3949AB', // Indigo
    '#1E88E5', // Blue
    '#039BE5', // Light Blue
    '#00ACC1', // Cyan
    '#00897B', // Teal
    '#43A047', // Green
    '#7CB342', // Light Green
    '#C0CA33', // Lime
    '#FDD835', // Yellow
    '#FFB300', // Amber
    '#FB8C00', // Orange
    '#F4511E'  // Deep Orange
  ];

  // Create array of segments with properly distributed probabilities
  $: wheelSegments = createWheelSegments();

  function createWheelSegments(): WheelSegment[] {
    if (!entries.length) return [];
    
    // Calculate total value across all entries
    const total = entries.reduce((sum, entry) => {
      const value = (entry as any)[valueProperty] || 0;
      return sum + value;
    }, 0);
    
    // Create segments with proportional sizes
    return entries.map((entry, index) => {
      const value = (entry as any)[valueProperty] || 0;
      const percentage = value / total;
      const segmentSize = percentage * (2 * Math.PI);
      
      // Always use colorful rainbow scheme
      const color = rainbowColors[index % rainbowColors.length];
      
      return {
        entry,
        size: segmentSize,
        percentage,
        color
      };
    });
  }

  function drawWheel() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw the wheel with segments
    let startAngle = spinAngle;
    
    wheelSegments.forEach((segment) => {
      const endAngle = startAngle + segment.size;
      
      // Draw segment
      ctx!.beginPath();
      ctx!.moveTo(centerX, centerY);
      ctx!.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx!.fillStyle = segment.color;
      ctx!.fill();
      ctx!.closePath();
      
      // Add a border to each segment
      ctx!.beginPath();
      ctx!.moveTo(centerX, centerY);
      ctx!.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx!.lineWidth = 1;
      ctx!.stroke();
      ctx!.closePath();
      
      // Store the segment's angles for tooltip detection
      segment.startAngle = startAngle;
      segment.endAngle = endAngle;
      
      // Draw name in the middle of the segment (radially)
      const textAngle = startAngle + segment.size / 2;
      
      // Get name to display
      let displayName = '';
      const entry = segment.entry as any;
      if (entry[nameProperty]) {
        // Check if it's a nested NFD object
        if (typeof entry[nameProperty] === 'object' && entry[nameProperty].replacementValue) {
          displayName = entry[nameProperty].replacementValue;
        } else {
          displayName = entry[nameProperty];
        }
      } else {
        // Fallback to address
        displayName = entry.address ? 
          `${entry.address.substring(0, 4)}...${entry.address.substring(entry.address.length - 4)}` :
          `User ${entries.indexOf(segment.entry) + 1}`;
      }
      
      // Draw text radially (from outside to inside)
      const textRadius = radius * 0.75;
      ctx!.save();
      ctx!.translate(centerX, centerY);
      ctx!.rotate(textAngle);
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillStyle = 'white';
      ctx!.font = "bold 12px Arial";
      ctx!.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx!.shadowBlur = 3;
      
      // Draw the name rotated 90 degrees
      ctx!.rotate(Math.PI / 2); // Rotate text 90 degrees
      ctx!.fillText(displayName, 0, -textRadius);
      
      ctx!.restore();
      
      startAngle = endAngle;
    });
    
    // Draw decoration circles
    // Draw outer decorative circle
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2;
      const x = centerX + (radius + 5) * Math.cos(angle);
      const y = centerY + (radius + 5) * Math.sin(angle);
      
      ctx!.beginPath();
      ctx!.arc(x, y, 3, 0, Math.PI * 2);
      ctx!.fillStyle = rainbowColors[i % rainbowColors.length];
      ctx!.fill();
      ctx!.closePath();
    }
    
    // Draw center circle
    const gradient = ctx!.createRadialGradient(centerX, centerY, 5, centerX, centerY, 25);
    gradient.addColorStop(0, 'white');
    gradient.addColorStop(1, '#f0f0f0');
    
    ctx!.beginPath();
    ctx!.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx!.fillStyle = gradient;
    ctx!.fill();
    ctx!.strokeStyle = '#ddd';
    ctx!.lineWidth = 2;
    ctx!.stroke();
    
    // Draw pointer (triangle pointing downward at the top position)
    ctx!.beginPath();
    ctx!.moveTo(centerX, centerY - radius - 2); // Bottom point (pointing at wheel)
    ctx!.lineTo(centerX - 15, centerY - radius - 40); // Top left
    ctx!.lineTo(centerX + 15, centerY - radius - 40); // Top right
    ctx!.closePath();
    ctx!.fillStyle = '#FF5252';
    ctx!.fill();
    ctx!.strokeStyle = 'white';
    ctx!.lineWidth = 2;
    ctx!.stroke();
  }

  function animateSpin(timestamp: number) {
    if (!lastTimestamp) {
      lastTimestamp = timestamp;
      requestId = requestAnimationFrame(animateSpin);
      return;
    }
    
    const elapsed = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    // Apply friction
    spinVelocity *= 0.98;
    
    // Update angle
    spinAngle += spinVelocity * (elapsed / 16);
    
    // Keep angle within 0-2π
    spinAngle = spinAngle % (2 * Math.PI);
    
    // Draw the wheel
    drawWheel();
    
    // Check if spin is complete
    if (spinVelocity < 0.001) {
      isSpinning = false;
      determineWinner();
      return;
    }
    
    // Continue animation
    requestId = requestAnimationFrame(animateSpin);
  }

  function spin() {
    if (isSpinning) return;
    
    isSpinning = true;
    showWinner = false;
    winner = null;
    
    // Random velocity between 0.2 and 0.4 radians per frame
    spinVelocity = 0.2 + Math.random() * 0.2;
    
    // Start animation
    lastTimestamp = 0;
    requestId = requestAnimationFrame(animateSpin);
  }

  function startAllSpins() {
    if (isSpinning || autoSpinning) return;
    
    autoSpinning = true;
    remainingSpins = 25;
    
    // Start the first spin
    runNextAutoSpin();
  }
  
  function runNextAutoSpin() {
    if (remainingSpins <= 0 || !autoSpinning) {
      autoSpinning = false;
      remainingSpins = 0;
      return;
    }
    
    // Start a single spin
    spin();
    
    // The determineWinner function will be called when the spin completes
    // We'll set a timeout there to trigger the next spin
  }
  
  function cancelAutoSpin() {
    autoSpinning = false;
    remainingSpins = 0;
    
    if (autoSpinTimeout) {
      clearTimeout(autoSpinTimeout);
      autoSpinTimeout = null;
    }
  }

  function determineWinner() {
    // The pointer is at top (3π/2), so we need to calculate which segment it's pointing to
    const pointerAngle = (3 * Math.PI / 2) - spinAngle;
    const normalizedAngle = pointerAngle < 0 ? pointerAngle + 2 * Math.PI : pointerAngle;
    
    let currentAngle = 0;
    
    for (const segment of wheelSegments) {
      if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + segment.size) {
        winner = segment.entry;
        // Add winner to history
        addWinnerToHistory(winner);
        break;
      }
      currentAngle += segment.size;
    }
    
    // Increment spin count
    spinCount++;
    
    // Add confetti effect when winner is determined
    if (winner) {
      createConfetti();
    }
    
    // Show winner after a short delay
    setTimeout(() => {
      showWinner = true;
      if (winner) {
        dispatch('winner', { winner });
      }
      
      // If auto-spinning, schedule the next spin after a 3-second delay
      if (autoSpinning && remainingSpins > 0) {
        remainingSpins--;
        
        if (remainingSpins > 0) {
          // Schedule next spin after 3 seconds
          autoSpinTimeout = setTimeout(() => {
            runNextAutoSpin();
          }, 3000);
        } else {
          // All done!
          autoSpinning = false;
        }
      }
    }, 500);
  }
  
  function addWinnerToHistory(winnerEntry: BaseLeaderboardEntry) {
    const existingWinner = winnersHistory.find(w => (w.entry as any).address === (winnerEntry as any).address);
    
    if (existingWinner) {
      existingWinner.count += 1;
    } else {
      winnersHistory = [...winnersHistory, {
        entry: winnerEntry,
        count: 1
      }];
    }
    
    // Sort by win count (highest first)
    winnersHistory = winnersHistory.sort((a, b) => b.count - a.count);
  }
  
  function exportWinnersToCSV() {
    const csvContent = winnersHistory.map((item, index) => {
      const entry = item.entry as any;
      const position = index + 1;
      const address = entry.address;
      const name = entry.nfd ? entry.nfd.replacementValue : address;
      const winCount = item.count;
      const points = entry[valueProperty];
      
      return `${position},"${address}","${name}",${winCount},${points}`;
    }).join('\n');

    const header = 'Position,Address,Name,Win Count,Points\n';
    const blob = new Blob([header + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'winners_list.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function createConfetti() {
    if (!ctx) return;
    // This would be a more complex animation, simplified for this example
    // In a real implementation, you might want to use a library like canvas-confetti
    console.log('🎉 Winner selected! 🎉');
  }

  function close() {
    dispatch('close');
  }

  function handleCanvasMouseMove(event: MouseEvent) {
    if (isSpinning || !canvas) return;
    
    // Get mouse position relative to canvas
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate distance from center
    const distanceFromCenter = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));
    
    // Only show tooltip if mouse is within the wheel but not too close to center
    if (distanceFromCenter <= radius && distanceFromCenter > 30) {
      // Calculate angle
      let angle = Math.atan2(mouseY - centerY, mouseX - centerX);
      if (angle < 0) angle += 2 * Math.PI;
      
      // Adjust angle based on current spin angle
      const adjustedAngle = (angle - spinAngle + 2 * Math.PI) % (2 * Math.PI);
      
      // Find the segment at this angle
      hoveredSegment = null;
      let currentAngle = 0;
      
      for (const segment of wheelSegments) {
        if (adjustedAngle >= currentAngle && adjustedAngle < currentAngle + segment.size) {
          hoveredSegment = segment;
          break;
        }
        currentAngle += segment.size;
      }
      
      if (hoveredSegment) {
        showTooltip = true;
        tooltipX = event.clientX;
        tooltipY = event.clientY;
        updateTooltip();
      } else {
        showTooltip = false;
      }
    } else {
      showTooltip = false;
    }
  }
  
  function handleCanvasMouseLeave() {
    showTooltip = false;
  }
  
  function updateTooltip() {
    if (!tooltipElement || !hoveredSegment) return;
    
    // Position tooltip
    tooltipElement.style.left = `${tooltipX + 15}px`;
    tooltipElement.style.top = `${tooltipY + 15}px`;
    tooltipElement.style.display = showTooltip ? 'block' : 'none';
    
    // Update tooltip content
    const entry = hoveredSegment.entry as any;
    let name = '';
    
    if (entry[nameProperty]) {
      if (typeof entry[nameProperty] === 'object' && entry[nameProperty].replacementValue) {
        name = entry[nameProperty].replacementValue;
      } else {
        name = entry[nameProperty];
      }
    } else {
      name = `User ${entries.indexOf(entry) + 1}`;
    }
    
    const address = entry.address ? 
      `${entry.address.substring(0, 6)}...${entry.address.substring(entry.address.length - 6)}` : 
      'Unknown';
    
    const points = formatNumber(entry[valueProperty]);
    
    tooltipElement.innerHTML = `
      <div class="font-bold">${name}</div>
      <div class="text-sm opacity-75">${address}</div>
      <div class="mt-1">${points} points</div>
    `;
  }
  
  // Function to hide tooltip explicitly
  function hideTooltip() {
    showTooltip = false;
    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
  }

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      if (ctx) {
        drawWheel();
        
        // Add mouse event listeners for tooltip
        canvas.addEventListener('mousemove', handleCanvasMouseMove);
        canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
        canvas.addEventListener('mouseout', hideTooltip);
        
        // Add document-level event listener to hide tooltip when mouse moves outside
        document.addEventListener('mousemove', (event) => {
          if (!canvas) return;
          
          // Check if mouse is inside canvas bounds
          const rect = canvas.getBoundingClientRect();
          if (
            event.clientX < rect.left || 
            event.clientX > rect.right || 
            event.clientY < rect.top || 
            event.clientY > rect.bottom
          ) {
            hideTooltip();
          }
        });
        
        // Create tooltip element
        tooltipElement = document.createElement('div');
        tooltipElement.className = 'absolute z-50 bg-gray-900 text-white text-sm p-2 rounded shadow-lg pointer-events-none';
        tooltipElement.style.display = 'none';
        document.body.appendChild(tooltipElement);
      }
    }

    return () => {
      if (requestId) {
        cancelAnimationFrame(requestId);
      }
      
      // Clean up event listeners and tooltip
      if (canvas) {
        canvas.removeEventListener('mousemove', handleCanvasMouseMove);
        canvas.removeEventListener('mouseleave', handleCanvasMouseLeave);
        canvas.removeEventListener('mouseout', hideTooltip);
      }
      
      document.removeEventListener('mousemove', () => {});
      
      if (tooltipElement && tooltipElement.parentNode) {
        tooltipElement.parentNode.removeChild(tooltipElement);
      }
    };
  });
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" transition:fade={{ duration: 200 }}>
  <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-5xl w-full mx-4 shadow-2xl" transition:fly={{ y: 20, duration: 300 }}>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-2xl font-bold">Prize Drawing</h2>
      <div class="flex items-center gap-3">
        <div class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm flex items-center">
          <i class="fas fa-sync-alt mr-1"></i>
          <span>Spins: {spinCount}</span>
        </div>
        {#if autoSpinning}
          <div class="px-3 py-1 bg-yellow-100 dark:bg-yellow-700 rounded-full text-sm flex items-center">
            <i class="fas fa-cog fa-spin mr-1"></i>
            <span>Auto: {remainingSpins} left</span>
          </div>
        {/if}
        <button 
          on:click={close}
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <i class="fas fa-times text-xl"></i>
        </button>
      </div>
    </div>
    
    <div class="flex flex-col md:flex-row gap-6">
      <!-- Left column - Wheel -->
      <div class="md:w-1/2 flex flex-col items-center">
        <canvas 
          bind:this={canvas} 
          width={canvasWidth} 
          height={canvasHeight}
          class="max-w-full h-auto"
        ></canvas>
        
        <div class="flex gap-3 mt-4">
          {#if autoSpinning}
            <button 
              on:click={cancelAutoSpin}
              class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <i class="fas fa-stop mr-1"></i> Stop Auto-Spin
            </button>
          {:else}
            <button 
              on:click={spin} 
              disabled={isSpinning || autoSpinning}
              class={`px-6 py-3 ${colorScheme === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 
                      colorScheme === 'green' ? 'bg-green-500 hover:bg-green-600' :
                      colorScheme === 'amber' ? 'bg-amber-500 hover:bg-amber-600' :
                      colorScheme === 'pink' ? 'bg-pink-500 hover:bg-pink-600' :
                      'bg-blue-500 hover:bg-blue-600'} disabled:opacity-50 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl`}
            >
              {isSpinning ? 'Spinning...' : 'Spin Once'}
            </button>
            
            <button 
              on:click={startAllSpins}
              disabled={isSpinning || autoSpinning}
              class="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <i class="fas fa-play-circle mr-1"></i> Start All (25)
            </button>
          {/if}
        </div>
      </div>
      
      <!-- Right column - Info and Winner -->
      <div class="md:w-1/2">
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
          <p>Spin the wheel to select a winner! Each participant's chance is proportional to their earned points.</p>
        </div>
        
        <!-- Winners List -->
        <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex flex-col h-1/2">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-semibold">Winners List</h3>
            <button 
              on:click={exportWinnersToCSV}
              disabled={winnersHistory.length === 0}
              class="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-md disabled:opacity-50 transition-colors"
            >
              <i class="fas fa-download mr-1"></i> Export CSV
            </button>
          </div>
          
          {#if winnersHistory.length > 0}
            <div class="flex-1 overflow-y-auto" style="max-height: calc(100vh - 400px);">
              {#each winnersHistory as item, i}
                <div class="flex items-center py-1">
                  <span class="w-6">{i+1}.</span>
                  {#if (item.entry as any).nfd}
                    <span class="flex-1 truncate">{(item.entry as any).nfd.replacementValue}</span>
                  {:else}
                    <span class="flex-1 truncate font-mono text-xs">{(item.entry as any).address.slice(0, 8)}...</span>
                  {/if}
                  <span class="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 rounded-full text-xs">
                    {item.count} {item.count === 1 ? 'win' : 'wins'}
                  </span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="py-6 text-center text-gray-500">
              <i class="fas fa-trophy text-2xl mb-2 opacity-30"></i>
              <p>No winners yet. Spin the wheel to start!</p>
            </div>
          {/if}
        </div>
        
        {#if winner && showWinner}
          <div class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg animate-pulse">
            <h3 class="text-xl font-bold text-green-600 dark:text-green-400">Winner!</h3>
            <div class="flex items-center gap-2 mt-2">
              {#if (winner as any).nfd}
                {#if (winner as any).nfd.avatar}
                  <img src={(winner as any).nfd.avatar} alt={(winner as any).nfd.replacementValue} class="w-10 h-10 rounded-full" />
                {:else}
                  <img src="/blank_avatar_small.png" alt={(winner as any).address} class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50" />
                {/if}
                <span class="font-medium">{(winner as any).nfd.replacementValue}</span>
              {:else}
                <img src="/blank_avatar_small.png" alt={(winner as any).address} class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50" />
                <span class="font-mono text-sm">{(winner as any).address.slice(0, 12)}...{(winner as any).address.slice(-12)}</span>
              {/if}
            </div>
            <p class="mt-2">{formatNumber((winner as any)[valueProperty])} points</p>
          </div>
        {/if}
        
      </div>
    </div>
  </div>
</div> 