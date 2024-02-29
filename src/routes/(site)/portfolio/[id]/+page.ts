/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import { getNFD } from '$lib/utils/nfd';
import type { Token } from '$lib/data/types';

export const load = (async ({ params, fetch }) => {
	const walletId: string = params.id;
	const walletIds = walletId.split(',');
	let walletNFD: null | string = null;
	const tokens: Token[] = [];
	const approvals: Token[] = [];

	try {
		const nfd = await getNFD([walletIds[0]]); // nfd is array of objects with key = owner, replacementValue = nfd
		const nfdObj: any = nfd.find((n: any) => n.key === walletIds[0]);
		if (nfdObj) {
			walletNFD = nfdObj.replacementValue;
		}

		// owned tokens
		for(const wid of walletIds) {
			const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens?owner=${wid}`;
			const data = await fetch(url).then((response) => response.json());
			data.tokens.forEach((token: any) => {
				tokens.push({
					contractId: token.contractId,
					tokenId: token.tokenId,
					owner: token.owner,
					ownerNFD: walletNFD,
					metadataURI: token.metadataURI,
					metadata: JSON.parse(token.metadata),
					mintRound: token['mint-round'],
					approved: token.approved,
					marketData: undefined,
					salesData: undefined,
				});
			});

			// approved tokens
			const aurl = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/tokens?approved=${wid}`;
			const adata = await fetch(aurl).then((response) => response.json());
			adata.tokens.forEach((token: any) => {
				approvals.push({
					contractId: token.contractId,
					tokenId: token.tokenId,
					owner: token.owner,
					ownerNFD: walletNFD,
					metadataURI: token.metadataURI,
					metadata: JSON.parse(token.metadata),
					mintRound: token['mint-round'],
					approved: token.approved,
					marketData: undefined,
					salesData: undefined,
				});
			});
		}
	}
	catch(err) {
		console.error(err);
	}

	return {
		props: {
			walletId,
			walletNFD,
			tokens,
			approvals,
		},
	};
}) satisfies PageLoad;
