<script lang="ts">
  export let searchText: string;
  export let setSearchText: (v: string) => void;
  export let filters: Record<string, string>;
  export let setFilter: (trait: string, value: string) => void;
  export let sortDirection: 'asc' | 'desc';
  export let setSortDirection: (dir: 'asc' | 'desc') => void;
  export let availableTraits: Record<string, Record<string, number>>;
  export let isMobile: boolean = false;
  export let mobileGridColumns: 1 | 2;
  export let setMobileGridColumns: (cols: 1 | 2) => void;
  
  let showFilters = false;
  let inputValue = searchText;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Track input element locally
  let searchInputElement: HTMLInputElement;
  
  // Clear search text and focus the input
  function clearSearch() {
    inputValue = '';
    setSearchText('');
    searchInputElement?.focus();
  }
  
  // Handle search input with debounce
  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    inputValue = target?.value || '';
    
    // Clear any existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set a new timeout to debounce API calls
    searchTimeout = setTimeout(() => {
      setSearchText(inputValue);
      searchTimeout = null;
    }, 300); // 300ms debounce
  }
  
  // Toggle filter visibility on mobile
  function toggleFilters() {
    showFilters = !showFilters;
  }
  
  // Reset all filters
  function resetFilters() {
    Object.keys(filters).forEach((key) => {
      setFilter(key, '');
    });
  }
  
  // Get active filter count
  $: activeFilterCount = Object.values(filters).filter(value => value !== '').length;
  
  // Update inputValue when searchText changes externally
  $: {
    if (searchText !== inputValue && !searchTimeout) {
      inputValue = searchText;
    }
  }
</script>

<!-- Controls Layout -->
<div class="flex flex-col gap-4 w-full">
  <!-- Search Box -->
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3">
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </div>
      <input 
        type="text" 
        class="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100" 
        placeholder="Search tokens..." 
        value={inputValue}
        on:input={handleSearchInput}
        bind:this={searchInputElement}
      />
      {#if inputValue}
        <button 
          class="absolute inset-y-0 right-0 pr-3 flex items-center" 
          on:click={clearSearch}
          aria-label="Clear Search"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="h-5 w-5 text-gray-500">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      {/if}
    </div>
    
    <!-- Sort & Mobile Grid Controls -->
    <div class="mt-3 flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-500 dark:text-gray-400">
          Sort
        </div>
        <div class="inline-flex rounded-md shadow-sm" role="group">
          <button 
            type="button" 
            class="py-1 px-3 text-sm font-medium rounded-l-lg border border-gray-300 dark:border-gray-600 {sortDirection === 'asc' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            on:click={() => setSortDirection('asc')}
          >
            Ascending
          </button>
          <button 
            type="button" 
            class="py-1 px-3 text-sm font-medium rounded-r-lg border border-gray-300 dark:border-gray-600 border-l-0 {sortDirection === 'desc' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
            on:click={() => setSortDirection('desc')}
          >
            Descending
          </button>
        </div>
      </div>
      
      {#if isMobile}
        <div class="flex md:hidden items-center justify-between">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            Grid View
          </div>
          <div class="inline-flex rounded-md shadow-sm" role="group">
            <button 
              type="button" 
              class="py-1 px-3 text-sm font-medium rounded-l-lg border border-gray-300 dark:border-gray-600 {mobileGridColumns === 1 ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
              on:click={() => setMobileGridColumns(1)}
            >
              Single
            </button>
            <button 
              type="button" 
              class="py-1 px-3 text-sm font-medium rounded-r-lg border border-gray-300 dark:border-gray-600 border-l-0 {mobileGridColumns === 2 ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'}"
              on:click={() => setMobileGridColumns(2)}
            >
              Double
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Mobile Filter Toggle -->
  {#if isMobile}
    <button 
      class="w-full p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm flex justify-between items-center" 
      on:click={toggleFilters}
    >
      <span class="font-medium">Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
      <svg class="w-5 h-5 transform transition-transform duration-200 {showFilters ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>
  {/if}
  
  <!-- Filters -->
  {#if !isMobile || (isMobile && showFilters)}
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="font-medium text-gray-900 dark:text-gray-100">Filters</h3>
        {#if activeFilterCount > 0}
          <button 
            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            on:click={resetFilters}
          >
            Clear all
          </button>
        {/if}
      </div>
      
      {#if Object.keys(availableTraits).length === 0}
        <p class="text-sm text-gray-500 dark:text-gray-400 py-2">No filters available for this collection</p>
      {:else}
        <div class="space-y-4">
          {#each Object.entries(availableTraits) as [trait, values]}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{trait}</label>
              <select 
                class="w-full p-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-blue-500 focus:border-blue-500" 
                bind:value={filters[trait]} 
                on:change={e => setFilter(trait, (e.target as HTMLSelectElement)?.value)}
              >
                <option value="">All</option>
                {#each Object.entries(values) as [val, count]}
                  <option value={val}>{val} ({count})</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div> 