import type { AggregatedNFD } from "$lib/utils/nfd";

// types.ts
export interface Token {
	ownerAvatar?: string | null;
    owner: string;
    ownerNFD?: string | null;
    contractId: number;
    tokenId: string;
    mintRound: number;
    metadata?: Metadata;
    metadataURI: string;
    approved: string;
	marketData?: Listing | null | undefined;
    salesData?: Sale | null | undefined;
    rank: number | null;
	traits?: string[] | undefined;
    isBurned: boolean;
    isListed?: boolean;
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
	gameData?: IHighforgeProject | null;
    highforgeData?: IHighforgeProject | null;
	firstToken?: RawToken | null;
    metadata?: string;
    contractId: number;
    totalSupply: number;
    burnedSupply: number;
    mintRound: number;
    tokens: Token[];
    uniqueOwners?: number | undefined;
    popularity?: number;
    creator: string;
    imageUrl: string;
    name: string;
    creatorName?: string | undefined;
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
    tokenId: string;
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
    envoiName?: string;
    envoiMetadata?: {
        url?: string;
        avatar?: string;
        location?: string;
        'com.twitter'?: string;
        'com.github'?: string;
        [key: string]: string | undefined;
    };
    collection?: {
        name: string;
        family?: string;
    };
    attributes?: Array<{
        trait_type: string;
        value: string | number;
    }>;
}

export interface Listing {
    transactionId: string;
    mpContractId: number;
    mpListingId: number;
    collectionId: number;
    tokenId: string;
    price: number;
    currency: number;
    seller: string;
    createTimestamp: number;
    sales: null | Sale[];
    auctions: null | Auction[];
    delete: null | object;
    source: string | null; // arcpay, nautilus, etc. null will be nautilus for now    
    type: string | null; // sale, auction, dutch_auction
    sale: null | Sale;
    token?: {
        owner: string;
        tokenId: string;
        approved: string;
        isBurned: string;
        metadata: string | Record<string, unknown>;
        metadataURI?: string;
        mintRound: string | number;
    };
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
    createRound?: number;
    endTimestamp?: number;
    royalty?: string;
    staking?: null | Record<string, unknown>;
}

export interface Auction {
    created_at: string;
    duration: number;
    id: number;
    increment: number;
    listing_id: string;
    start_price: number;
    updated_at: null | string;
}

export interface Sale {
    transactionId: string;
    seller: string;
    buyer: string;
    price: number;
    currency: number;
    timestamp: number;
    tokenId: string;
    collectionId: number;
    listing: Listing;
    round: number;
}

export interface Currency {
    assetId: number;
    name: string;
    unitName: string
    symbol?: string;
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

