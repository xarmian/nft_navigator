import { writable, get } from 'svelte/store';
import type { Token, Listing } from '$lib/data/types';
import { indexerBaseURL } from '$lib/utils/indexer';
import algosdk from 'algosdk';

type ListingsCache = {
    tokens: Token[];
    lastFetched: number;
    isLoading: boolean;
    nextToken: string | null;
    totalCount: number;
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const PAGE_SIZE = 1000; // Maximum results per API call

function createListingsStore() {
    const { subscribe, set, update } = writable<ListingsCache>({
        tokens: [],
        lastFetched: 0,
        isLoading: false,
        nextToken: null,
        totalCount: 0
    });

    return {
        subscribe,
        async fetchListings(fetch: (input: RequestInfo) => Promise<Response>, force = false, loadMore = false) {
            const store = get({ subscribe });
            const now = Date.now();

            // Return cached data if it's still fresh and not forced and not loading more
            if (!force && !loadMore && store.tokens.length > 0 && (now - store.lastFetched) < CACHE_DURATION) {
                return store.tokens;
            }

            // If already loading, return current tokens
            if (store.isLoading) {
                return store.tokens;
            }

            // Set loading state
            update(state => ({ ...state, isLoading: true }));

            try {
                // Determine if we're loading the first page or a subsequent page
                const nextToken = loadMore ? store.nextToken : null;
                const url = nextToken 
                    ? `${indexerBaseURL}/mp/listings?active=true&limit=${PAGE_SIZE}&next=${nextToken}` 
                    : `${indexerBaseURL}/mp/listings?active=true&limit=${PAGE_SIZE}`;

                // Fetch listings
                const response = await fetch(url);
                const data = await response.json();
                const listings = data.listings as Listing[];
                
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

                // Update store with new data
                update(state => {
                    // If we're loading more, append to existing tokens
                    const updatedTokens = loadMore ? [...state.tokens, ...tokens] : tokens;
                    
                    return {
                        tokens: updatedTokens,
                        lastFetched: now,
                        isLoading: false,
                        nextToken: data['next-token'] || null,
                        totalCount: data['total-count'] || 0
                    };
                });

                const updatedStore = get({ subscribe });
                return updatedStore.tokens;
            } catch (error) {
                console.error('Error fetching listings:', error);
                // Reset loading state but keep old data
                update(state => ({ ...state, isLoading: false }));
                return store.tokens;
            }
        },
        loadMore(fetch: (input: RequestInfo) => Promise<Response>) {
            return this.fetchListings(fetch, false, true);
        },
        hasMore() {
            const store = get({ subscribe });
            return !!store.nextToken;
        },
        clearCache() {
            set({
                tokens: [],
                lastFetched: 0,
                isLoading: false,
                nextToken: null,
                totalCount: 0
            });
        }
    };
}

export const listingsStore = createListingsStore(); 