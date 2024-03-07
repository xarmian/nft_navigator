/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Token, Listing  } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';

export const load = (async ({ fetch }) => {
    const data = await (await fetch('https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings?active=true')).json();
    const listings = data.listings as Listing[];
    const tokens: Token[] = [];

    // build array of collectionId+'_'+tokenId from listings and use with tokenIds[] to get token data
    const tokenIds = listings.map((l: Listing) => l.collectionId + '_' + l.tokenId).join(',');

    const tokenData = await (await fetch(`https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens/?tokenIds=${tokenIds}`)).json();

    tokenData.tokens.forEach((data: any) => {
        const metadata = JSON.parse(data.metadata);
        tokens.push({
            contractId: data.contractId,
            tokenId: data.tokenId,
            owner: data.owner,
            ownerNFD: null,
            metadataURI: data.metadataURI,
            metadata: metadata,
            mintRound: data['mint-round'],
            approved: data.approved,
            marketData: listings?.find((l: Listing) => l.collectionId === data.contractId && l.tokenId === data.tokenId),
            salesData: null,
            rank: null,
            traits: Object.entries(metadata.properties).map(([key, value]) => key + ': ' + value),
        });
    });

	return {
		tokens,
        voiGames,
	};
}) satisfies PageLoad;
