import type { PageLoad } from './$types';
import type { Token, Listing } from '$lib/data/types';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	let tokens: Token[] = [];
	let collectionName: string = '';

	if (contractId) {
		const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens?contractId=${contractId}`;
		try {
			const data = await fetch(url).then((response) => response.json());
			if (data.tokens.length > 0) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				tokens = data.tokens.map((token: any) => {
					const metadata = JSON.parse(token.metadata);
					
					return {
						contractId: token.contractId,
						tokenId: token.tokenId,
						owner: token.owner,
						metadataURI: token.metadataURI,
						metadata: metadata,
						mintRound: token['mint-round'],
						approved: token.approved,
						//marketId: token.marketId,
					}
				});
				collectionName = tokens[0].metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
			}

		}
		catch(err) {
			console.error(err);
		}

		// get marketplace data for collection
		const marketUrl = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings/?collectionId=${contractId}&active=true`;
		try {
			const marketData = await fetch(marketUrl).then((response) => response.json());
			if (marketData.listings.length > 0) {
				tokens.forEach((token: Token) => {
					const marketToken = marketData.listings.find((listing: Listing) => listing.tokenId === token.tokenId);
					if (marketToken && !marketToken.sale) {
						token.marketData = marketToken;
					}
				});
			}
		}
		catch(err) {
			console.error(err);
		}

		// get ranking data for collection
		const rankingUrl = `https://test-voi.api.highforge.io/assets/traitInfo/${contractId}`;
		try {
			const assetIDs = tokens.map((token: Token) => token.tokenId);
			const response = await fetch(rankingUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ assetIDs })
			});
			const rankingData = await response.json();
			if (rankingData) {
				tokens.forEach((token: Token) => {
					// rankingData.assets is an object with a key that is the token id
					const rankingToken = rankingData.assets[token.tokenId];
					if (rankingToken) {
						token.rank = rankingToken['HF--rank'];
					}
				});
			}
		}
		catch(err) {
			console.error(err);
		}
	}

	return {
		contractId: params.cid,
		tokens,
		collectionName,
	};
}) satisfies PageLoad;
