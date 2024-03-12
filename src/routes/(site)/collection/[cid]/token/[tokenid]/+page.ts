import type { PageLoad } from './$types';
import type { Token } from '$lib/data/types';
import { getNFD } from '$lib/utils/nfd';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	const tokenId = params.tokenid;
	let token: Token | null = null;

	if (contractId && tokenId) {
		const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens?contractId=${contractId}&tokenId=${tokenId}`;
		try {
			const data = await fetch(url).then((response) => response.json());
			if (data.tokens.length > 0) {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				token = data.tokens.map((token: any) => {
					return {
						contractId: token.contractId,
						tokenId: token.tokenId,
						owner: token.owner,
						metadataURI: token.metadataURI,
						metadata: JSON.parse(token.metadata),
						mintRound: token['mint-round'],
						approved: token.approved,
					}
				})[0];

				// get NFD for owner
				if (token) {
					const nfd = await getNFD([token.owner]);
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const nfdObj = nfd.find((n: any) => n.key === token?.owner);
					if (nfdObj) {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						token.ownerNFD = nfdObj.replacementValue;
					}
				}
			}
		}
		catch(err) {
			console.error(err);
		}
	}

	const pageMetaTags = {
		title: token?.metadata?.name,
		description: token?.metadata?.description,
		imageUrl: token?.metadata?.image,
	  };

	return {
		contractId: params.cid,
		tokenId: params.tokenid,
		token: token,
		pageMetaTags,
	};
}) satisfies PageLoad;
