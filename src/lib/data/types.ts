import type { AggregatedNFD } from "$lib/utils/nfd";

// types.ts
export interface Token {
	ownerAvatar?: string | null;
    owner: string;
    ownerNFD?: string | null;
    contractId: number;
    tokenId: number;
    mintRound: number;
    metadata?: Metadata;
    metadataURI: string;
    approved: string;
	marketData?: Listing | null | undefined;
    salesData?: Sale | null | undefined;
    rank: number | null;
	traits?: string[] | undefined;
    isBurned: boolean;
}

export interface Transfer {
    contractId: number;
    tokenId: string;
    from: string;
    to: string;
    round: number;
    transactionId: string;
    timestamp: number;
    salePrice: number | null;
    saleCurrency: Currency | null;
    token?: Token | null;
}

export interface Collection {
	gameData: IHighforgeProject | null;
    highforgeData: IHighforgeProject | null;
	firstToken: RawToken | null;
    contractId: number;
    totalSupply: number;
    burnedSupply: number;
    mintRound: number;
    tokens: Token[];
    uniqueOwners?: number | undefined;
    popularity?: number;
    creator: string;
    globalState?: Array<{ key: string; value: string }>;
}

export interface IPoll {
    options: Record<number, string>;
    endTime: string;
    voteWeight: 'wallet' | 'token';
    votes?: Record<number, number>;
    alwaysShowResults?: boolean;
    anonymousVotes?: boolean;
    voted?: number;
    publicVoting?: boolean;
}

export interface IPollResponse {
    id: number;
    messages_id: number;
    wallet_id: string;
    response: number;
    response_time: string;
}

export interface RawToken {
    owner: string;
    contractId: number;
    tokenId: number;
    "mint-round": number;
    metadata: string;
    metadataURI: string;
    approved: string;
    isBurned: boolean;
}

export interface Metadata {
    name: string;
    description: string;
    image: string;
    image_integrity: string;
    image_mimetype: string;
    properties: Record<string, string>;
    royalties: string;
}

export interface Listing {
    transactionId: string;
    mpContractId: number;
    mpListingId: number;
    collectionId: number;
    tokenId: number;
    price: number;
    currency: number;
    seller: string;
    createTimestamp: number;
    sale: null | Sale;
    delete: null | object;
    source: string | null; // arcpay, nautilus, etc. null will be nautilus for now    
}

export interface Sale {
    transactionId: string;
    seller: string;
    buyer: string;
    price: number;
    currency: number;
    timestamp: number;
    tokenId: number;
    collectionId: number;
    listing: Listing;
    round: number;
}

export interface Currency {
    assetId: number;
    name: string;
    unitName: string
    total: number;
    decimals: number;
}

// highforge voi games project data
export interface IHighforgeProject {
    applicationID: number;
    coverImageURL: string;
    description: string;
    earlyAccessDateTime: string;
    indexerState: object;
    lastNFTSoldAt: string;
    mintTotal: number;
    nsfw: boolean;
    publicLaunchDateTime: string;
    title: string;
}

export type NReaction = {
    messages_id?: number;
    comments_id?: number;
    reaction: number;
}

export type NMessage = {
    id?: number;
    walletId: string;
    message: string;
    timestamp: string;
    private: boolean;
    collectionId: string;
    nfd?: AggregatedNFD;
    comments?: NComment[];
    reactions?: number[];
    reactions_json?: { [key: number]: string } | undefined;
    mr?: NReaction[];
    poll?: IPoll;
    images?: string[];
};

export type NComment = {
    id?: number;
    walletId: string;
    comment: string;
    timestamp: string;
    nfd?: AggregatedNFD;
    reactions?: number[];
    reactions_json?: { [key: number]: string } | undefined;
    mcr?: NReaction[];
};

export type NPollResponse = {
    id?: number;
    messages_id: number;
    walletId: string;
    response: string;
    response_time: string;
};

