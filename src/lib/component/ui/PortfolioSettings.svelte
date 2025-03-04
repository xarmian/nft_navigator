<script lang="ts">
    // Exported props
    export let walletId: string;
    export let hidePortfolioValue: boolean = false;
    export let hideActivity: boolean = false;
    export let notifyOffers: boolean = true;
    export let notifyPriceChanges: boolean = true;
    export let notifyNewDrops: boolean = true;
    export let sortOptions: {id: string, name: string}[] = [];
    export let portfolioSort: string;
    export let isCollectionView: boolean;
    export let showListedOnly: boolean = false;
    
    // For user profile
    export let shortName: string = '';

    // Helper function for shortened address display
    function shortenAddress(address: string): string {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }
</script>

<div class="py-6 px-4">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 max-w-3xl mx-auto">
        <h2 class="text-2xl font-bold mb-6">Portfolio Settings</h2>
        
        <!-- View Options -->
        <div class="mb-8">
            <h3 class="text-lg font-bold mb-3 flex items-center">
                <i class="fas fa-eye mr-2 text-blue-500"></i>
                Display Options
            </h3>
            <div class="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div class="flex flex-col gap-4">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label for="viewMode" class="font-medium text-sm">Default View Mode</label>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <button 
                                class="flex flex-col items-center justify-center p-3 rounded-lg border {!isCollectionView ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600'}"
                                on:click={() => isCollectionView = false}
                            >
                                <i class="fas fa-grip-horizontal text-xl mb-2 {!isCollectionView ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}"></i>
                                <span class="{!isCollectionView ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}">Gallery View</span>
                            </button>
                            <button 
                                class="flex flex-col items-center justify-center p-3 rounded-lg border {isCollectionView ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600'}"
                                on:click={() => isCollectionView = true}
                            >
                                <i class="fas fa-layer-group text-xl mb-2 {isCollectionView ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}"></i>
                                <span class="{isCollectionView ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}">Collection View</span>
                            </button>
                        </div>
                    </div>
                    
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label for="defaultSort" class="font-medium text-sm">Default Sort</label>
                        </div>
                        <select 
                            id="defaultSort"
                            bind:value={portfolioSort} 
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        >
                            {#each sortOptions as option}
                                <option value={option.id}>{option.name}</option>
                            {/each}
                        </select>
                    </div>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            bind:checked={showListedOnly} 
                            class="w-5 h-5 rounded accent-blue-500"
                        />
                        <span>Only show listed NFTs</span>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- Privacy Settings -->
        <div class="mb-8">
            <h3 class="text-lg font-bold mb-3 flex items-center">
                <i class="fas fa-lock mr-2 text-blue-500"></i>
                Privacy Settings
            </h3>
            <div class="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div class="flex flex-col gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            bind:checked={hidePortfolioValue}
                            class="w-5 h-5 rounded accent-blue-500"
                        />
                        <span>Hide my portfolio value from public view</span>
                    </label>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            bind:checked={hideActivity}
                            class="w-5 h-5 rounded accent-blue-500"
                        />
                        <span>Don't show my activity in public feeds</span>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- Notifications Settings -->
        <div class="mb-8">
            <h3 class="text-lg font-bold mb-3 flex items-center">
                <i class="fas fa-bell mr-2 text-blue-500"></i>
                Notification Preferences
            </h3>
            <div class="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div class="flex flex-col gap-4">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            bind:checked={notifyOffers}
                            class="w-5 h-5 rounded accent-blue-500"
                        />
                        <span>Offers on my NFTs</span>
                    </label>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            bind:checked={notifyPriceChanges}
                            class="w-5 h-5 rounded accent-blue-500"
                        />
                        <span>Price changes for collections I own</span>
                    </label>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            bind:checked={notifyNewDrops}
                            class="w-5 h-5 rounded accent-blue-500"
                        />
                        <span>New drops from collections I follow</span>
                    </label>
                </div>
            </div>
        </div>
        
        <!-- Portfolio Profile Info -->
        <div>
            <h3 class="text-lg font-bold mb-3 flex items-center">
                <i class="fas fa-user-edit mr-2 text-blue-500"></i>
                Profile Information
            </h3>
            <div class="bg-gray-50 dark:bg-gray-750 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label for="displayName" class="block text-sm font-medium mb-1">Display Name</label>
                        <input 
                            type="text" 
                            id="displayName"
                            placeholder="Your display name" 
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            bind:value={shortName}
                        />
                    </div>
                    <div>
                        <label for="bio" class="block text-sm font-medium mb-1">Bio</label>
                        <input 
                            type="text" 
                            id="bio"
                            placeholder="Tell others about yourself" 
                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        />
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label for="twitterHandle" class="block text-sm font-medium mb-1">Twitter Handle</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                                <i class="fab fa-twitter"></i>
                            </span>
                            <input 
                                type="text" 
                                id="twitterHandle"
                                placeholder="@username" 
                                class="w-full pl-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            />
                        </div>
                    </div>
                    <div>
                        <label for="websiteUrl" class="block text-sm font-medium mb-1">Website</label>
                        <div class="relative">
                            <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                                <i class="fas fa-globe"></i>
                            </span>
                            <input 
                                type="text" 
                                id="websiteUrl"
                                placeholder="https://yourdomain.com" 
                                class="w-full pl-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Save Button -->
        <div class="mt-8 flex justify-end">
            <button class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                Save Settings
            </button>
        </div>
    </div>
</div> 