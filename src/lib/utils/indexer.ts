import type { Token, Collection, Metadata, Sale } from '$lib/data/types';

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
    mintRound: number;
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
        const response = await fetch(url);
        const data: ITokenResponse = await response.json();
        return data.tokens.map((token: IToken) => {
            const metadata: Metadata = JSON.parse(token.metadata?.toString() ?? "{}");
            return {
                contractId: token.contractId,
                tokenId: token.tokenId,
                owner: token.owner,
                ownerNFD: null,
                metadataURI: token.metadataURI,
                metadata: metadata,
                mintRound: token.mintRound,
                approved: token.approved,
                marketData: null,
                salesData: null,
                rank: null,
                traits: Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value),
            };
        });
    } catch (err) {
        console.error(err);
        return [];
    }
}

export const getCollections = async (params: getCollectionsParams): Promise<Collection[]> => {
    if (!params.fetch) params.fetch = fetch;

    let url = `${indexerBaseURL}/collections`;

    const paramsArray = [];
    if (params.contractId) {
        paramsArray.push(['contractId', params.contractId.toString()]);
    }
    if (params.includes) {
        paramsArray.push(['includes', params.includes.toString()]);
    }

    const urlParams = new URLSearchParams(paramsArray);
    url += '?' + urlParams.toString();

    try {
        const response = await fetch(url);
        const data: ICollectionResponse = await response.json();
        return data.collections;
    } catch (err) {
        console.error(err);
        return [];
    }
}

export const getSales = async (contractId: number | null = null, limit: number | null = null, fetch: FetchFunction): Promise<Sale[]> => {
    let url = `${indexerBaseURL}/mp/sales?`;
    if (contractId) {
        url += `contractId=${contractId}`;
    }
    if (limit) {
        url += `&limit=${limit}`;
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