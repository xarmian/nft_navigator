import { writable } from 'svelte/store';
import type { Token } from '$lib/data/types';

interface TokenWithVisibility extends Token {
    visible: boolean;
}

interface CacheEntry {
    tokens: TokenWithVisibility[];
    lastUpdated: number;
    searchText: string;
    lastTab: string;
    lastFilters: Record<string, string>;
}

type TokenCache = {
    [collectionId: string]: CacheEntry;
};

function createTokenCache() {
    const { subscribe, set, update } = writable<TokenCache>({});

    return {
        subscribe,
        setTokens: (collectionId: string, tokens: Token[]) => {
            update(cache => {
                const existingCache = cache[collectionId];
                const newTokens = tokens.map(token => ({
                    ...token,
                    visible: existingCache?.tokens.find(t => t.tokenId === token.tokenId)?.visible ?? true
                } as TokenWithVisibility));

                return {
                    ...cache,
                    [collectionId]: {
                        tokens: newTokens,
                        lastUpdated: Date.now(),
                        searchText: existingCache?.searchText || '',
                        lastTab: existingCache?.lastTab || '',
                        lastFilters: existingCache?.lastFilters || {}
                    }
                };
            });
        },
        addTokens: (collectionId: string, newTokens: Token[]) => {
            update(cache => {
                const existingCache = cache[collectionId];
                if (!existingCache) {
                    // If no existing cache, just set these tokens
                    return {
                        ...cache,
                        [collectionId]: {
                            tokens: newTokens.map(token => ({
                                ...token,
                                visible: true
                            } as TokenWithVisibility)),
                            lastUpdated: Date.now(),
                            searchText: '',
                            lastTab: '',
                            lastFilters: {}
                        }
                    };
                }

                // Add only new tokens that don't already exist
                const existingTokenIds = new Set(existingCache.tokens.map(t => t.tokenId));
                const additionalTokens = newTokens
                    .filter(t => !existingTokenIds.has(t.tokenId))
                    .map(token => ({
                        ...token,
                        visible: true // Set initially visible, will be updated by updateVisibility
                    } as TokenWithVisibility));

                return {
                    ...cache,
                    [collectionId]: {
                        ...existingCache,
                        tokens: [...existingCache.tokens, ...additionalTokens],
                        lastUpdated: Date.now()
                    }
                };
            });
        },
        updateVisibility: (collectionId: string, searchText: string, displayTab: string, filters: Record<string, string>) => {
            update(cache => {
                const collection = cache[collectionId];
                if (!collection) return cache;

                // Only update if search text or filters have changed
                if (collection.searchText === searchText && 
                    collection.lastTab === displayTab && 
                    JSON.stringify(collection.lastFilters) === JSON.stringify(filters)) {
                    return cache;
                }

                const updatedTokens = collection.tokens.map(token => ({
                    ...token,
                    visible: (
                        // Tab-specific visibility
                        (displayTab === 'forsale' ? (token.marketData && !token.marketData.sale && !token.marketData.delete) : true) &&
                        (displayTab === 'burned' ? token.isBurned : displayTab !== 'burned' ? !token.isBurned : true) &&
                        // Search text visibility
                        (!searchText || 
                            token.metadata?.name?.toLowerCase().includes(searchText.toLowerCase()) ||
                            token.traits?.some(trait => trait.toLowerCase().includes(searchText.toLowerCase())) ||
                            token.tokenId.toString().includes(searchText.toLowerCase()) ||
                            token.owner.toLowerCase().includes(searchText.toLowerCase()) ||
                            token.ownerNFD?.toLowerCase().includes(searchText.toLowerCase()) ||
                            (token.contractId === 797609 && token.metadata?.envoiName?.toLowerCase().includes(searchText.toLowerCase()))
                        ) &&
                        // Filter visibility
                        Object.entries(filters).every(([key, value]) => {
                            if (value === '') return true;
                            return token.metadata?.properties?.[key] === value;
                        })
                    )
                })) as TokenWithVisibility[];

                return {
                    ...cache,
                    [collectionId]: {
                        ...collection,
                        tokens: updatedTokens,
                        searchText,
                        lastTab: displayTab,
                        lastFilters: { ...filters }
                    }
                };
            });
        },
        clearCollection: (collectionId: string) => {
            update(cache => {
                const newCache = { ...cache };
                delete newCache[collectionId];
                return newCache;
            });
        },
        clear: () => set({})
    };
}

export const tokenCache = createTokenCache(); 