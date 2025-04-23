export const mimirBaseURL = "https://voi-mainnet-mimirapi.nftnavigator.xyz/nft-indexer/v1";

export interface ICollectionResponse {
    "total-count": number;
    "next-token": string | null;
    "current-round": number;
    collections: ICollection[];
}

export interface ICollection {
    name: string;
    creator: string;
    deleted: number;
    imageUrl: string;
    metadata: string;
    verified: number;
    mintRound: number;
    contractId: number;
    firstToken: {
        owner: string;
        tokenId: string;
        approved: string;
        metadata: string;
        mintRound: number;
    };
    blacklisted: boolean;
    globalState: IGlobalState[];
    totalSupply: string;
    burnedSupply: string;
    uniqueOwners: number;
}

export interface ITokenResponse {
    "next-token": string | null;
    "current-round": number;
    "total-count": number;
    tokens: IToken[];
}

export interface IToken {
    owner: string;
    tokenId: string;
    approved: string;
    isBurned: boolean;
    metadata: string;
    verified: number;
    contractId: number;
    "mint-round": number;
    blacklisted: boolean;
    lastUpdated: string;
    metadataURI: string;
    collectionName: string;
}

export interface IGlobalState {
    key: string;
    value: string;
}

export interface IListingResponse {
    "next-token": string | null;
    "current-round": number;
    "total-count": number;
    listings: IListing[];
}

export interface IListing {
    transactionId: string;
    mpContractId: number;
    mpListingId: number;
    collectionId: number;
    tokenId: string;
    price: number;
    currency: number;
    seller: string;
    createTimestamp: number;
    createRound: number;
    endTimestamp?: number;
    royalty?: string;
    token?: IToken;
    collection?: {
        name: string;
        creator: string;
        imageUrl: string;
        verified: number;
        mintRound: number;
        contractId: number;
        blacklisted: boolean;
        totalSupply: string;
    };
}

export interface ITransferResponse {
    "next-token": string | null;
    "current-round": number;
    "total-count": number;
    transfers: ITransfer[];
}

export interface ITransfer {
    transactionId: string;
    contractId: number;
    tokenId: string;
    fromAddr: string;
    toAddr: string;
    round: number;
    timestamp: number;
    token?: IToken;
}

export interface ISaleResponse {
    "next-token": string | null;
    "current-round": number;
    "total-count": number;
    sales: ISale[];
}

export interface ISale {
    transactionId: string;
    seller: string;
    buyer: string;
    price: number;
    currency: number;
    timestamp: number;
    tokenId: string;
    collectionId: number;
    round: number;
    listing?: IListing;
}

export interface GetTokensParams {
    contractId?: string | number;
    tokenId?: string;
    tokenIds?: string;  // comma-separated list of tokenIds
    owner?: string;
    limit?: number;
    offset?: number;
    nextToken?: string;
    includes?: string;
    fetch?: (input: RequestInfo) => Promise<Response>;
    metadataSearch?: string;
    metadataProperties?: Record<string, string>;
}

export interface GetCollectionsParams {
    contractId?: string | number;
    name?: string;
    creator?: string;
    limit?: number;
    offset?: number;
    nextToken?: string;
    includes?: string;
    fetch?: (input: RequestInfo) => Promise<Response>;
}

export interface GetListingsParams {
    collectionId?: string | number;
    tokenId?: string;
    seller?: string;
    active?: boolean;
    minPrice?: number;
    maxPrice?: number;
    currency?: number;
    limit?: number;
    nextToken?: string;
    includes?: string;
    fetch?: (input: RequestInfo) => Promise<Response>;
}

export interface GetTransfersParams {
    contractId?: string | number;
    tokenId?: string;
    user?: string;
    from?: string;
    to?: string;
    minRound?: number;
    maxRound?: number;
    minTime?: number;
    maxTime?: number;
    limit?: number;
    nextToken?: string;
    includes?: string;
    fetch?: (input: RequestInfo) => Promise<Response>;
}

export interface GetSalesParams {
    collectionId?: string | number;
    tokenId?: string;
    seller?: string;
    buyer?: string;
    minPrice?: number;
    maxPrice?: number;
    currency?: number;
    minTime?: number;
    maxTime?: number;
    limit?: number;
    nextToken?: string;
    includes?: string;
    fetch?: (input: RequestInfo) => Promise<Response>;
}

import type { Token, Collection, Transfer, Sale, Listing } from '$lib/data/types';
import { tokenStore } from '../../stores/collection';
import { get } from 'svelte/store';
import algosdk from 'algosdk';
import { getNFD } from './nfd';
import { resolveEnvoiToken } from './envoi';

function buildURLParams(params: Record<string, string | number | boolean | undefined | null>): URLSearchParams {
    const urlParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            urlParams.append(key, value.toString());
        }
    }
    
    return urlParams;
}

export async function getTokens(params: GetTokensParams): Promise<Token[]> {
    if (!params.tokenIds && !params.contractId && !params.owner && !params.tokenId) {
        throw new Error('At least one of tokenIds, contractId, owner, or tokenId must be provided');
    }

    if (!params.fetch) params.fetch = fetch;
    if (!params.limit) params.limit = 1000;

    const cachedTokens: Token[] = [];
    if (params.contractId && !params.tokenIds) {
        const tokenMap = get(tokenStore);
        for (const [key, token] of tokenMap.entries()) {
            if (key.startsWith(`${params.contractId}_`)) {
                cachedTokens.push(token);
            }
        }
        if (cachedTokens.length > 0) {
            return cachedTokens;
        }
    }

    if (params.tokenIds) {
        const tokenIdArray = params.tokenIds.split(',');
        const chunks = [];
        for (let i = 0; i < tokenIdArray.length; i += 50) {
            chunks.push(tokenIdArray.slice(i, i + 50));
        }

        let allTokens: Token[] = [];
        for (const chunk of chunks) {
            const urlParams = buildURLParams({
                tokenIds: chunk.join(','),
                includes: params.includes,
                limit: 50
            });
            
            const url = `${mimirBaseURL}/tokens?${urlParams.toString()}`;
            
            try {
                const response = await params.fetch(url);
                const data: ITokenResponse = await response.json();
                const processedTokens = await processTokenResponse(data);
                allTokens = [...allTokens, ...processedTokens];
            } catch (err) {
                console.error('Error fetching token chunk:', err);
            }
        }
        return allTokens;
    }

    const urlParams = buildURLParams({
        contractId: params.contractId,
        tokenId: params.tokenId,
        owner: params.owner,
        limit: params.limit,
        'next-token': params.nextToken,
        includes: params.includes || 'metadata'
    });

    const url = `${mimirBaseURL}/tokens?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: ITokenResponse = await response.json();
        const tokens = await processTokenResponse(data);
        
        if (params.contractId) {
            const tokenMap = get(tokenStore);
            tokens.forEach(token => {
                tokenMap.set(`${token.contractId}_${token.tokenId}`, token);
            });
            tokenStore.set(tokenMap);
        }
        
        return tokens;
    } catch (err) {
        console.error('Error fetching tokens:', err);
        return [];
    }
}

async function processTokenResponse(data: ITokenResponse): Promise<Token[]> {
    const tokens: Token[] = data.tokens.map(token => {
        let metadata = null;
        try {
            metadata = typeof token.metadata === 'string' 
                ? JSON.parse(token.metadata) 
                : token.metadata;
        } catch {
            metadata = {};
        }
        
        const traits = metadata?.properties 
            ? Object.entries(metadata.properties).map(([key, value]) => `${key}: ${value}`) 
            : metadata?.attributes 
                ? metadata.attributes.map((attr: { trait_type: string, value: string | number }) => 
                    `${attr.trait_type}: ${attr.value}`)
                : [];

        return {
            contractId: token.contractId,
            tokenId: token.tokenId,
            owner: token.owner,
            ownerNFD: null,
            ownerAvatar: '/blank_avatar_small.png',
            metadataURI: token.metadataURI,
            metadata: metadata,
            mintRound: token["mint-round"],
            approved: token.approved,
            marketData: null,
            salesData: null,
            rank: null,
            traits: traits,
            isBurned: String(token.isBurned),
        };
    });

    // Group tokens by collection
    /*const tokensByCollection: Record<number, Token[]> = {};
    tokens.forEach(token => {
        if (!tokensByCollection[token.contractId]) {
            tokensByCollection[token.contractId] = [];
        }
        tokensByCollection[token.contractId].push(token);
    });

    // Process token rankings by collection
    for (const contractId in tokensByCollection) {
        const collectionTokens = tokensByCollection[contractId];
        
        try {
            // Get collection to check for metadata with trait counts
            const collection = await getCollection({ contractId: parseInt(contractId) });
            
            if (collection && collection.metadata) {
                // Try to parse the traitCount from the collection metadata
                let collectionData;
                try {
                    collectionData = typeof collection.metadata === 'string'
                        ? JSON.parse(collection.metadata)
                        : collection.metadata;
                } catch (e) {
                    console.error('Error parsing collection metadata:', e);
                    collectionData = null;
                }

                if (collectionData?.traitCount) {
                    // Calculate rarity scores from the traitCount data
                    calculateTokenRanks(collectionTokens, collectionData.traitCount);
                }
            }
        } catch (err) {
            console.error('Error processing token ranks for collection:', contractId, err);
        }
    }*/

    const owners = Array.from(new Set(tokens.map(token => token.owner)));
    const nfdResults = await getNFD(owners);
    
    tokens.forEach(token => {
        const nfdObj = nfdResults.find(n => n.key === token.owner);
        if (nfdObj) {
            token.ownerNFD = nfdObj.replacementValue;
            token.ownerAvatar = nfdObj.avatar;
        }
    });

    const envoiTokens = tokens.filter(token => token.contractId === 797609);
    if (envoiTokens.length > 0) {
        const tokenIds = envoiTokens.map(token => token.tokenId);
        const envoiResults = await resolveEnvoiToken(tokenIds);

        envoiTokens.forEach(token => {
            const envoiData = envoiResults.find(result => result.token_id === token.tokenId);
            if (envoiData && token.metadata) {
                token.metadata = {
                    ...token.metadata,
                    envoiName: envoiData.name || token.metadata.name,
                    envoiMetadata: envoiData.metadata
                };
            }
        });
    }

    return tokens.filter(token => token.contractId !== 797610 && token.contractId !== 846601);
}

/**
 * Calculate rarity scores and ranks for tokens based on trait count data
 */
export function calculateTokenRanks(tokens: Token[], traitCount: Record<string, Record<string, number>>) {
    // Calculate total NFTs in collection based on trait count data
    let totalNFTsInCollection = 0;
    
    // Get the first trait category and sum all trait occurrences
    const firstCategory = Object.keys(traitCount)[0];
    if (firstCategory) {
        totalNFTsInCollection = Object.values(traitCount[firstCategory]).reduce((sum, count) => sum + count, 0);
    }
    
    if (totalNFTsInCollection === 0) {
        console.error('Unable to determine collection size from traitCount data');
        return;
    }

    // Calculate rarity score for each token
    const rarityArray: { tokenId: string; rarity: number }[] = [];
    
    tokens.forEach(token => {
        if (token.metadata?.properties) {
            try {
                const rarity = calculateRarityScore(traitCount, token.metadata.properties, totalNFTsInCollection);
                rarityArray.push({ tokenId: token.tokenId, rarity });
            } catch (e) {
                console.error('Error calculating rarity for token:', token.tokenId, e);
                rarityArray.push({ tokenId: token.tokenId, rarity: 0 });
            }
        } else if (token.metadata?.attributes) {
            try {
                // Convert attributes array to properties format
                const properties: Record<string, string> = {};
                token.metadata.attributes.forEach((attr: { trait_type: string, value: string | number }) => {
                    properties[attr.trait_type] = attr.value.toString();
                });
                
                const rarity = calculateRarityScore(traitCount, properties, totalNFTsInCollection);
                rarityArray.push({ tokenId: token.tokenId, rarity });
            } catch (e) {
                console.error('Error calculating rarity for token with attributes:', token.tokenId, e);
                rarityArray.push({ tokenId: token.tokenId, rarity: 0 });
            }
        } else {
            rarityArray.push({ tokenId: token.tokenId, rarity: 0 });
        }
    });
    
    // Sort by rarity score (higher is better)
    rarityArray.sort((a, b) => b.rarity - a.rarity);
    
    // Assign ranks to tokens
    let currentRank = 1;
    let previousRarity = rarityArray[0]?.rarity ?? 0;
    
    tokens.forEach(token => {
        const rarityEntry = rarityArray.find(r => r.tokenId === token.tokenId);
        if (!rarityEntry) return;
        
        const rarity = rarityEntry.rarity;
        if (rarity === previousRarity) {
            token.rank = currentRank;
        } else {
            token.rank = rarityArray.findIndex(r => r.tokenId === token.tokenId) + 1;
            currentRank = token.rank;
            previousRarity = rarity;
        }
    });
}

/**
 * Calculate rarity score for a token based on its traits
 */
function calculateRarityScore(
    traitCount: Record<string, Record<string, number>>,
    tokenProperties: Record<string, string>,
    totalNFTsInCollection: number
): number {
    let rarityScore = 0;
    
    for (const category in tokenProperties) {
        if (traitCount[category]) {
            const traitValue = tokenProperties[category];
            const occurrences = traitCount[category][traitValue] || 1;
            rarityScore += totalNFTsInCollection / occurrences;
        }
    }
    
    return rarityScore;
}

export async function getCollections(params: GetCollectionsParams): Promise<Collection[]> {
    if (!params.fetch) params.fetch = fetch;
    if (!params.limit) params.limit = 1000;

    const urlParams = buildURLParams({
        contractId: params.contractId,
        name: params.name,
        creator: params.creator,
        limit: params.limit,
        'next-token': params.nextToken,
        includes: params.includes || 'unique-owners'
    });

    const url = `${mimirBaseURL}/collections?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: ICollectionResponse = await response.json();
        const collections = await processCollectionResponse(data);
        return collections;
    } catch (err) {
        console.error('Error fetching collections:', err);
        return [];
    }
}

export async function getCollection(params: { contractId: number, fetch?: (input: RequestInfo) => Promise<Response> }): Promise<Collection | null> {
    const collections = await getCollections({
        contractId: params.contractId,
        fetch: params.fetch
    });
    
    return collections.length > 0 ? collections[0] : null;
}

async function processCollectionResponse(data: ICollectionResponse): Promise<Collection[]> {
    const collections = data.collections
        .filter(c => c.firstToken !== null)
        .map(collection => {
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

            return col;
        });

    const creators = Array.from(new Set(collections.map(col => col.creator)));
    const nfdResults = await getNFD(creators);
    
    collections.forEach(collection => {
        const creatorNFD = nfdResults.find(nfd => nfd.key === collection.creator);
        if (creatorNFD) {
            collection.creatorName = creatorNFD.replacementValue;
        }
    });

    return collections;
}

export async function getListings(params: GetListingsParams): Promise<Listing[]> {
    if (!params.fetch) params.fetch = fetch;
    if (!params.limit) params.limit = 100;
    
    const urlParams = buildURLParams({
        collectionId: params.collectionId,
        tokenId: params.tokenId,
        seller: params.seller,
        active: params.active !== undefined ? params.active : true,
        'min-price': params.minPrice,
        'max-price': params.maxPrice,
        currency: params.currency,
        limit: params.limit,
        'next-token': params.nextToken,
        includes: params.includes || 'token,collection'
    });

    const url = `${mimirBaseURL}/mp/listings?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: IListingResponse = await response.json();
        return processListingResponse(data);
    } catch (err) {
        console.error('Error fetching listings:', err);
        return [];
    }
}

function processListingResponse(data: IListingResponse): Listing[] {
    return data.listings.map(listing => {
        const processedListing: Listing = {
            transactionId: listing.transactionId,
            mpContractId: listing.mpContractId,
            mpListingId: listing.mpListingId,
            collectionId: listing.collectionId,
            tokenId: listing.tokenId,
            price: listing.price,
            currency: listing.currency,
            seller: listing.seller,
            createTimestamp: listing.createTimestamp,
            sales: null,
            auctions: null,
            delete: null,
            source: null,
            type: 'sale',
            sale: null,
            createRound: listing.createRound,
            endTimestamp: listing.endTimestamp,
            royalty: listing.royalty,
        };

        if (listing.token) {
            let metadata;
            try {
                metadata = typeof listing.token.metadata === 'string'
                    ? JSON.parse(listing.token.metadata)
                    : listing.token.metadata;
            } catch {
                metadata = {};
            }

            processedListing.token = {
                owner: listing.token.owner,
                tokenId: listing.token.tokenId,
                approved: listing.token.approved,
                isBurned: String(listing.token.isBurned),
                metadata: metadata,
                metadataURI: listing.token.metadataURI,
                mintRound: listing.token["mint-round"],
            };
        }

        if (listing.collection) {
            processedListing.collection = {
                name: listing.collection.name,
                creator: listing.collection.creator,
                imageUrl: listing.collection.imageUrl,
                verified: listing.collection.verified,
                mintRound: listing.collection.mintRound,
                contractId: listing.collection.contractId,
                blacklisted: listing.collection.blacklisted,
                totalSupply: listing.collection.totalSupply,
            };
        }

        return processedListing;
    });
}

export async function getTransfers(params: GetTransfersParams): Promise<Transfer[]> {
    if (!params.fetch) params.fetch = fetch;
    
    const urlParams = buildURLParams({
        contractId: params.contractId,
        tokenId: params.tokenId,
        user: params.user,
        from: params.from,
        to: params.to,
        'min-round': params.minRound,
        'max-round': params.maxRound,
        'min-time': params.minTime,
        'max-time': params.maxTime,
        limit: params.limit || 100,
        'next-token': params.nextToken,
        includes: params.includes || 'token'
    });

    const url = `${mimirBaseURL}/transfers?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: ITransferResponse = await response.json();
        return processTransferResponse(data);
    } catch (err) {
        console.error('Error fetching transfers:', err);
        return [];
    }
}

function processTransferResponse(data: ITransferResponse): Transfer[] {
    return data.transfers.map(transfer => {
        const processedTransfer: Transfer = {
            transactionId: transfer.transactionId,
            contractId: transfer.contractId,
            tokenId: transfer.tokenId,
            from: transfer.fromAddr,
            to: transfer.toAddr,
            round: transfer.round,
            timestamp: transfer.timestamp,
            salePrice: null,
            saleCurrency: null
        };

        if (transfer.token) {
            let metadata;
            try {
                metadata = typeof transfer.token.metadata === 'string'
                    ? JSON.parse(transfer.token.metadata)
                    : transfer.token.metadata;
            } catch {
                metadata = {};
            }

            const traits = metadata?.properties 
                ? Object.entries(metadata.properties).map(([key, value]) => `${key}: ${value}`) 
                : metadata?.attributes 
                    ? metadata.attributes.map((attr: { trait_type: string, value: string | number }) => 
                        `${attr.trait_type}: ${attr.value}`)
                    : [];

            processedTransfer.token = {
                contractId: transfer.token.contractId,
                tokenId: transfer.token.tokenId,
                owner: transfer.token.owner,
                ownerNFD: null,
                metadataURI: transfer.token.metadataURI,
                metadata: metadata,
                mintRound: transfer.token["mint-round"],
                approved: transfer.token.approved,
                traits: traits,
                isBurned: String(transfer.token.isBurned),
                rank: null,
                marketData: null,
                salesData: null
            };
        }

        return processedTransfer;
    });
}

export async function getSales(params: GetSalesParams): Promise<Sale[]> {
    if (!params.fetch) params.fetch = fetch;
    
    const urlParams = buildURLParams({
        collectionId: params.collectionId,
        tokenId: params.tokenId,
        seller: params.seller,
        buyer: params.buyer,
        'min-price': params.minPrice,
        'max-price': params.maxPrice,
        currency: params.currency,
        'min-time': params.minTime,
        'max-time': params.maxTime,
        limit: params.limit || 100,
        'next-token': params.nextToken,
        includes: params.includes || 'listing'
    });

    const url = `${mimirBaseURL}/mp/sales?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: ISaleResponse = await response.json();
        return processSaleResponse(data);
    } catch (err) {
        console.error('Error fetching sales:', err);
        return [];
    }
}

function processSaleResponse(data: ISaleResponse): Sale[] {
    return data.sales.map(sale => {
        const processedSale: Partial<Sale> = {
            transactionId: sale.transactionId,
            seller: sale.seller,
            buyer: sale.buyer,
            price: sale.price,
            currency: sale.currency,
            timestamp: sale.timestamp,
            tokenId: sale.tokenId,
            collectionId: sale.collectionId,
            round: sale.round,
            listing: null as unknown as Listing
        };

        if (sale.listing) {
            processedSale.listing = processListingResponse({
                listings: [sale.listing],
                "next-token": null,
                "current-round": data["current-round"],
                "total-count": 1
            })[0];
        }

        return processedSale as Sale;
    });
}

export function createTokensStore(contractId: number) {
    return {
        async getTokens(options: {
            fetch?: (input: RequestInfo) => Promise<Response>,
            force?: boolean
        } = {}) {
            const { fetch = window.fetch, force = false } = options;
            
            if (!force) {
                const tokenMap = get(tokenStore);
                const tokens: Token[] = [];
                
                for (const [key, token] of tokenMap.entries()) {
                    if (key.startsWith(`${contractId}_`)) {
                        tokens.push(token);
                    }
                }
                
                if (tokens.length > 0) {
                    return tokens;
                }
            }
            
            return getTokens({
                contractId,
                fetch,
                includes: 'metadata'
            });
        }
    };
}

import { writable } from 'svelte/store';

type ListingsCache = {
    tokens: Token[];
    lastFetched: number;
    isLoading: boolean;
    nextToken: string | null;
    totalCount: number;
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const PAGE_SIZE = 100; // Maximum results per API call

export function createListingsStore() {
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

            if (!force && !loadMore && store.tokens.length > 0 && (now - store.lastFetched) < CACHE_DURATION) {
                return store.tokens;
            }

            if (store.isLoading) {
                return store.tokens;
            }

            update(state => ({ ...state, isLoading: true }));

            try {
                const params: GetListingsParams = {
                    active: true,
                    limit: PAGE_SIZE,
                    includes: 'token,collection',
                    fetch
                };

                if (loadMore && store.nextToken) {
                    params.nextToken = store.nextToken;
                }

                const listings = await getListings(params);
                
                const tokens: Token[] = listings
                    .filter(listing => 
                        listing.token !== undefined && 
                        listing.token.owner === listing.seller && 
                        listing.token.approved === algosdk.getApplicationAddress(Number(listing.mpContractId))
                    )
                    .map(listing => {
                        const token = listing.token!;

                        const metadata = typeof token.metadata === 'string' 
                            ? JSON.parse(token.metadata) 
                            : token.metadata;
                        
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
                            isBurned: String(token.isBurned),
                            isListed: true
                        };
                    });

                const responseData = await fetch(`${mimirBaseURL}/mp/listings?active=true&limit=1`).then(res => res.json());

                update(state => {
                    const updatedTokens = loadMore ? [...state.tokens, ...tokens] : tokens;
                    
                    return {
                        tokens: updatedTokens,
                        lastFetched: now,
                        isLoading: false,
                        nextToken: responseData['next-token'] || null,
                        totalCount: responseData['total-count'] || 0
                    };
                });

                const updatedStore = get({ subscribe });
                return updatedStore.tokens;
            } catch (error) {
                console.error('Error fetching listings:', error);
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

export const mimirListingsStore = createListingsStore();

// New function that returns the full token response including next-token
export async function getTokensWithPagination(params: GetTokensParams): Promise<{tokens: Token[], nextToken: string | null, totalCount: number}> {
    if (!params.tokenIds && !params.contractId && !params.owner && !params.tokenId) {
        throw new Error('At least one of tokenIds, contractId, owner, or tokenId must be provided');
    }

    if (!params.fetch) params.fetch = fetch;
    if (!params.limit) params.limit = 50; // Default to a reasonable limit for pagination

    // Create URL parameters, including any metadata property filters
    const urlParams = new URLSearchParams();
    
    // Add standard parameters
    if (params.contractId) urlParams.append('contractId', params.contractId.toString());
    if (params.tokenId) urlParams.append('tokenId', params.tokenId);
    if (params.owner) urlParams.append('owner', params.owner);
    if (params.limit) urlParams.append('limit', params.limit.toString());
    if (params.nextToken) urlParams.append('next-token', params.nextToken);
    // Only add includes if it's specified and not the default 'metadata' value
    if (params.includes && params.includes !== 'metadata') urlParams.append('includes', params.includes);
    
    // Handle metadata search
    if (params.metadataSearch) urlParams.append('metadataText', params.metadataSearch);
    
    // Handle metadata property filters
    if (params.metadataProperties) {
        // metadataProperties is an object like { BACKGROUND: 'Blue', FACE: 'Happy' }
        Object.entries(params.metadataProperties).forEach(([trait, value]) => {
            if (value) {
                urlParams.append(`metadata.properties.${trait}`, value);
            }
        });
    }

    const url = `${mimirBaseURL}/tokens?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: ITokenResponse = await response.json();
        const tokens = await processTokenResponse(data);
        
        if (params.contractId) {
            const tokenMap = get(tokenStore);
            tokens.forEach(token => {
                tokenMap.set(`${token.contractId}_${token.tokenId}`, token);
            });
            tokenStore.set(tokenMap);
        }
        
        return {
            tokens,
            nextToken: data["next-token"],
            totalCount: data["total-count"] || 0
        };
    } catch (err) {
        console.error('Error fetching tokens:', err);
        return {
            tokens: [],
            nextToken: null,
            totalCount: 0
        };
    }
}

// New function that returns the full listings response including next-token
export async function getListingsWithPagination(params: GetListingsParams): Promise<{listings: Listing[], nextToken: string | null, totalCount: number}> {
    if (!params.fetch) params.fetch = fetch;
    if (!params.limit) params.limit = 50; // Default to a reasonable limit for pagination
    
    const urlParams = buildURLParams({
        collectionId: params.collectionId,
        tokenId: params.tokenId,
        seller: params.seller,
        active: params.active !== undefined ? params.active : true,
        'min-price': params.minPrice,
        'max-price': params.maxPrice,
        currency: params.currency,
        limit: params.limit,
        'next-token': params.nextToken,
        includes: params.includes || 'token,collection'
    });

    const url = `${mimirBaseURL}/mp/listings?${urlParams.toString()}`;
    
    try {
        const response = await params.fetch(url);
        const data: IListingResponse = await response.json();
        const listings = processListingResponse(data);
        
        return {
            listings,
            nextToken: data["next-token"],
            totalCount: data["total-count"] || 0
        };
    } catch (err) {
        console.error('Error fetching listings with pagination:', err);
        return {
            listings: [],
            nextToken: null,
            totalCount: 0
        };
    }
}

export async function getCollectors(params: { contractId?: number, limit?: number, fetch?: (input: RequestInfo) => Promise<Response> }) {
    const fetchFn = params.fetch || fetch;
    const body: Record<string, string> = {};
    if (params.contractId !== undefined) body.contractId = params.contractId.toString();
    if (params.limit !== undefined) body.limit = params.limit.toString();
    const urlParams = buildURLParams(body);
    const res = await fetchFn(`${mimirBaseURL}/analytics/collectors?${urlParams.toString()}`);
    const data = await res.json();
    return data.collectors as { owner: string, tokenCount: number }[];
}

