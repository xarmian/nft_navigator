/* eslint-disable @typescript-eslint/no-explicit-any */
import { getNFD } from '$lib/utils/nfd';
import type { Token } from '$lib/data/types';
import { getCollections } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../$types';
import { indexerBaseURL } from '$lib/utils/indexer';

export const load = (async ({ params, fetch }) => {
	const walletId: string = params.id??'';
	const walletIds = walletId.split(',');
	let walletNFD: null | string = null;
	let walletAvatar: undefined | string = undefined;
	const tokens: Token[] = [];
	const approvals: Token[] = [];
	const collections = await getCollections({ fetch });

	try {
		const nfd = await getNFD([walletIds[0]], fetch); // nfd is array of objects with key = owner, replacementValue = nfd
		const nfdObj: any = nfd.find((n: any) => n.key === walletIds[0]);
		walletNFD = nfdObj?.replacementValue ?? undefined;
		walletAvatar = nfdObj?.avatar ?? '/blank_avatar_small.png';

		// owned tokens
		for(const wid of walletIds) {
			const url = `${indexerBaseURL}/tokens?owner=${wid}`;
			const data = await fetch(url).then((response: any) => response.json());
			data.tokens.forEach((token: any) => {
				tokens.push({
					contractId: token.contractId,
					tokenId: token.tokenId,
					owner: token.owner,
					ownerNFD: nfdObj?.replacementValue ?? null,
					metadataURI: token.metadataURI,
					metadata: JSON.parse(token.metadata ?? '{}'),
					mintRound: token['mint-round'],
					approved: token.approved,
					marketData: undefined,
					salesData: undefined,
					rank: null,
					isBurned: token.isBurned,
				});
			});

			// approved tokens
			const aurl = `${indexerBaseURL}/tokens?approved=${wid}`;
			const adata = await fetch(aurl).then((response: any) => response.json());
			adata.tokens.forEach((token: any) => {
				approvals.push({
					contractId: token.contractId,
					tokenId: token.tokenId,
					owner: token.owner,
					ownerNFD: walletNFD,
					metadataURI: token.metadataURI,
					metadata: JSON.parse(token.metadata ?? '{}'),
					mintRound: token['mint-round'],
					approved: token.approved,
					marketData: undefined,
					salesData: undefined,
					rank: null,
					isBurned: token.isBurned,
				});
			});
		}
	}
	catch(err) {
		console.error(err);
	}

	const pageMetaTags = {
		title: 'Portfolio - ' + (walletNFD ?? walletId),
		description: 'NFT Navigator Portfolio: ' + (walletNFD ?? walletId),
		imageUrl: walletAvatar,
	};

	return {
		props: {
			walletId,
			walletNFD,
			walletAvatar,
			tokens,
			approvals,
			collections,
		},
		pageMetaTags,
	};
}) satisfies LayoutServerLoad;
