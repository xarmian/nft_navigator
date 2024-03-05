import type { Token, Collection, Metadata } from '$lib/data/types';

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
    const match = name.match(/^(.*?)(\d+)$/);
    if (match) {
        const baseName = match[1].trim();
        const number = match[2];
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