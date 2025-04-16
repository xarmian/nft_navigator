import { writable, get } from 'svelte/store';
import type { Token } from '$lib/data/types';
import { getListings, mimirBaseURL } from '$lib/utils/mimir';
import algosdk from 'algosdk';

type ListingsState = {
    items: Token[];
    isLoading: boolean;
    nextToken: string | null;
    totalCount: number;
    currentFilters: {
        collectionId?: number;
        minPrice?: number;
        maxPrice?: number;
        currency?: number;
        seller?: string;
    };
    lastUpdated: number;
};

function createMimirListingsStore() {
    const { subscribe, set, update } = writable<ListingsState>({
        items: [],
        isLoading: false,
        nextToken: null,
        totalCount: 0,
        currentFilters: {},
        lastUpdated: 0
    });

    return {
        subscribe,
        
        /**
         * Load listings with pagination information directly from the API response
         */
        async fetchListings(params: {
            collectionId?: number;
            minPrice?: number;
            maxPrice?: number;
            currency?: number;
            seller?: string;
            reset?: boolean;
            limit?: number;
            nextToken?: string;
            fetch?: (input: RequestInfo) => Promise<Response>;
        } = {}) {
            const { 
                collectionId, 
                minPrice, 
                maxPrice, 
                currency, 
                seller, 
                reset = false,
                limit = 50,
                nextToken,
                fetch = window.fetch 
            } = params;
            
            // Build the current filters object for caching comparison
            const currentFilters = { 
                collectionId, 
                minPrice, 
                maxPrice, 
                currency,
                seller 
            };
            
            // Check if we're changing the filter parameters
            const store = get({ subscribe });
            const areFiltersChanged = reset || 
                JSON.stringify(currentFilters) !== JSON.stringify(store.currentFilters);

            // Update loading state
            update(state => ({
                ...state,
                isLoading: true,
                // Reset pagination if filters changed
                ...(areFiltersChanged ? { items: [], nextToken: null } : {})
            }));

            try {
                // Use the nextToken from parameters or store if continuing the same query
                const tokenToUse = nextToken || (areFiltersChanged ? null : store.nextToken);
                
                // Build fetch parameters for the API request
                const requestParams: Record<string, string> = {};
                
                if (collectionId) requestParams.collectionId = collectionId.toString();
                if (minPrice) requestParams['min-price'] = minPrice.toString();
                if (maxPrice) requestParams['max-price'] = maxPrice.toString();
                if (currency) requestParams.currency = currency.toString();
                if (seller) requestParams.seller = seller;
                if (limit) requestParams.limit = limit.toString();
                if (tokenToUse) requestParams.nextToken = tokenToUse;
                // Always set active to true
                requestParams.active = 'true';
                requestParams.includes = 'token,collection';
                
                // Get the data directly from the API to access pagination info
                const response = await fetch(
                    `${mimirBaseURL}/mp/listings?${new URLSearchParams(requestParams).toString()}`
                );

                const data = await response.json();
                
                // Get the processed listings
                const listings = await getListings({
                    collectionId,
                    minPrice,
                    maxPrice,
                    currency,
                    seller,
                    active: true,
                    limit,
                    nextToken: tokenToUse || undefined,
                    includes: 'token,collection',
                    fetch
                });
                
                // Process token data from listings
                const tokens: Token[] = listings
                    .filter(listing => 
                        listing.token !== undefined && 
                        listing.token.owner === listing.seller && 
                        listing.token.approved === algosdk.getApplicationAddress(Number(listing.mpContractId))
                    )
                    .map(listing => {
                        // We've already verified token exists in the filter
                        const token = listing.token!;

                        // Parse metadata if it's a string
                        const metadata = typeof token.metadata === 'string' 
                            ? JSON.parse(token.metadata) 
                            : token.metadata;
                        
                        // Extract traits from properties
                        const traits = metadata.properties 
                            ? Object.entries(metadata.properties).map(([key, value]) => `${key}: ${value}`) 
                            : metadata.attributes 
                                ? metadata.attributes.map((attr: { trait_type: string, value: string | number }) => `${attr.trait_type}: ${attr.value}`)
                                : [];

                        return {
                            contractId: Number(listing.collectionId),
                            tokenId: listing.tokenId,
                            owner: token.owner,
                            ownerNFD: null,
                            metadataURI: token.metadataURI || '',
                            metadata: metadata,
                            mintRound: Number(token.mintRound),
                            approved: token.approved,
                            marketData: listing,
                            salesData: null,
                            rank: null,
                            traits: traits,
                            isBurned: token.isBurned === 'true',
                            isListed: true
                        };
                    });

                // Update store with new data and pagination info
                update(state => {
                    // Append tokens if this is a continuation of the same filters
                    const updatedTokens = areFiltersChanged ? tokens : [...state.items, ...tokens];
                    
                    return {
                        items: updatedTokens,
                        isLoading: false,
                        nextToken: data['next-token'],
                        totalCount: data['total-count'] || 0,
                        currentFilters,
                        lastUpdated: Date.now()
                    };
                });

                // Return useful data about the operation
                return {
                    tokens: get({ subscribe }).items,
                    nextToken: data['next-token'],
                    totalCount: data['total-count'] || 0,
                    hasMore: !!data['next-token']
                };
            } catch (error) {
                console.error('Error fetching listings:', error);
                update(state => ({ ...state, isLoading: false }));
                
                return {
                    tokens: get({ subscribe }).items,
                    nextToken: get({ subscribe }).nextToken,
                    totalCount: get({ subscribe }).totalCount,
                    hasMore: !!get({ subscribe }).nextToken,
                    error
                };
            }
        },

        /**
         * Continue loading more listings with the current filters
         */
        async loadMore(fetch: (input: RequestInfo) => Promise<Response> = window.fetch, limit = 50) {
            const store = get({ subscribe });
            
            if (!store.nextToken) {
                return {
                    tokens: store.items,
                    nextToken: null,
                    totalCount: store.totalCount,
                    hasMore: false
                };
            }
            
            return this.fetchListings({
                ...store.currentFilters,
                nextToken: store.nextToken,
                limit,
                fetch
            });
        },

        /**
         * Check if more listings are available
         */
        hasMore() {
            return !!get({ subscribe }).nextToken;
        },

        /**
         * Get the total count of listings matching the current filters
         */
        getTotalCount() {
            return get({ subscribe }).totalCount;
        },

        /**
         * Get pagination status information
         */
        getPaginationInfo() {
            const store = get({ subscribe });
            return {
                loadedCount: store.items.length,
                totalCount: store.totalCount,
                hasMore: !!store.nextToken,
                nextToken: store.nextToken
            };
        },

        /**
         * Reset the store
         */
        reset() {
            set({
                items: [],
                isLoading: false,
                nextToken: null,
                totalCount: 0,
                currentFilters: {},
                lastUpdated: 0
            });
        }
    };
}

export const mimirListingsStore = createMimirListingsStore(); 