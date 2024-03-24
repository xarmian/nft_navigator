import type { Token, Collection, Metadata, Sale, IHighforgeProject } from '$lib/data/types';
import { collectionStore, tokenStore } from '../../stores/collection';
import { get } from 'svelte/store';
import voiGames from '$lib/data/voiGames.json';


const indexerBaseURL = "https://arc72-idx.nftnavigator.xyz/nft-indexer/v1";

interface ITokenResponse {
    tokens: IToken[];
    currentRound: number;
}

interface ICollectionResponse {
    collections: Collection[];
    currentRound: number;
}

interface IToken {
    contractId: number;
    tokenId: number;
    owner: string;
    metadataURI: string;
    metadata: object;
    "mint-round": number;
    approved: string;
}

interface FetchFunction {
    (input: string | URL | Request, init?: RequestInit | undefined): Promise<Response>;
}

interface getTokensParams {
    contractId?: string | number;
    fetch?: FetchFunction | undefined;
    limit?: number | undefined;
    owner?: string | undefined;
    tokenId?: number | undefined;
}

interface getCollectionsParams {
    contractId?: number | undefined;
    fetch?: FetchFunction | undefined;
    includes?: string | undefined;
}

export function reformatTokenName(name: string) {
    const match = name.match(/^(.*?)(\s*#\s*|\s*)(\d+)$/);
    if (match) {
        const baseName = match[1].trim();
        const number = match[3];
        return `${baseName} #${number}`;
    } else {
        return name;
    }
}

export const getTokens = async (params: getTokensParams): Promise<Token[]> => {
    if (params.contractId) {
        const tokens: Token[] | undefined = get(tokenStore).get(Number(params.contractId));
        if (tokens && tokens.length > 0) {
            if (params.tokenId) {
                return tokens.filter((token: Token) => token.tokenId === params.tokenId);
            }
            return tokens;
        }
    }

    if (!params.fetch) params.fetch = fetch;
    
    let url = `${indexerBaseURL}/tokens`;

    const paramsArray = [];
    if (params.contractId) {
        paramsArray.push(['contractId', params.contractId.toString()]);
    }
    if (params.limit) {
        paramsArray.push(['limit', params.limit.toString()]);
    }
    if (params.owner) {
        paramsArray.push(['owner', params.owner]);
    }

    const urlParams = new URLSearchParams(paramsArray);
    url += '?' + urlParams.toString();
    
    try {
        const response = await params.fetch(url);
        const data: ITokenResponse = await response.json();
        let tokens: Token[] = data.tokens.map((token: IToken) => {
            const metadata: Metadata = JSON.parse(token.metadata?.toString() ?? "{}");
            return {
                contractId: token.contractId,
                tokenId: token.tokenId,
                owner: token.owner,
                ownerNFD: null,
                ownerAvatar: '/blank_avatar_small.png',
                metadataURI: token.metadataURI,
                metadata: metadata,
                mintRound: token['mint-round'],
                approved: token.approved,
                marketData: null,
                salesData: null,
                rank: null,
                traits: Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value),
            };
        });
        if (params.contractId) {
            // token ranks
            tokens = await populateTokenRanking(Number(params.contractId), tokens, params.fetch);
            const tokenMap = get(tokenStore);
            tokenMap.set(Number(params.contractId), tokens);
            tokenStore.set(tokenMap);
        }
        return tokens;
    } catch (err) {
        console.error(err);
        return [];
    }
}

export const getCollection = async (params: { contractId: number, fetch?: FetchFunction } ): Promise<Collection | null> => {
    const collections = get(collectionStore);
    const collection = collections.find((c: Collection) => c.contractId === params.contractId);
    if (collection) {
        return collection;
    } else {
        const newCollections = await getCollections(params);
        return newCollections[0] ?? null;
    }
}

export const getCollections = async (params: getCollectionsParams): Promise<Collection[]> => {
    if (!params.contractId) {
        const collections = get(collectionStore);
        if (collections.length > 0) return collections;
    }

    if (!params.fetch) params.fetch = fetch;

    let url = `${indexerBaseURL}/collections`;

    const paramsArray = [];
    paramsArray.push(['includes', 'unique-owners']);
    if (params.contractId) {
        paramsArray.push(['contractId', params.contractId.toString()]);
    }

    const urlParams = new URLSearchParams(paramsArray);
    url += '?' + urlParams.toString();

    try {
        const response = await params.fetch(url);
        const data: ICollectionResponse = await response.json();
        const c = data.collections.filter((c: Collection) => c.firstToken !== null);

        const hfurl = 'https://test-voi.api.highforge.io/projects';
        const hfresponse = await params.fetch(hfurl);
        const hfdata = await hfresponse.json();
        const hfprojects = hfdata.results;
    
        // for each project, replace collection's firstToken url with projects.coverImageURL
        c.forEach((c: Collection) => {
            hfprojects.forEach((p: IHighforgeProject) => {
                if (c.contractId === p.applicationID) {
                    const metadata = JSON.parse(c.firstToken.metadata);
                    c.firstToken.metadata = JSON.stringify({ ...metadata, image: p.coverImageURL });
                    c.highforgeData = p;
                }
            });
        });

        voiGames.forEach((game: IHighforgeProject) => {
            c.forEach((co: Collection) => {
                if (co.contractId === game.applicationID) {
                    co.gameData = game;
                }
            });
        });
 
        if (!params.contractId) collectionStore.set(c);
        return c;
    } catch (err) {
        console.error(err);
        return [];
    }
}

export const getSales = async (contractId: number | null = null, sortBy: string, limit: number | null = null, fetch: FetchFunction): Promise<Sale[]> => {
    let url = `${indexerBaseURL}/mp/sales?`;
    if (contractId) {
        url += `contractId=${contractId}`;
    }
    if (limit) {
        url += `&limit=${limit}`;
    }
    if (sortBy) {
        url += '&sort=' + sortBy;
    }
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.sales;
    } catch (err) {
        console.error(err);
        return [];
    }
};

export async function populateTokenRanking(contractId: number, tokens: Token[], fetch: FetchFunction): Promise<Token[]> {
    // if we have more than one token, use the calculateRarityScore function to get the rarity score for each token
    if (tokens.length > 1) {
        const aggregateTraitCount: Record<string, Record<string, number>> = {};
        const totalNFTsInCollection = tokens.length;
        tokens.forEach((token: Token) => {
            for (const category in token.metadata.properties) {
                if (!aggregateTraitCount[category]) {
                    aggregateTraitCount[category] = {};
                }
                const traitName = token.metadata.properties[category];
                if (!aggregateTraitCount[category][traitName]) {
                    aggregateTraitCount[category][traitName] = 0;
                }
                aggregateTraitCount[category][traitName]++;
            }
        });

        const rarityArray: { tokenId: number; rarity: number }[] = [];
        tokens.forEach((token: Token) => {
            const rarity = calculateRarityScore(aggregateTraitCount, token.metadata.properties, totalNFTsInCollection);
            rarityArray.push({ tokenId: token.tokenId, rarity });
        });

        rarityArray.sort((a, b) => b.rarity - a.rarity);

        let currentRank = 1;
        let previousRarity: number = 0; // Initialize previousRarity with a default value of 0

        tokens.forEach((token: Token) => {
            const rarity = rarityArray.find((r) => r.tokenId === token.tokenId)?.rarity;
            if (rarity === previousRarity) {
                token.rank = currentRank;
            } else {
                token.rank = rarityArray.findIndex((r) => r.rarity === rarity) + 1;
                currentRank = token.rank;
                previousRarity = rarity as number; // Cast rarity as number
            }
        });

        return tokens;
    }

    const rankingUrl = `https://test-voi.api.highforge.io/assets/traitInfo/${contractId}`;
    const assetIDs = tokens.filter((token: Token) => !token.rank).map((token: Token) => token.tokenId);
    if (assetIDs.length > 0) {
        try {
            const resp = await fetch(rankingUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ assetIDs })
            });
            const rankingData = await resp.json();
            tokens.forEach((token: Token) => {
                // rankingData.assets is an object with a key that is the token id
                const rankingToken = rankingData.assets[token.tokenId];
                if (rankingToken) {
                    token.rank = rankingToken['HF--rank'];
                }
            });
        }
        catch(err) {
            console.error(err);
        }
    }
    return tokens;
}

export function calculateRarityScore(
    aggregateTraitCount: Record<string, Record<string, number>>, // a map that tracks categories -> traits -> traitCount
    nftProperties: Record<string, string>, // the current NFT being scored
    totalNFTsInCollection: number, // number of NFTs currently minted in the project
  ) {
    let rarityScore = 0;
    for (const category in nftProperties) {
      const traitName = nftProperties[category];
      const totalOccurrence = aggregateTraitCount[category][traitName] ?? 1;
      rarityScore += totalNFTsInCollection / totalOccurrence;
    }
    return rarityScore;
}