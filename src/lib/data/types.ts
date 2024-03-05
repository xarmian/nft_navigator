// types.ts
export interface Token {
    owner: string;
    ownerNFD?: string | unknown;
    contractId: number;
    tokenId: number;
    mintRound: number;
    metadata: Metadata;
    metadataURI: string;
    approved: string;
	marketData?: Listing | null | undefined;
    salesData?: Sale | null | undefined;
    rank: number | null;
	traits?: string[] | undefined;
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
    saleCurrency: Currency;
}

export interface Collection {
	gameData: IHighforgeProject | null;
	firstToken: RawToken;
    contractId: number;
    totalSupply: number;
    mintRound: number;
    tokens: Token[];
    uniqueOwners?: number | undefined;
}

export interface RawToken {
    owner: string;
    contractId: number;
    tokenId: number;
    "mint-round": number;
    metadata: string;
    metadataURI: string;
    approved: string;
}

export interface Metadata {
    name: string;
    description: string;
    image: string;
    image_integrity: string;
    image_mimetype: string;
    properties: object;
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
    timestamp: number;
    sale: null | Sale;
    delete: null | object;
}

export interface Sale {
    transactionId: string;
    buyer: string;
    price: number;
    timestamp: number;
}

export interface Currency {
    id: number;
    name: string;
    symbol: string;
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