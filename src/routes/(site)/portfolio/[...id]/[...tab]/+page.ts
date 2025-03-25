/* eslint-disable @typescript-eslint/no-explicit-any */
import { getEnvoiNames } from '$lib/utils/envoi';
import type { EnvoiNameResult } from '$lib/data/types';
import type { Token } from '$lib/data/types';
import { getCollections, getTokens } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../../$types';
import { indexerBaseURL } from '$lib/utils/indexer';
import { selectedWallet } from 'avm-wallet-svelte';
import { get } from 'svelte/store';
import { redirect } from '@sveltejs/kit';

export const load = (async ({ params, fetch }) => {
	// Split the path segments and handle them properly
	const pathSegments = params.id?.split('/') || [];
	const lastSegment = pathSegments[pathSegments.length - 1];
	
	// Determine if the last segment is a valid tab
	const validTabs = ['analytics', 'collections', 'gallery', 'activity', 'settings'];
	const isLastSegmentTab = validTabs.includes(lastSegment);

	// Extract wallet ID and tab from path segments
	let walletId: string | undefined;
	let tab: string;

	if (isLastSegmentTab) {
		// If last segment is a tab, wallet ID is everything before it
		walletId = pathSegments.slice(0, -1).join('/');
		tab = lastSegment;
	} else {
		// If last segment is not a tab, it's part of the wallet ID
		walletId = params.id;
		tab = 'analytics';
	}

	// If no wallet ID, use selected wallet
	if (!walletId) {
		walletId = get(selectedWallet)?.address;
	}

	// If we still don't have a wallet ID, we can't proceed
	if (!walletId) {
		return {
			props: {
				walletId: undefined,
				tab: 'analytics',
				walletEnvoi: undefined,
				tokens: [],
				approvals: [],
				collections: [],
			}
		};
	}

	// Only redirect if the URL doesn't match our expected format
	const currentPath = `/portfolio/${params.id || ''}`;
	const targetPath = `/portfolio/${walletId}/${tab}`;
	if (currentPath !== targetPath) {
		throw redirect(307, targetPath);
	}

	let walletEnvoi: undefined | EnvoiNameResult = undefined;
	//let walletAvatar: undefined | string = undefined;
	let tokens: Token[] = [];
	const approvals: Token[] = [];
	const collections = await getCollections({ fetch });

	try {
		const nfd = await getEnvoiNames([walletId]);
		walletEnvoi = nfd.find((n: any) => n.address === walletId);

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
				//ownerNFD: walletNFD,
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
	catch(err) {
		console.error(err);
	}

	const pageMetaTags = {
		title: 'Portfolio - ' + (walletEnvoi?.name ?? walletId),
		description: 'NFT Navigator Portfolio: ' + (walletEnvoi?.name ?? walletId),
		imageUrl: walletEnvoi?.metadata?.avatar ?? '/blank_avatar_small.png',
	};

	return {
		props: {
			walletId,
			tab,
			walletEnvoi,
			//walletAvatar,
			tokens,
			approvals,
			collections,
		},
		pageMetaTags,
	};
}) satisfies LayoutServerLoad;
