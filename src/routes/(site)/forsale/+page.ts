/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Token, Listing  } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';
import algosdk from 'algosdk';
import { indexerBaseURL } from '$lib/utils/indexer';

export const load = (async ({ fetch }) => {
    const data = await (await fetch(`${indexerBaseURL}/mp/listings?active=true`)).json();
    const listings = data.listings as Listing[];
    const tokens: Token[] = [];

    // build array of collectionId+'_'+tokenId from listings and use with tokenIds[] to get token data
    const tokenIds = listings.map((l: Listing) => l.collectionId + '_' + l.tokenId);

    // Split tokenIds into chunks of 500
    const chunks = [];
    for (let i = 0; i < tokenIds.length; i += 500) {
        chunks.push(tokenIds.slice(i, i + 500));
    }

    // Make a request for each chunk and concatenate the results
    const tokenData = { tokens: <Token[]>[] };
    for (const chunk of chunks) {
        const response = await fetch(`${indexerBaseURL}/tokens/?tokenIds=${chunk.join(',')}`);
        const data = await response.json();
        tokenData.tokens = [...tokenData.tokens, ...data.tokens];
    }

    tokenData.tokens.forEach((data: any) => {
        const metadata = JSON.parse(data.metadata);
        const listing = listings?.find((l: Listing) => l.collectionId === data.contractId && l.tokenId === data.tokenId);
        if (data.owner == listing?.seller && data.approved == algosdk.getApplicationAddress(Number(listing?.mpContractId))) {
            tokens.push({
                contractId: data.contractId,
                tokenId: data.tokenId,
                owner: data.owner,
                ownerNFD: null,
                metadataURI: data.metadataURI,
                metadata: metadata,
                mintRound: data['mint-round'],
                approved: data.approved,
                marketData: listing,
                salesData: null,
                rank: null,
                traits: Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value),
                isBurned: data.isBurned,
            });
        }
    });

    const pageMetaTags = {
        title: 'For Sale | NFT Navigator',
        description: 'NFT Tokens for Sale',
      };

	return {
		tokens,
        voiGames,
        pageMetaTags,
	};
});
