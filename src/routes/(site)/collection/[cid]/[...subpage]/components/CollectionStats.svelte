<script lang="ts">
  export let isMinting: boolean;
  export let totalMinted: number;
  export let maxSupply: number;
  export let mintProgress: string;
  export let launchEnd: number;
  export let floor: string;
  export let ceiling: string;
  export let totalTokenCount: number;
  export let burnedTokenCount: number;
  export let onSubpageChange: (tab: string) => void;
  export let tabSortDirections: Record<string, 'asc' | 'desc'>;
  export let collection: any;
  export let mintDate: string | null;
  export let mintDateTime: string | null;
  export let openExplorer: (round: number) => void;
  export let wlLaunchStart: number;
  export let wlPrice: number | null;
  export let launchStart: number;
  export let publicPrice: number | null;
  export let formatDateTime: (timestamp: number) => string | null;
  export let uniqueCollectors: number;

</script>
<div class="flex flex-row pl-4 mt-auto w-full pt-4 bg-gray-400 dark:bg-black bg-opacity-50">
  <div class="flex flex-row justify-between w-full mx-4 flex-wrap gap-y-2">
    {#if isMinting}
      <div class="w-full mb-3">
        <div class="flex justify-between items-center text-sm mb-1.5">
          <span class="font-medium">Mint Progress</span>
          <span class="text-blue-800 dark:text-blue-300">{totalMinted} / {maxSupply} ({mintProgress}%)</span>
        </div>
        <div class="w-full bg-gray-700 dark:bg-gray-800 bg-opacity-50 rounded-full h-2">
          <div class="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 relative" style="width: {mintProgress}%">
            <div class="absolute -right-1 -top-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
          </div>
        </div>
        {#if launchEnd > 0}
          <div class="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
            Mint Ends: {new Date(launchEnd * 1000).toLocaleString()}
          </div>
        {/if}
      </div>
    {/if}
    <div class="w-1/3 md:w-auto text-center md:text-left">
      <div class="text-sm">Floor</div>
      <button class="text-lg text-blue-800 dark:text-blue-300 cursor-pointer hover:text-blue-900 dark:hover:text-blue-200 transition-colors" 
        on:click={() => {
          tabSortDirections.forsale = 'asc';
          onSubpageChange('forsale');
        }}>
        {floor}
      </button>
    </div>
    <div class="w-1/3 md:w-auto text-center md:text-left">
      <div class="text-sm">Ceiling</div>
      <button class="text-lg text-blue-800 dark:text-blue-300 cursor-pointer hover:text-blue-900 dark:hover:text-blue-200 transition-colors" 
        on:click={() => {
          tabSortDirections.forsale = 'desc';
          onSubpageChange('forsale');
        }}>
        {ceiling}
      </button>
    </div>
    <div class="tooltip w-1/3 md:w-auto text-center md:text-left">
      <div class="text-sm">Tokens</div>
      <button class="text-lg text-blue-800 dark:text-blue-300 cursor-pointer hover:text-blue-900 dark:hover:text-blue-200 transition-colors" 
        on:click={() => onSubpageChange('tokens')}>
        {totalTokenCount ? (totalTokenCount - burnedTokenCount) : '-'}
      </button>
      <div class="tooltiptext flex flex-col space-y-1 w-auto whitespace-nowrap p-2 bg-slate-700">
        <div>Original Supply: {totalTokenCount ?? '-'}</div>
        <div>Tokens Burned: {burnedTokenCount ?? '0'}</div>
        <div>Tokens Remaining: {totalTokenCount ? (totalTokenCount - burnedTokenCount) : '-'}</div>
      </div>
    </div>
    <div class="w-1/3 md:w-auto text-center md:text-left">
      <div class="text-sm">Collectors</div>
      <button class="text-lg text-blue-800 dark:text-blue-300 cursor-pointer hover:text-blue-900 dark:hover:text-blue-200 transition-colors" 
        on:click={() => onSubpageChange('collectors')}>
        {uniqueCollectors}
      </button>
    </div>
    <div class="w-1/3 md:w-auto text-center md:text-left">
      <div class="text-sm">Minted</div>
      <div class="text-lg text-blue-800 dark:text-blue-300">
        <button class="tooltip cursor-pointer" on:click={() => collection?.mintRound && openExplorer(collection.mintRound)}>
          {mintDate ?? '-'}
          {#if mintDateTime}
            <div class="tooltiptext w-[400px] p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-xl">
              <div class="text-base font-semibold mb-3 text-white border-b border-gray-700 pb-2">Collection Details</div>
              <!-- Collection Creation -->
              <div class="mb-4">
                <div class="text-xs text-gray-400 mb-1">Collection Created</div>
                <div class="flex items-center gap-2 text-sm text-gray-200">
                  <i class="fas fa-calendar text-blue-400"></i>
                  <span>{mintDateTime}</span>
                </div>
                <div class="flex items-center gap-2 text-sm text-gray-200 mt-1">
                  <i class="fas fa-cube text-blue-400"></i>
                  <span>Block #{collection?.mintRound}</span>
                </div>
              </div>
              <!-- Mint Phases -->
              <div class="space-y-3">
                {#if wlLaunchStart}
                  <div>
                    <div class="text-xs text-gray-400 mb-1">Whitelist Launch Phase</div>
                    <div class="bg-gray-900 rounded p-2">
                      <div class="flex justify-between items-center text-sm">
                        <div class="flex items-center gap-2 text-gray-200">
                          <i class="fas fa-clock text-purple-400"></i>
                          <span>{formatDateTime(wlLaunchStart)}</span>
                        </div>
                        {#if wlPrice}
                          <div class="flex items-center gap-2 text-gray-200">
                            <i class="fas fa-tag text-purple-400"></i>
                            <span>{wlPrice.toLocaleString()} VOI</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}
                {#if launchStart}
                  <div>
                    <div class="text-xs text-gray-400 mb-1">Public Launch Phase</div>
                    <div class="bg-gray-900 rounded p-2">
                      <div class="flex justify-between items-center text-sm">
                        <div class="flex items-center gap-2 text-gray-200">
                          <i class="fas fa-clock text-green-400"></i>
                          <span>{formatDateTime(launchStart)}</span>
                        </div>
                        {#if publicPrice}
                          <div class="flex items-center gap-2 text-gray-200">
                            <i class="fas fa-tag text-green-400"></i>
                            <span>{publicPrice.toLocaleString()} VOI</span>
                          </div>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
              <div class="text-[10px] text-blue-400 mt-3 text-center">Click to view creation block in explorer</div>
            </div>
          {/if}
        </button>
      </div>
    </div>
    <div class="w-1/3 md:w-auto text-center md:text-left">
      <div class="text-sm">Creator</div>
      <div class="text-lg text-blue-800 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-200"><a href={'/creator/' + collection?.creator}>{collection?.creatorName ?? collection?.creator?.substring(0,8) + '...'}</a></div>
    </div>
  </div>
</div>

<style>
  .tooltip {
    position: relative;
    display: inline-block;
  }
  .tooltip .tooltiptext {
    visibility: hidden;
    border-radius: 6px;
    position: absolute;
    z-index: 100;
    bottom: 125%;
    left: 50%;
    margin-left: -60px;
    opacity: 0;
    transition: opacity 0.3s;
  }
  .tooltip:hover .tooltiptext {
    visibility: visible;
    opacity: 1;
  }
  @media (max-width: 768px) {
    .tooltip .tooltiptext {
      left: 0;
      margin-left: 0;
      width: 100%;
    }
  }
</style> 