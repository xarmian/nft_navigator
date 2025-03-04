<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { formatNumber } from '$lib/utils/format';
  import { fly, fade } from 'svelte/transition';
  import type { BaseLeaderboardEntry } from './types';

  export let entries: BaseLeaderboardEntry[] = []; // This will accept different entry types from different leaderboards
  export let valueProperty: string = 'totalProfit'; // Property to use for ticket allocation (e.g., totalProfit, volume)
  export let nameProperty: string = 'nfd'; // Property to display on wheel (can be nfd object or string)
  export let colorScheme: 'blue' | 'green' | 'amber' | 'pink' = 'blue'; // To allow different colors per leaderboard

  // Define interface for raffle tickets
  interface RaffleParticipant {
    entry: BaseLeaderboardEntry;
    tickets: number;
    percentage: number;
    color: string;
  }

  const dispatch = createEventDispatcher<{
    close: void;
    winner: { winner: BaseLeaderboardEntry };
  }>();
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let canvasWidth = 500;
  let canvasHeight = 300;
  
  let isDrawing = false;
  let winner: BaseLeaderboardEntry | null = null;
  let animationSpeed = 20; // ms between ticket draws
  let animationStep = 0;
  let regularTicketsStep = 0; // Separate counter for regular tickets
  let requestId: number;
  let showWinner = false;
  let ticketsArray: { participant: RaffleParticipant, ticketNumber: number }[] = [];
  let currentTicket = 0;
  let winningTicket = 0;
  let totalTickets = 0;
  let animationPhase = 'initial'; // 'initial', 'winning', 'complete'
  
  // Auto-draw variables
  let autoDrawing = false;
  let remainingDraws = 0;
  let autoDrawTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Track winners history
  let winnersHistory: {entry: BaseLeaderboardEntry, count: number}[] = [];
  
  // Track total draws
  let drawCount = 0;

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

  // Create array of participants with their tickets
  $: raffleParticipants = createRaffleParticipants();
  $: showBigDrum = !isDrawing && !winner;

  function createRaffleParticipants(): RaffleParticipant[] {
    if (!entries.length) return [];
    
    // Calculate total value across all entries
    const total = entries.reduce((sum, entry) => {
      const value = (entry as any)[valueProperty] || 0;
      return sum + Math.max(value, 0); // Ensure no negative values
    }, 0);
    
    if (total === 0) return [];
    
    // Create participants with their percentage of tickets
    const participants = entries.map((entry, i) => {
      const value = (entry as any)[valueProperty] || 0;
      const percentage = value / total;
      
      return {
        entry,
        tickets: Math.round(value),
        percentage,
        color: rainbowColors[i % rainbowColors.length]
      };
    });
    
    // Sort by percentage (highest first)
    return participants.sort((a, b) => b.percentage - a.percentage);
  }

  function createTicketsArray() {
    ticketsArray = [];
    totalTickets = 0;
    
    // Create an array with one entry per ticket
    raffleParticipants.forEach(participant => {
      for (let i = 0; i < participant.tickets; i++) {
        ticketsArray.push({
          participant,
          ticketNumber: totalTickets++
        });
      }
    });
    
    // Shuffle the tickets array
    for (let i = ticketsArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ticketsArray[i], ticketsArray[j]] = [ticketsArray[j], ticketsArray[i]];
    }
  }

  function addWinnerToHistory(winner: BaseLeaderboardEntry | null) {
    if (!winner) return;
    
    const existing = winnersHistory.find(item => 
      item.entry.address === winner.address
    );
    
    if (existing) {
      existing.count += 1;
      winnersHistory = [...winnersHistory]; // Trigger reactivity
    } else {
      winnersHistory = [...winnersHistory, { entry: winner, count: 1 }];
    }
  }

  onMount(() => {
    if (canvas) {
      ctx = canvas.getContext('2d');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      drawRaffleDrum();
    }
    
    createTicketsArray();
    
    return () => {
      if (requestId) {
        cancelAnimationFrame(requestId);
      }
      
      if (autoDrawTimeout) {
        clearTimeout(autoDrawTimeout);
      }
    };
  });

  function drawRaffleDrum() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw drum
    ctx.beginPath();
    ctx.ellipse(canvasWidth / 2, canvasHeight / 2, 150, 100, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#f5f5f5';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw grid pattern on drum
    ctx.beginPath();
    for (let i = -150; i <= 150; i += 30) {
      // Horizontal lines
      ctx.moveTo(canvasWidth / 2 - 150, canvasHeight / 2 + i);
      ctx.lineTo(canvasWidth / 2 + 150, canvasHeight / 2 + i);
      
      // Vertical lines
      ctx.moveTo(canvasWidth / 2 + i, canvasHeight / 2 - 100);
      ctx.lineTo(canvasWidth / 2 + i, canvasHeight / 2 + 100);
    }
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw tickets inside (if in big drum view)
    if (showBigDrum) {
      const ticketColors: string[] = [];
      raffleParticipants.forEach(participant => {
        for (let i = 0; i < participant.tickets; i++) {
          ticketColors.push(participant.color);
        }
      });
      
      // Shuffle colors
      for (let i = ticketColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ticketColors[i], ticketColors[j]] = [ticketColors[j], ticketColors[i]];
      }
      
      // Draw up to 100 tickets for visual effect
      const maxTickets = Math.min(ticketColors.length, 100);
      for (let i = 0; i < maxTickets; i++) {
        const x = canvasWidth / 2 + (Math.random() * 240 - 120);
        const y = canvasHeight / 2 + (Math.random() * 160 - 80);
        const width = 20 + Math.random() * 15;
        const height = 10 + Math.random() * 5;
        const angle = Math.random() * Math.PI * 2;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        
        // Draw ticket
        ctx.beginPath();
        ctx.rect(-width/2, -height/2, width, height);
        ctx.fillStyle = ticketColors[i];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
      }
    }
    
    // Draw ticket count text directly on the drum (no overlay)
    if (totalTickets > 0) {
      // Add a subtle highlight for better text visibility
      ctx.beginPath();
      ctx.arc(canvasWidth / 2, canvasHeight / 2, 40, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      
      // Draw text
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#555';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${totalTickets} tickets`, canvasWidth / 2, canvasHeight / 2);
    }
  }

  function drawRaffleAnimation() {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw drum (smaller during animation)
    ctx.beginPath();
    ctx.ellipse(150, canvasHeight / 2, 100, 70, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#f5f5f5';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw grid pattern
    ctx.beginPath();
    for (let i = -100; i <= 100; i += 20) {
      ctx.moveTo(50, canvasHeight / 2 + i);
      ctx.lineTo(250, canvasHeight / 2 + i);
      ctx.moveTo(150 + i, canvasHeight / 2 - 70);
      ctx.lineTo(150 + i, canvasHeight / 2 + 70);
    }
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Draw tickets shuffling in drum - always use regularTicketsStep for consistent speed
    const numVisibleTickets = Math.min(10, totalTickets);
    for (let i = 0; i < numVisibleTickets; i++) {
      const index = (currentTicket + i) % totalTickets;
      
      // Skip the winning ticket if we're in the winning phase
      if (animationPhase !== 'initial' && index === winningTicket) continue;
      
      // Use regularTicketsStep which always increments at the same rate
      const x = 150 + (Math.sin((regularTicketsStep + i * 30) / 10) * 60);
      const y = canvasHeight / 2 + (Math.cos((regularTicketsStep + i * 20) / 15) * 40);
      const width = 20;
      const height = 10;
      const angle = (regularTicketsStep + i * 40) / 20;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // Draw ticket
      ctx.beginPath();
      ctx.rect(-width/2, -height/2, width, height);
      ctx.fillStyle = ticketsArray[index].participant.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Draw selection mechanism
    ctx.beginPath();
    ctx.rect(300, canvasHeight / 2 - 50, 150, 100);
    ctx.fillStyle = '#333';
    ctx.fill();
    
    // Draw ticket counter
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (animationPhase === 'initial') {
      // Show counter changing rapidly
      const randomTicket = Math.floor(Math.random() * totalTickets);
      ctx.fillText(`Ticket #${randomTicket}`, 375, canvasHeight / 2);
    } else {
      // Show final winning ticket
      ctx.fillText(`Ticket #${winningTicket}`, 375, canvasHeight / 2);
    }
    
    // Draw connection tube
    ctx.beginPath();
    ctx.moveTo(250, canvasHeight / 2);
    ctx.lineTo(300, canvasHeight / 2);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 20;
    ctx.stroke();
    
    // Draw moving winning ticket if in winning phase
    if (animationPhase !== 'initial') {
      // Use a smaller divisor to complete the animation in fewer steps
      // Changed from /15 to /5 to make it move through full distance in just 5 steps
      const progress = Math.min(1, (animationStep - 50) / 5);
      const x = 250 + progress * 50;
      const y = canvasHeight / 2;
      const width = 20;
      const height = 10;
      
      ctx.save();
      ctx.translate(x, y);
      
      // Draw winning ticket
      ctx.beginPath();
      ctx.rect(-width/2, -height/2, width, height);
      ctx.fillStyle = winner ? (ticketsArray.find(t => t.ticketNumber === winningTicket)?.participant.color || '#FF5252') : '#FF5252';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.restore();
    }
  }

  function startDraw() {
    if (isDrawing || entries.length === 0 || totalTickets === 0) return;
    
    isDrawing = true;
    showWinner = false;
    winner = null;
    animationStep = 0;
    regularTicketsStep = 0; // Reset regular tickets step
    animationPhase = 'initial';
    
    // Select a winner
    winningTicket = Math.floor(Math.random() * totalTickets);
    const winningEntry = ticketsArray.find(t => t.ticketNumber === winningTicket);
    
    if (winningEntry) {
      winner = winningEntry.participant.entry;
    }
    
    // Start animation
    requestId = requestAnimationFrame(animateRaffle);
  }

  function animateRaffle() {
    if (!isDrawing) return;
    
    // Slow down the ticket animation speed inside the drum
    regularTicketsStep += 1.5; // Reduced from 3 to 1.5 to make tickets move more slowly
    
    // Update main animation step
    animationStep += 1;
    
    // Check for phase transitions
    if (animationStep === 50) {
      animationPhase = 'winning';
    } else if (animationStep >= 55) { // Changed from 65 to 55 to make winning phase much shorter (just 5 steps)
      animationPhase = 'complete';
    }
    
    // Draw the current animation frame
    drawRaffleAnimation();
    
    // If animation is complete
    if (animationPhase === 'complete') {
      // Animation complete
      isDrawing = false;
      
      // Determine winner if not already set
      if (!winner && ticketsArray.length > 0) {
        const winningEntry = ticketsArray.find(t => t.ticketNumber === winningTicket);
        if (winningEntry) {
          winner = winningEntry.participant.entry;
        }
      }
      
      // Add winner to history
      if (winner) {
        addWinnerToHistory(winner);
        drawCount++;
        
        // Dispatch winner event
        setTimeout(() => {
          showWinner = true;
          
          // Fix for linter error - only dispatch if winner is not null
          if (winner) {
            dispatch('winner', { winner });
          }
          
          // Schedule next draw if auto-drawing
          if (autoDrawing && remainingDraws > 0) {
            remainingDraws--;
            
            if (remainingDraws > 0) {
              autoDrawTimeout = setTimeout(() => {
                startDraw();
              }, 3000); // 3 second delay before next draw
            } else {
              autoDrawing = false;
            }
          }
        }, 500);
      }
      
      return;
    }
    
    // Continue animation
    requestId = requestAnimationFrame(animateRaffle);
  }
  
  function startAllDraws() {
    if (isDrawing || autoDrawing) return;
    
    autoDrawing = true;
    remainingDraws = 25; // 25 draws
    startDraw();
  }
  
  function cancelAutoDraws() {
    autoDrawing = false;
    remainingDraws = 0;
    
    if (autoDrawTimeout) {
      clearTimeout(autoDrawTimeout);
      autoDrawTimeout = null;
    }
  }

  function exportWinnersToCSV() {
    if (winnersHistory.length === 0) return;
    
    // Create CSV content
    const csvContent = winnersHistory.map((item, i) => {
      const position = i + 1;
      const address = item.entry.address;
      const name = (item.entry as any).nfd ? (item.entry as any).nfd.replacementValue : address;
      const wins = item.count;
      const points = (item.entry as any)[valueProperty] || 0;
      
      return `${position},"${address}","${name}",${wins},${points}`;
    }).join('\n');
    
    const header = 'Position,Address,Name,Wins,Points\n';
    const blob = new Blob([header + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'raffle_winners.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function closeModal() {
    if (isDrawing || autoDrawing) {
      // Stop all animations
      if (requestId) {
        cancelAnimationFrame(requestId);
      }
      
      if (autoDrawTimeout) {
        clearTimeout(autoDrawTimeout);
      }
    }
    
    dispatch('close');
  }

  function createConfetti() {
    // This function would create a confetti effect when a winner is determined
    // For simplicity, we're omitting the confetti implementation
  }
</script>

<div 
  class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75 p-4"
  transition:fade={{ duration: 200 }}
>
  <div 
    class="bg-white dark:bg-gray-800 w-full max-w-6xl rounded-lg shadow-xl overflow-hidden"
    transition:fly={{ y: 20, duration: 300 }}
  >
    <div class="p-4 flex justify-between items-center border-b">
      <div class="flex items-center">
        <h2 class="text-xl font-bold">Raffle Draw</h2>
        <div 
          class="ml-3 flex items-center bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full"
          title="Total number of completed draws"
        >
          <i class="fas fa-sync-alt animate-spin-slow mr-1"></i>
          <span>{drawCount}</span>
        </div>
      </div>
      <button 
        on:click={closeModal} 
        class="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
      >
        <i class="fas fa-times text-xl"></i>
      </button>
    </div>
    
    <div class="p-6 md:flex gap-6">
      <!-- Left column - Raffle Draw and Winner -->
      <div class="md:w-1/2 mb-6 md:mb-0">
        <div class="relative bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg overflow-hidden" style="min-height: 300px;">
          <canvas 
            bind:this={canvas}
            class="w-full h-auto"
          ></canvas>
        </div>
        
        <!-- Winner Display (Moved to left column) -->
        {#if winner && showWinner}
          <div class="mt-4 py-2 px-3 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center">
            <div class="mr-3">
              <div class="text-green-600 dark:text-green-400 font-bold text-lg">Winner!</div>
            </div>
            <div class="flex items-center flex-1">
              {#if (winner as any).nfd}
                {#if (winner as any).nfd.avatar}
                  <img src={(winner as any).nfd.avatar} alt={(winner as any).nfd.replacementValue} class="w-8 h-8 rounded-full mr-2" />
                {:else}
                  <img src="/blank_avatar_small.png" alt={(winner as any).address} class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50 mr-2" />
                {/if}
                <div class="flex-1">
                  <div class="font-medium">{(winner as any).nfd.replacementValue}</div>
                  <div class="text-sm text-green-700 dark:text-green-300">{formatNumber((winner as any)[valueProperty])} points</div>
                </div>
              {:else}
                <img src="/blank_avatar_small.png" alt={(winner as any).address} class="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 dark:opacity-50 mr-2" />
                <div class="flex-1">
                  <div class="font-mono text-sm">{(winner as any).address.slice(0, 8)}...{(winner as any).address.slice(-4)}</div>
                  <div class="text-sm text-green-700 dark:text-green-300">{formatNumber((winner as any)[valueProperty])} points</div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
        
        <div class="mt-4 text-center">
          <div class="text-sm mb-4 min-h-6">
            {#if autoDrawing}
              <div class="text-purple-600 font-medium flex justify-center items-center">
                <i class="fas fa-sync-alt animate-spin mr-2"></i>
                Auto-drawing: {remainingDraws} draws remaining
              </div>
            {:else if isDrawing}
              <div class="text-blue-600 font-medium">
                Drawing winner...
              </div>
            {:else if winner && showWinner}
              <div class="text-green-600 font-medium">
                Winner selected! Draw again?
              </div>
            {/if}
          </div>
          
          {#if autoDrawing}
            <button 
              on:click={cancelAutoDraws}
              class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <i class="fas fa-stop mr-1"></i> Stop Auto-Draw
            </button>
          {:else}
            <button 
              on:click={startDraw} 
              disabled={isDrawing || autoDrawing || totalTickets === 0}
              class={`px-6 py-3 ${colorScheme === 'blue' ? 'bg-blue-500 hover:bg-blue-600' : 
                      colorScheme === 'green' ? 'bg-green-500 hover:bg-green-600' :
                      colorScheme === 'amber' ? 'bg-amber-500 hover:bg-amber-600' :
                      colorScheme === 'pink' ? 'bg-pink-500 hover:bg-pink-600' :
                      'bg-blue-500 hover:bg-blue-600'} disabled:opacity-50 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl`}
            >
              {isDrawing ? 'Drawing...' : 'Draw Once'}
            </button>
            
            <button 
              on:click={startAllDraws}
              disabled={isDrawing || autoDrawing || totalTickets === 0}
              class="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              <i class="fas fa-play-circle mr-1"></i> Draw All (25)
            </button>
          {/if}
        </div>
      </div>
      
      <!-- Right column - Info and Winners List -->
      <div class="md:w-1/2">
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
          <p>Draw a ticket to select a winner! Each participant has tickets proportional to their earned points.</p>
        </div>
        
        <!-- Participants List -->
        <div class="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 class="font-semibold mb-2">Participants</h3>
          <div class="max-h-40 overflow-y-auto">
            {#each raffleParticipants as participant, i}
              <div class="flex items-center justify-between py-1 text-sm">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full" style="background-color: {participant.color};"></div>
                  {#if (participant.entry as any).nfd}
                    <span class="truncate max-w-[150px]">{(participant.entry as any).nfd.replacementValue}</span>
                  {:else}
                    <span class="truncate max-w-[150px] font-mono text-xs">{(participant.entry as any).address.slice(0, 8)}...</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs opacity-75">{(participant.percentage * 100).toFixed(1)}%</span>
                  <span class="font-medium">{participant.tickets} tickets</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
        
        <!-- Winners List Section: Fixed height to prevent layout shifts -->
        <div class="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
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
          
          <div class="h-64 overflow-y-auto">
            {#if winnersHistory.length > 0}
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
            {:else}
              <div class="py-6 text-center text-gray-500">
                <i class="fas fa-ticket-alt text-2xl mb-2 opacity-30"></i>
                <p>No winners yet. Draw a ticket to start!</p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </div>
</div> 