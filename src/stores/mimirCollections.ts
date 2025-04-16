import { writable, get } from 'svelte/store';
import type { Collection } from '$lib/data/types';
import { getCollections, mimirBaseURL } from '$lib/utils/mimir';
import { getNFD } from '$lib/utils/nfd';
import type { ICollection } from '$lib/utils/mimir';

type CollectionsState = {
    items: Collection[];
    isLoading: boolean;
    nextToken: string | null;
    totalCount: number;
    currentQuery: {
        name?: string;
        creator?: string;
    } | null;
    lastUpdated: number;
};

function createMimirCollectionsStore() {
    const { subscribe, set, update } = writable<CollectionsState>({
        items: [],
        isLoading: false,
        nextToken: null,
        totalCount: 0,
        currentQuery: null,
        lastUpdated: 0
    });

    return {
        subscribe,
        
        /**
         * Load collections with pagination information
         */
        async fetchCollections(params: {
            name?: string;
            creator?: string;
            reset?: boolean;
            limit?: number;
            nextToken?: string;
            fetch?: (input: RequestInfo) => Promise<Response>;
        } = {}) {
            const { 
                name, 
                creator, 
                reset = false,
                limit = 50,
                nextToken,
                fetch = window.fetch 
            } = params;

            // Build the current query object for caching comparison
            const currentQuery = { name, creator };
            
            // Check if we're changing the query parameters
            const store = get({ subscribe });
            const isNewQuery = reset || 
                !store.currentQuery || 
                JSON.stringify(currentQuery) !== JSON.stringify(store.currentQuery);

            // Prevent duplicate requests - if already loading with the same token, return current state
            if (store.isLoading && nextToken === store.nextToken && !isNewQuery) {
                console.log('Skipping duplicate request with the same nextToken:', nextToken);
                return {
                    collections: store.items,
                    nextToken: store.nextToken,
                    totalCount: store.totalCount,
                    hasMore: !!store.nextToken
                };
            }

            // Update loading state
            update(state => ({
                ...state,
                isLoading: true,
                // Reset pagination if this is a new query
                ...(isNewQuery ? { items: [], nextToken: null } : {})
            }));

            try {
                // Use the nextToken from parameters or store
                const tokenToUse = nextToken || (isNewQuery ? null : store.nextToken);
                
                // For debugging
                console.log('Fetching collections:', {
                    name, creator, tokenToUse, limit, 
                    isNewQuery, storeNextToken: store.nextToken
                });
                
                // If this is loading the next page of existing results, make direct API call
                // This avoids double requests when paginating
                if (!isNewQuery && tokenToUse) {
                    // Build query parameters
                    const requestParams: Record<string, string> = {};
                    if (name) requestParams.name = name;
                    if (creator) requestParams.creator = creator;
                    if (limit) requestParams.limit = limit.toString();
                    if (tokenToUse) requestParams.nextToken = tokenToUse;
                    requestParams.includes = 'unique-owners';
                    
                    // Make single API call
                    const response = await fetch(
                        `${mimirBaseURL}/collections?${new URLSearchParams(requestParams).toString()}`
                    );
                    const data = await response.json();
                    
                    // Process the collections from the raw data
                    const creators: string[] = Array.from(
                        new Set(data.collections.map((c: ICollection) => c.creator))
                    );
                    const nfdResults = await getNFD(creators);
                    
                    // Map and process collections
                    const collections: Collection[] = data.collections
                        .filter((c: ICollection) => c.firstToken !== null)
                        .map((collection: ICollection) => {
                            const col: Collection = {
                                contractId: collection.contractId,
                                name: collection.name,
                                creator: collection.creator,
                                creatorName: undefined,
                                imageUrl: collection.imageUrl,
                                totalSupply: parseInt(collection.totalSupply),
                                burnedSupply: parseInt(collection.burnedSupply),
                                mintRound: collection.mintRound,
                                metadata: collection.metadata,
                                uniqueOwners: collection.uniqueOwners,
                                tokens: [],
                                globalState: collection.globalState,
                                highforgeData: null,
                                gameData: null
                            };
            
                            if (collection.firstToken) {
                                col.firstToken = {
                                    owner: collection.firstToken.owner,
                                    contractId: collection.contractId,
                                    tokenId: collection.firstToken.tokenId,
                                    "mint-round": collection.firstToken.mintRound,
                                    metadata: collection.firstToken.metadata,
                                    metadataURI: '',
                                    approved: collection.firstToken.approved,
                                    isBurned: false
                                };
                            }
            
                            if (collection.metadata) {
                                try {
                                    col.highforgeData = JSON.parse(collection.metadata);
                                } catch {
                                    col.highforgeData = null;
                                }
                            }
            
                            // Assign creator name if available
                            const creatorNFD = nfdResults.find(n => n.key === collection.creator);
                            if (creatorNFD) {
                                col.creatorName = creatorNFD.replacementValue;
                            }
            
                            return col;
                        });
                    
                    // Update store with new data and pagination info
                    update(state => {
                        // For continuation queries, append to existing items
                        const updatedCollections = [...state.items, ...collections];
                        
                        return {
                            items: updatedCollections,
                            isLoading: false,
                            nextToken: data['next-token'],
                            totalCount: data['total-count'] || 0,
                            currentQuery,
                            lastUpdated: Date.now()
                        };
                    });
            
                    return {
                        collections: get({ subscribe }).items,
                        nextToken: data['next-token'],
                        totalCount: data['total-count'] || 0,
                        hasMore: !!data['next-token']
                    };
                }
                // For new queries, use the existing getCollections helper
                else {
                    // Make API call through getCollections
                    const collections = await getCollections({
                        name,
                        creator,
                        limit,
                        nextToken: tokenToUse || undefined,
                        includes: 'unique-owners',
                        fetch
                    });
                    
                    // Make a separate call to get pagination info
                    const paginationParams = new URLSearchParams();
                    if (name) paginationParams.append('name', name);
                    if (creator) paginationParams.append('creator', creator);
                    paginationParams.append('limit', '1');
                    
                    const paginationResponse = await fetch(
                        `${mimirBaseURL}/collections?${paginationParams.toString()}`
                    );
                    const paginationData = await paginationResponse.json();
                    
                    // Update store with new data and pagination info
                    update(() => {
                        return {
                            items: collections,
                            isLoading: false,
                            nextToken: paginationData['next-token'],
                            totalCount: paginationData['total-count'] || 0,
                            currentQuery,
                            lastUpdated: Date.now()
                        };
                    });
            
                    return {
                        collections: get({ subscribe }).items,
                        nextToken: paginationData['next-token'],
                        totalCount: paginationData['total-count'] || 0,
                        hasMore: !!paginationData['next-token']
                    };
                }
            } catch (error) {
                console.error('Error fetching collections:', error);
                update(state => ({ ...state, isLoading: false }));
                
                return {
                    collections: get({ subscribe }).items,
                    nextToken: get({ subscribe }).nextToken,
                    totalCount: get({ subscribe }).totalCount,
                    hasMore: !!get({ subscribe }).nextToken,
                    error
                };
            }
        },

        /**
         * Continue loading more collections with the current query parameters
         */
        async loadMore(fetch: (input: RequestInfo) => Promise<Response> = window.fetch, limit = 50) {
            const store = get({ subscribe });
            
            if (!store.nextToken || !store.currentQuery) {
                return {
                    collections: store.items,
                    nextToken: null,
                    totalCount: store.totalCount,
                    hasMore: false
                };
            }
            
            return this.fetchCollections({
                ...store.currentQuery,
                nextToken: store.nextToken,
                limit,
                fetch
            });
        },

        /**
         * Check if more collections are available
         */
        hasMore() {
            return !!get({ subscribe }).nextToken;
        },

        /**
         * Get the total count of collections matching the current query
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
                currentQuery: null,
                lastUpdated: 0
            });
        }
    };
}

export const mimirCollectionsStore = createMimirCollectionsStore(); 