import { writable, get } from 'svelte/store';
import type { Token, Listing } from '$lib/data/types';
import { indexerBaseURL } from '$lib/utils/indexer';
import algosdk from 'algosdk';

type ListingsCache = {
    tokens: Token[];
    lastFetched: number;
    isLoading: boolean;
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

function createListingsStore() {
    const { subscribe, set, update } = writable<ListingsCache>({
        tokens: [],
        lastFetched: 0,
        isLoading: false
    });

    return {
        subscribe,
        async fetchListings(fetch: (input: RequestInfo) => Promise<Response>, force = false) {
            const store = get({ subscribe });
            const now = Date.now();

            // Return cached data if it's still fresh and not forced
            if (!force && store.tokens.length > 0 && (now - store.lastFetched) < CACHE_DURATION) {
                return store.tokens;
            }

            // If already loading, return current tokens
            if (store.isLoading) {
                return store.tokens;
            }

            // Set loading state
            update(state => ({ ...state, isLoading: true }));

            try {
                // Fetch listings
                const data = await (await fetch(`${indexerBaseURL}/mp/listings?active=true`)).json();
                const listings = data.listings as Listing[];

                // Get token IDs from listings
                const tokenIds = listings.map((l: Listing) => l.collectionId + '_' + l.tokenId);

                // Split into chunks of 300
                const chunks = [];
                for (let i = 0; i < tokenIds.length; i += 300) {
                    chunks.push(tokenIds.slice(i, i + 300));
                }

                // Fetch token data for all chunks
                const tokens: Token[] = [];
                for (const chunk of chunks) {
                    const response = await fetch(`${indexerBaseURL}/tokens/?tokenIds=${chunk.join(',')}`);
                    const data = await response.json();
                    
                    // Process tokens
                    data.tokens.forEach((data: {
                        contractId: string;
                        tokenId: string;
                        owner: string;
                        metadataURI: string;
                        metadata: string;
                        'mint-round': number;
                        approved: string;
                        isBurned: boolean;
                    }) => {
                        const metadata = JSON.parse(data.metadata);
                        const listing = listings?.find((l: Listing) => 
                            l.collectionId === Number(data.contractId) && l.tokenId === data.tokenId
                        );

                        if (data.owner == listing?.seller && 
                            data.approved == algosdk.getApplicationAddress(Number(listing?.mpContractId))) {
                            tokens.push({
                                contractId: Number(data.contractId),
                                tokenId: data.tokenId,
                                owner: data.owner,
                                ownerNFD: null,
                                metadataURI: data.metadataURI,
                                metadata: metadata,
                                mintRound: data['mint-round'],
                                approved: data.approved,
                                marketData: listing,
                                salesData: null,
                                rank: null,
                                traits: Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value),
                                isBurned: data.isBurned,
                            });
                        }
                    });
                }

                // Update store with new data
                set({
                    tokens,
                    lastFetched: now,
                    isLoading: false
                });

                return tokens;
            } catch (error) {
                console.error('Error fetching listings:', error);
                // Reset loading state but keep old data
                update(state => ({ ...state, isLoading: false }));
                return store.tokens;
            }
        },
        clearCache() {
            set({
                tokens: [],
                lastFetched: 0,
                isLoading: false
            });
        }
    };
}

export const listingsStore = createListingsStore(); 