<script lang="ts">
  // Components
  import TokenDetail from '$lib/component/ui/TokenDetail.svelte';
  import SalesTable from '$lib/component/ui/SalesTable.svelte';
  import HoldersList from '$lib/component/ui/HoldersList.svelte';
  import LoungeView from '$lib/component/ui/LoungeView.svelte';
  import CollectionAnalytics from './CollectionAnalytics.svelte';
  import CollectionControls from './CollectionControls.svelte';
  import { inview } from 'svelte-inview';

  // Props for navigation and content
  export let views: any[];
  export let currentView: string;
  export let setView: (viewId: string) => void;
  export let sortDirection: 'asc' | 'desc';
  export let filteredTokens: any[];
  export let displayCount: number;
  export let loading: boolean;
  export let searchText: string;
  export let categories: Record<string, any>;
  export let filters: Record<string, any>;
  export let tokens: any[];
  export let collection: any;
  export let contractId: string | number;
  export let setSearchText: (v: string) => void;
  export let setFilter: (trait: string, value: string) => void;
  export let setSortDirection: (dir: 'asc' | 'desc') => void;
  export let isMobile: boolean;
  export let onLoadMore: () => void;
  export let rawCollectors: any[];
  
  // Mobile grid columns state
  let mobileGridColumns: 1 | 2 = 2;
  
  // Function to set mobile grid columns
  function setMobileGridColumns(cols: 1 | 2) {
    mobileGridColumns = cols;
  }
  
  // Mobile dropdown state
  let isDropdownOpen = false;
  
  // Function to toggle dropdown on mobile
  function toggleDropdown() {
    isDropdownOpen = !isDropdownOpen;
  }
  
  // Function to set the view and close the dropdown
  function selectView(viewId: string) {
    setView(viewId);
    isDropdownOpen = false;
  }
  
  // Scroll to active tab on mobile when view changes
  let tabsContainer: HTMLElement;
  let activeTabElement: HTMLElement | null = null;
  
  // Action to set active tab reference
  function setActiveTab(node: HTMLElement, isActive: boolean) {
    if (isActive) {
      activeTabElement = node;
    }
    
    return {
      update(isActive: boolean) {
        if (isActive) {
          activeTabElement = node;
        } else if (activeTabElement === node) {
          activeTabElement = null;
        }
      },
      destroy() {
        if (activeTabElement === node) {
          activeTabElement = null;
        }
      }
    };
  }
  
  $: if (tabsContainer && activeTabElement && isMobile) {
    const containerWidth = tabsContainer.offsetWidth;
    const tabLeft = activeTabElement.offsetLeft;
    const tabWidth = activeTabElement.offsetWidth;
    
    // Center the active tab in the scrollable container
    tabsContainer.scrollLeft = tabLeft - (containerWidth / 2) + (tabWidth / 2);
  }

  // Calculate ideal tab width based on number of tabs
  $: tabCount = views.length;
  $: tabWidth = Math.min(Math.max(100, Math.floor(800 / tabCount)), 150);
</script>

<!-- Mobile Dropdown (alternative to tabs for very small screens) -->
<div class="lg:hidden mb-4">
  <div class="relative">
    <button 
      class="w-full flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200"
      on:click={toggleDropdown}
    >
      <div class="flex items-center">
        {#if currentView === 'tokens'}
          <svg class="h-5 w-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        {:else if currentView === 'forsale'}
          <svg class="h-5 w-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        {:else if currentView === 'collectors'}
          <svg class="h-5 w-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        {:else}
          <svg class="h-5 w-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        {/if}
        {views.find(v => v.id === currentView)?.name || 'View'}
      </div>
      <svg class="w-5 h-5 transform transition-transform duration-200 {isDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    {#if isDropdownOpen}
      <div class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-60 overflow-y-auto">
        {#each views as view}
          <button 
            class="w-full text-left px-4 py-2.5 {currentView === view.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'} flex items-center justify-between"
            on:click={() => selectView(view.id)}
          >
            <div class="flex items-center">
              {#if view.id === 'tokens'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              {:else if view.id === 'forsale'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              {:else if view.id === 'ranking'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              {:else if view.id === 'transactions'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              {:else if view.id === 'collectors'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              {:else if view.id === 'burned'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              {:else if view.id === 'mine'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              {:else if view.id === 'analytics'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              {:else if view.id === 'feed'}
                <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
              {/if}
              <span>{view.name}</span>
            </div>
            {#if view.count !== undefined}
              <span class="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full">
                {view.count}
              </span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Tabs for desktop and tablet - with flex-wrap and no horizontal scrolling -->
<div class="hidden lg:block mb-6">
  <div 
    class="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl shadow-sm max-w-5xl mx-auto"
    bind:this={tabsContainer}
  >
    <div class="flex flex-wrap justify-center gap-2">
      {#each views as view}
        <button
          use:setActiveTab={currentView === view.id}
          class="relative px-3 py-2.5 rounded-lg font-medium transition-all duration-200 min-w-[85px]
            {currentView === view.id
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-600/70 hover:text-blue-500 dark:hover:text-blue-300'}"
          on:click={() => setView(view.id)}
          aria-current={currentView === view.id ? 'page' : undefined}
        >
          <div class="flex items-center flex-col gap-1.5 text-sm">
            <div class="flex items-center gap-1 relative">
            {#if view.id === 'tokens'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
              </svg>
            {:else if view.id === 'forsale'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            {:else if view.id === 'ranking'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            {:else if view.id === 'transactions'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            {:else if view.id === 'collectors'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            {:else if view.id === 'burned'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            {:else if view.id === 'mine'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            {:else if view.id === 'analytics'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            {:else if view.id === 'feed'}
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            {/if}
            {#if view.count !== undefined}
            <div class="absolute -top-2 -right-7 h-6 w-6 border border-amber-400 dark:border-amber-600 flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              {view.count}
            </div>
          {/if}
            </div>
            <span>{view.name}</span>
          </div>
          
        </button>
      {/each}
    </div>
  </div>
</div>

<!-- Main Content Area -->
<div class="flex flex-col w-full">
  {#if currentView === 'tokens' || currentView === 'forsale' || currentView === 'burned' || currentView === 'ranking' || currentView === 'mine'}
    <div class="flex flex-col md:flex-row gap-3 w-full">
      <!-- Controls Section -->
      <div class="md:w-64 flex-shrink-0">
        <CollectionControls
          {searchText}
          setSearchText={setSearchText}
          {filters}
          setFilter={setFilter}
          {sortDirection}
          setSortDirection={setSortDirection}
          availableTraits={categories}
          {isMobile}
          {mobileGridColumns}
          {setMobileGridColumns}
        />
      </div>
      
      <!-- Token Grid Section -->
      <div class="flex-1">
        {#if filteredTokens.length > 0}
          <div class="grid gap-3 {isMobile ? (mobileGridColumns === 1 ? 'grid-cols-1' : 'grid-cols-2') : ''} sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {#each filteredTokens.slice(0, displayCount) as token (token.tokenId)}
              <div class="w-full">
                <TokenDetail {collection} token={token} format="small" />
              </div>
            {/each}
          </div>
          
          {#if filteredTokens.length > displayCount}
            <div class="mt-6 flex justify-center">
              <button 
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md shadow-sm flex items-center gap-2 transition-colors duration-200"
                on:click={onLoadMore}
                disabled={loading}
              >
                {#if loading}
                  <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading more...
                {:else}
                  Load More
                {/if}
              </button>
            </div>
          {/if}
        {:else if loading}
          <div class="w-full flex justify-center items-center py-8">
            <div class="animate-pulse flex space-x-4">
              <div class="rounded-full bg-slate-700 h-10 w-10"></div>
              <div class="flex-1 space-y-6 py-1 max-w-md">
                <div class="h-2 bg-slate-700 rounded"></div>
                <div class="space-y-3">
                  <div class="grid grid-cols-3 gap-4">
                    <div class="h-2 bg-slate-700 rounded col-span-2"></div>
                    <div class="h-2 bg-slate-700 rounded col-span-1"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <div class="w-full text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <p class="text-gray-500 dark:text-gray-400">No tokens found matching your criteria.</p>
          </div>
        {/if}
      </div>
    </div>
  {:else if currentView === 'transactions'}
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <SalesTable collectionId={Number(contractId)} sortDirection={sortDirection} tokenId={!isNaN(Number(searchText)) && currentView === 'transactions' ? searchText : ''} />
    </div>
  {:else if currentView === 'collectors'}
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      {#if tokens && tokens.length > 0}
        <HoldersList collectionId={contractId} sortDirection={sortDirection} searchText={searchText} {rawCollectors} />
      {:else}
        <div class="py-4 text-center">
          <p>No tokens available to display collectors.</p>
        </div>
      {/if}
    </div>
  {:else if currentView === 'feed'}
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <LoungeView collectionId={Number(contractId)} sortDirection={sortDirection} searchText={searchText} />
    </div>
  {:else if currentView === 'analytics'}
    <div class="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <CollectionAnalytics {collection} fetch={fetch} />
    </div>
  {/if}
</div>

<style>
</style> 