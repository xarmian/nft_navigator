import type { Token, Collection } from '$lib/data/types';
import { getNFD } from '$lib/utils/nfd';
import { reformatTokenName, getTokens, getCollection } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../../../$types';

export const load = (async ({ params, fetch }) => {
	const contractId = Number(params.cid);
	const tokenId = params.tokenid;
	let token: Token | null = null;
	let collection: Collection | null = null;

	if (contractId && tokenId) {
		const tokens = await getTokens({ contractId, tokenId, fetch });
		token = tokens.find((t) => t.tokenId === tokenId) ?? null;
		
		// get NFD for owner
		if (token) {
			const nfd = await getNFD([token.owner], fetch);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const nfdObj = nfd.find((n: any) => n.key === token?.owner);
			if (nfdObj) {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore
				token.ownerNFD = nfdObj.replacementValue;
			}
		}

		// get collection
		collection = await getCollection({ contractId, fetch });
	}

	const tokenName = reformatTokenName(token?.metadata.name??'', token?.tokenId);
	//const collectionName = token?.metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';

	const pageMetaTags = {
		title: tokenName,
		description: token?.metadata?.description,
		imageUrl: token?.metadata?.image,
	  };

	return {
		contractId: params.cid,
		tokenId: params.tokenid,
		token: token,
		collection: collection,
		pageMetaTags,
	};
}) satisfies LayoutServerLoad;
