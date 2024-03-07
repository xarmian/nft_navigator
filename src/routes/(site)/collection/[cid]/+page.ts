import type { PageLoad } from './$types';
import type { Token, Listing, IHighforgeProject } from '$lib/data/types';
import { getTokens } from '$lib/utils/indexer';
import voiGames from '$lib/data/voiGames.json';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	let tokens: Token[] = [];
	let collectionName: string = '';
	let isVoiGames: boolean = false;

	if (contractId) {

		tokens = (await getTokens({ contractId, fetch })).sort((a: Token, b: Token) => a.tokenId - b.tokenId);
		collectionName = tokens[0].metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';

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

		// check if included in voiGames
		isVoiGames = (voiGames.find((v: IHighforgeProject) => v.applicationID === Number(contractId))) ? true : false;
	}

	return {
		contractId: params.cid,
		tokens,
		collectionName,
		isVoiGames: isVoiGames ? true : false,
	};
}) satisfies PageLoad;
