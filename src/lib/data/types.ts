// types.ts
export interface Token {
    owner: string;
    ownerNFD: string | unknown;
    contractId: number;
    tokenId: number;
    mintRound: number;
    metadata: Metadata;
    metadataURI: string;
    approved: string;
	marketData: Listing | null | undefined;
    salesData: Sale | null | undefined;
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
	firstToken: RawToken;
    contractId: number;
    totalSupply: number;
    mintRound: number;
    tokens: Token[];
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
    seller: string;
    timestamp: number;
    sale: null | Sale;
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