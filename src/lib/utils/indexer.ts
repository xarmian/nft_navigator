import type { Transfer, Token, Collection, Sale, IHighforgeProject } from '$lib/data/types';
import { collectionStore, tokenStore } from '../../stores/collection';
import { get } from 'svelte/store';
import voiGames from '$lib/data/voiGames.json';
import { getCurrency } from './currency';
import { getNFD } from './nfd';

//export const indexerBaseURL = "https://arc72-idx.nftnavigator.xyz/nft-indexer/v1";
//export const indexerBaseURL = "http://localhost:3000/nft-indexer/v1";
export const indexerBaseURL = "https://arc72-idx-mainnet.nftnavigator.xyz/nft-indexer/v1";

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
    metadata: string;
    "mint-round": number;
    approved: string;
    isBurned: boolean;
}

interface ITransfer {
    transactionId: string;
    contractId: number;
    tokenId: number;
    fromAddr: string;
    toAddr: string;
    round: number;
    timestamp: number;
    token?: IToken;
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
    invalidate?: boolean | undefined;
}

interface getCollectionsParams {
    contractId?: number | undefined;
    fetch?: FetchFunction | undefined;
    includes?: string | undefined;
}

export function reformatTokenName(name: string, num?: string | number) {
    if (num !== undefined && name.includes(String(num))) {
        const baseName = name.replace(String(num), '').trim();
        return `${baseName} #${num}`;
    } else {
        const match = name.match(/^(.*?)(\s*#\s*|\s*)(\d+)$/);
        if (match) {
            const baseName = match[1].trim();
            const number = match[3];
            return `${baseName} #${number}`;
        } else {
            return name;
        }
    }
}

export const getTokens = async (params: getTokensParams): Promise<Token[]> => {
    if (params.contractId && !params.invalidate) {
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
    if (params.tokenId) {
        paramsArray.push(['tokenId', params.tokenId.toString()]);
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
            let metadata = null;
            try {
                metadata = JSON.parse(token.metadata);
            } catch (e) {
                metadata = {};
            }
            if (metadata == null) {
                metadata = {};
            }

            const marketData = null;

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
                marketData: marketData,
                salesData: null,
                rank: null,
                traits: (metadata && metadata.properties) ? Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value) : [],
                isBurned: token.isBurned,
            };
        });
        if (params.contractId && !params.tokenId) {
            // token ranks
            tokens = await populateTokenRanking(Number(params.contractId), tokens, params.fetch);
            const tokenMap = get(tokenStore);
            tokenMap.set(Number(params.contractId), tokens);
            tokenStore.set(tokenMap);
        }

        // for each token, get NFD data
        const owners = Array.from(new Set(tokens.map((token: Token) => token.owner)));
        const nfd = await getNFD(owners, params.fetch);
        tokens.forEach((token: Token) => {
            const nfdObj = nfd.find((n: { key: string }) => n.key === token.owner);
            if (nfdObj) {
                token.ownerNFD = nfdObj.replacementValue;
                token.ownerAvatar = nfdObj.avatar;
            }
        });

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
                    if (c.firstToken) {
                        try {
                            const metadata = JSON.parse(c.firstToken.metadata);
                            c.firstToken.metadata = JSON.stringify({ ...metadata, image: p.coverImageURL });
                        } catch (e) {
                            c.firstToken.metadata = JSON.stringify({ });
                        }
                    }
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

export const getTransfers = async (params: { contractId?: string | undefined, tokenId?: string | undefined, user?: string | undefined, fetch: FetchFunction }): Promise<Transfer[]> => {
    const { contractId, tokenId, user } = params;

    if ((contractId && !tokenId) || (!contractId && tokenId)) {
        throw new Error('Both contractId and tokenId must be provided');
    }

    if (!contractId && !tokenId && !user) {
        throw new Error('At least one of contractId and tokenId, or owner must be provided');
    }

    let url = `${indexerBaseURL}/transfers?includes=token`;

    if (contractId && tokenId) {
        url += `&contractId=${contractId}&tokenId=${tokenId}`;
    } else if (user) {
        url += `&user=${user}`;
    }

    try {
        const data = await fetch(url).then((response) => response.json());

        // reverse sort by timestamp
        return data.transfers.map((transfer: ITransfer) => {
            return {
                transactionId: transfer.transactionId,
                contractId: transfer.contractId,
                tokenId: transfer.tokenId,
                from: transfer.fromAddr,
                to: transfer.toAddr,
                round: transfer.round,
                timestamp: transfer.timestamp,
                token: transfer.token ? {
                    contractId: transfer.token.contractId,
                    tokenId: transfer.token.tokenId,
                    owner: transfer.token.owner,
                    metadataURI: transfer.token.metadataURI,
                    metadata: JSON.parse(transfer.token.metadata),
                    mintRound: transfer.token['mint-round'],
                    approved: transfer.token.approved,
                    marketData: null,
                    salesData: null,
                    rank: null,
                } : null,
            };
        }).sort((a: Transfer, b: Transfer) => b.timestamp - a.timestamp);
    } catch (err) {
        console.error(err);
        return [];
    }
}

export const getSales = async (params: { contractId?: string, tokenId?: string, user?: string, sortBy?: string, limit?: number, fetch: FetchFunction }): Promise<Sale[]> => {
    const { contractId, tokenId, user, sortBy, limit } = params;
    let url = `${indexerBaseURL}/mp/sales`;
    const paramsArray = [];
    if (contractId) {
        paramsArray.push(['collectionId', contractId]);
    }
    if (tokenId) {
        paramsArray.push(['tokenId', tokenId]);
    }
    if (user) {
        paramsArray.push(['user', user]);
    }
    if (sortBy) {
        paramsArray.push(['sort', sortBy]);
    }
    if (limit) {
        paramsArray.push(['limit', limit.toString()]);
    }
    const urlParams = new URLSearchParams(paramsArray);
    url += '?' + urlParams.toString();
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data.sales;
    } catch (err) {
        console.error(err);
        return [];
    }
};

export const getSalesAndTransfers = async (params: { contractId?: string | undefined, tokenId?: string | undefined, user?: string | undefined, sortBy?: string, limit?: number, fetch: FetchFunction }): Promise<Transfer[]> => {
    const transfers = await getTransfers(params);
    const sales = await getSales(params);
    for (const t of transfers) {
        const sale = sales.find((s: Sale) => s.transactionId === t.transactionId);
        if (sale) {
            t.salePrice = sale.price;
            t.saleCurrency = await getCurrency(sale.currency);
        }
    }
    return transfers;
}

export async function populateTokenRanking(contractId: number, tokens: Token[], fetch: FetchFunction): Promise<Token[]> {
    // if we have more than one token, use the calculateRarityScore function to get the rarity score for each token
    if (tokens.length > 1) {
        const aggregateTraitCount: Record<string, Record<string, number>> = {};
        const totalNFTsInCollection = tokens.length;
        tokens.forEach((token: Token) => {
            for (const category in token.metadata?.properties) {
                if (!aggregateTraitCount[category]) {
                    aggregateTraitCount[category] = {};
                }
                const traitName = token.metadata?.properties[category];
                if (!aggregateTraitCount[category][traitName]) {
                    aggregateTraitCount[category][traitName] = 0;
                }
                aggregateTraitCount[category][traitName]++;
            }
        });

        const rarityArray: { tokenId: number; rarity: number }[] = [];
        tokens.forEach((token: Token) => {
            try {
                if (!token.metadata) throw new Error('No metadata');
                const rarity = calculateRarityScore(aggregateTraitCount, token.metadata.properties, totalNFTsInCollection);
                rarityArray.push({ tokenId: token.tokenId, rarity });
            }
            catch(err) {
                rarityArray.push({ tokenId: token.tokenId, rarity: 0 });
            }
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