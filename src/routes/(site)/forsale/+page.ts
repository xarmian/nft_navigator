/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Token, Listing  } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';
import algosdk from 'algosdk';

export const load = (async ({ fetch }) => {
    const data = await (await fetch('https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings?active=true&limit=500')).json();
    const listings = data.listings as Listing[];
    const tokens: Token[] = [];

    console.log(listings.length);

    // build array of collectionId+'_'+tokenId from listings and use with tokenIds[] to get token data
    const tokenIds = listings.map((l: Listing) => l.collectionId + '_' + l.tokenId).join(',');

    const tokenData = await (await fetch(`https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens/?tokenIds=${tokenIds}`)).json();
    //const tokenData = { tokens: [] };

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
            });
        }
    });

	return {
		tokens,
        voiGames,
	};
}) satisfies PageLoad;
