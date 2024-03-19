import type { PageLoad } from './$types';
import type { Token } from '$lib/data/types';
import { getNFD } from '$lib/utils/nfd';
import { reformatTokenName, getTokens } from '$lib/utils/indexer';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	const tokenId = Number(params.tokenid);
	let token: Token | null = null;

	if (contractId && tokenId) {
		const tokens = await getTokens({ contractId, tokenId, fetch });
		token = tokens.find((t) => t.tokenId === Number(tokenId)) ?? null;
		
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
	}

	const tokenName = reformatTokenName(token?.metadata.name??'');
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
		pageMetaTags,
	};
}) satisfies PageLoad;
