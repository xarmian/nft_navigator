/* eslint-disable @typescript-eslint/no-explicit-any */
import { getNFD } from '$lib/utils/nfd';
import type { Token } from '$lib/data/types';
import { getCollections, getTokens } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../$types';
import { indexerBaseURL } from '$lib/utils/indexer';
import { selectedWallet } from 'avm-wallet-svelte';
import { get } from 'svelte/store';

export const load = (async ({ params, fetch }) => {
	const walletId: string | undefined = (((params.id??'').length) > 0) ? params.id : get(selectedWallet)?.address;

	let walletNFD: null | string = null;
	let walletAvatar: undefined | string = undefined;
	let tokens: Token[] = [];
	const approvals: Token[] = [];
	const collections = await getCollections({ fetch });

	try {
		if (walletId) {
			const nfd = await getNFD([walletId]);
			const nfdObj: any = nfd.find((n: any) => n.key === walletId);
			walletNFD = nfdObj?.replacementValue ?? undefined;
			walletAvatar = nfdObj?.avatar ?? '/blank_avatar_small.png';

			// owned tokens
			tokens = await getTokens({ owner: walletId, invalidate: true });
			/*const url = `${indexerBaseURL}/tokens?owner=${walletId}`;
			const data = await fetch(url).then((response: any) => response.json());
			data.tokens.forEach((token: any) => {
				console.log(token);
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
			});*/

			// approved tokens
			const aurl = `${indexerBaseURL}/tokens?approved=${walletId}`;
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
