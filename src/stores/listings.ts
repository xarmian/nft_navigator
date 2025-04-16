import { writable, get } from 'svelte/store';
import type { Token, Listing } from '$lib/data/types';
import { indexerBaseURL } from '$lib/utils/indexer';
import algosdk from 'algosdk';
import { getEnvoiNames, resolveEnvoiToken } from '$lib/utils/envoi';

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
                            isBurned: String(token.isBurned === 'true'),
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
                
                // Process ENVOi names for owners
                const uniqueOwners = [...new Set(tokens.map(t => t.owner))];
                if (uniqueOwners.length > 0) {
                    try {
                        const envoiResults = await getEnvoiNames(uniqueOwners);
                        if (envoiResults.length > 0) {
                            // Update tokens with owner info
                            const tokensWithOwnerInfo = tokens.map(token => {
                                const ownerEnvoi = envoiResults.find(r => r.address === token.owner);
                                if (ownerEnvoi) {
                                    return {
                                        ...token,
                                        ownerNFD: ownerEnvoi.name,
                                        ownerAvatar: ownerEnvoi.metadata?.avatar || '/blank_avatar_small.png'
                                    };
                                }
                                return token;
                            });
                            
                            // Update store with owner info
                            update(state => ({
                                ...state,
                                tokens: loadMore ? [...state.tokens.filter(t => !tokensWithOwnerInfo.find(nt => nt.contractId === t.contractId && nt.tokenId === t.tokenId)), ...tokensWithOwnerInfo] : tokensWithOwnerInfo
                            }));
                        }
                    } catch (error) {
                        console.error("Error resolving Envoi names for owners:", error);
                    }
                }
                
                // Process ENVOi tokens (contract ID 797609)
                const envoiTokens = tokens.filter(t => t.contractId === 797609);
                if (envoiTokens.length > 0) {
                    try {
                        const tokenIds = envoiTokens.map(token => token.tokenId);
                        const envoiResults = await resolveEnvoiToken(tokenIds);
                        
                        if (envoiResults.length > 0) {
                            // Update tokens with ENVOi data
                            const tokensWithEnvoiInfo = tokens.map(token => {
                                if (token.contractId === 797609) {
                                    const envoiData = envoiResults.find(result => result.token_id === token.tokenId);
                                    if (envoiData && token.metadata) {
                                        return {
                                            ...token,
                                            metadata: {
                                                ...token.metadata,
                                                envoiName: envoiData.name || token.metadata.name,
                                                avatar: envoiData.metadata.avatar,
                                                envoiMetadata: envoiData.metadata
                                            }
                                        };
                                    }
                                }
                                return token;
                            });
                            
                            // Update store with resolved ENVOi token info
                            update(state => ({
                                ...state,
                                tokens: loadMore ? [...state.tokens.filter(t => !tokensWithEnvoiInfo.find(nt => nt.contractId === t.contractId && nt.tokenId === t.tokenId)), ...tokensWithEnvoiInfo] : tokensWithEnvoiInfo
                            }));
                        }
                    } catch (error) {
                        console.error("Error resolving Envoi token names:", error);
                    }
                }
                
                // Return the updated tokens
                return get({ subscribe }).tokens;
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