import { writable, get } from 'svelte/store';
import type { Token } from '$lib/data/types';
import { getTokens, mimirBaseURL } from '$lib/utils/mimir';

type TokensState = {
    items: Token[];
    isLoading: boolean;
    nextToken: string | null;
    totalCount: number;
    currentQuery: {
        contractId?: number;
        tokenId?: string;
        owner?: string;
        search?: string;
    } | null;
    lastUpdated: number;
};

function createMimirTokensStore() {
    const { subscribe, set, update } = writable<TokensState>({
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
         * Load tokens with pagination information directly from the API response
         */
        async fetchTokens(params: {
            contractId?: number;
            tokenId?: string;
            owner?: string;
            search?: string;
            reset?: boolean;
            limit?: number;
            nextToken?: string;
            fetch?: (input: RequestInfo) => Promise<Response>;
        }) {
            const { 
                contractId, 
                tokenId, 
                owner, 
                search,
                reset = false,
                limit = 50,
                nextToken,
                fetch = window.fetch 
            } = params;

            // Require at least one parameter to avoid loading too much data
            if (!contractId && !tokenId && !owner && !search) {
                throw new Error('At least one of contractId, tokenId, owner, or search must be provided');
            }

            // Build the current query object for caching comparison
            const currentQuery = { contractId, tokenId, owner, search };
            
            // Check if we're changing the query parameters
            const store = get({ subscribe });
            const isNewQuery = reset || 
                !store.currentQuery || 
                JSON.stringify(currentQuery) !== JSON.stringify(store.currentQuery);

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
                
                // Build fetch parameters for the API request
                const requestParams: Record<string, string> = {};
                
                if (contractId) requestParams.contractId = contractId.toString();
                if (tokenId) requestParams.tokenId = tokenId;
                if (owner) requestParams.owner = owner;
                if (limit) requestParams.limit = limit.toString();
                if (tokenToUse) requestParams.nextToken = tokenToUse;
                requestParams.includes = 'metadata';
                
                // Get the data from the API
                const response = await fetch(
                    `${mimirBaseURL}/tokens?${new URLSearchParams(requestParams).toString()}`
                );

                const data = await response.json();
                
                // Process tokens
                const tokens = await getTokens({
                    contractId,
                    tokenId,
                    owner,
                    limit,
                    nextToken: tokenToUse || undefined,
                    includes: 'metadata',
                    fetch
                });

                // Update store with new data and pagination info
                update(state => {
                    // Append new tokens if this is a continuation of the same query
                    const updatedTokens = isNewQuery ? tokens : [...state.items, ...tokens];
                    
                    return {
                        items: updatedTokens,
                        isLoading: false,
                        nextToken: data['next-token'],
                        totalCount: data['total-count'] || 0,
                        currentQuery,
                        lastUpdated: Date.now()
                    };
                });

                return {
                    tokens: get({ subscribe }).items,
                    nextToken: data['next-token'],
                    totalCount: data['total-count'] || 0,
                    hasMore: !!data['next-token']
                };
            } catch (error) {
                console.error('Error fetching tokens:', error);
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
         * Continue loading more tokens with the current query parameters
         */
        async loadMore(fetch: (input: RequestInfo) => Promise<Response> = window.fetch, limit = 50) {
            const store = get({ subscribe });
            
            if (!store.nextToken || !store.currentQuery) {
                return {
                    tokens: store.items,
                    nextToken: null,
                    totalCount: store.totalCount,
                    hasMore: false
                };
            }
            
            return this.fetchTokens({
                ...store.currentQuery,
                nextToken: store.nextToken,
                limit,
                fetch
            });
        },

        /**
         * Check if more tokens are available
         */
        hasMore() {
            return !!get({ subscribe }).nextToken;
        },

        /**
         * Get the total count of tokens matching the current query
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

export const mimirTokensStore = createMimirTokensStore(); 