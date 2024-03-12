import type { PageLoad } from './$types';
import type { Token, Collection, Listing, IHighforgeProject } from '$lib/data/types';
import { getCollections, getTokens, populateTokenRanking } from '$lib/utils/indexer';
import voiGames from '$lib/data/voiGames.json';
import { getCurrency } from '$lib/utils/currency';
import algosdk from 'algosdk';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	let tokens: Token[] = [];
	let collection: Collection | null = null;
	let collectionName: string = '';
	//const isVoiGames: boolean = false;
	
	let floor = '';
	let ceiling = '';

	if (contractId) {

		tokens = (await getTokens({ contractId, fetch })).sort((a: Token, b: Token) => a.tokenId - b.tokenId);
		collectionName = tokens[0].metadata.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';

		collection = (await getCollections({ contractId: Number(contractId), includes: 'unique-owners', fetch }))[0];

		// get highforge project data from https://test-voi.api.highforge.io/projects
		const url = 'https://test-voi.api.highforge.io/projects';
		const response = await fetch(url);
		const data = await response.json();
		const projects = data.results;

		// get marketplace data for collection
		const marketUrl = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/mp/listings/?collectionId=${contractId}&active=true`;
		try {
			const marketData = await fetch(marketUrl).then((response) => response.json());
			if (marketData.listings.length > 0) {

				for (const token of tokens) {
					const marketToken = marketData.listings.find((listing: Listing) => listing.tokenId === token.tokenId);
					if (marketToken && !marketToken.sale) {
						// check if token owner == marketToken.seller and mpContract id still approved to sell token
						if (token.owner === marketToken.seller && token.approved === algosdk.getApplicationAddress(Number(marketToken.mpContractId))) {
							token.marketData = marketToken;
						}
					}
				}

				// find lowest price in market data
				const f = marketData.listings.reduce((acc: { price: number, currency: number }, listing: Listing) => {
					if (listing.price < acc.price) {
						return { price: listing.price, currency: listing.currency };
					}
					return acc;
				});

				// find highest price in market data
				const h = marketData.listings.reduce((acc: { price: number, currency: number }, listing: Listing) => {
					if (listing.price > acc.price) {
						return { price: listing.price, currency: listing.currency };
					}
					return acc;
				});

				const cf = await getCurrency(f.currency);
				const ch = await getCurrency(h.currency);
				floor = (f.price / (10 ** (cf?.decimals??0))).toLocaleString() + ' ' + cf?.unitName;
				ceiling = (h.price / (10 ** (ch?.decimals??0))).toLocaleString() + ' ' + ch?.unitName;
			}
		}
		catch(err) {
			console.error(err);
		}


		populateTokenRanking(Number(contractId),tokens,fetch).then((t) => {
			tokens = t;
		});

		// check if included in voiGames
		//isVoiGames = (voiGames.find((v: IHighforgeProject) => v.applicationID === Number(contractId))) ? true : false;
		collection.gameData = (voiGames.find((v: IHighforgeProject) => v.applicationID === Number(contractId)))??null;
		collection.highforgeData = (projects.find((v: IHighforgeProject) => v.applicationID === Number(contractId)))??null;
	}

	const pageMetaTags = {
        title: collectionName,
        description: tokens[0]?.metadata?.description ?? '',
        imageUrl: collection?.highforgeData?.coverImageURL ?? tokens[0]?.metadata?.image ?? undefined,
      };

	return {
		contractId: params.cid,
		tokens,
		collection,
		collectionName,
		floor,
		ceiling,
		pageMetaTags,
		//isVoiGames: isVoiGames ? true : false,
	};
}) satisfies PageLoad;
