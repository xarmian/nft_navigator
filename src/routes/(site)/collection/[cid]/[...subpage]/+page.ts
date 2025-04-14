import type { Token, Collection, Listing } from '$lib/data/types';
import { getCollection, getTokens, populateTokenRanking } from '$lib/utils/indexer';
import { getCurrency } from '$lib/utils/currency';
import { userPreferences, recentSearch } from '../../../../../stores/collection';
import { get } from 'svelte/store';
import algosdk from 'algosdk';
import { indexerBaseURL } from '$lib/utils/indexer';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	let tokens: Token[] = [];
	let collection: Collection | null = null;
	let collectionName: string = '';
	//const isVoiGames: boolean = false;
	let categories: { [key: string]: { [key: string]: number } } = {};
	let filters: { [key: string]: string } = {};

	let subpage = params.subpage ?? 'tokens';
	if (subpage === null || subpage === '') {
		subpage = 'tokens';
	}

	let floor = '';
	let ceiling = '';

	if (contractId) {
		if (get(userPreferences).analyticsCollectionId !== Number(contractId)) {
			userPreferences.update((up) => {
				return { ...up, analyticsCollectionId: Number(contractId) };
			});
		}

		tokens = (await getTokens({ contractId, fetch })).sort((a: Token, b: Token) => a.tokenId - b.tokenId);
		collectionName = tokens[0]?.metadata?.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';

		collection = (await getCollection({ contractId: Number(contractId), fetch }));

		if (collection) {
			let recentSearchValue = get(recentSearch) as Collection[];
			recentSearchValue = [collection, ...recentSearchValue.filter((r) => r.contractId !== collection?.contractId)].slice(0,5);
			recentSearch.set(recentSearchValue);
		}
		
		// get marketplace data for collection
		const marketUrl = `${indexerBaseURL}/mp/listings?collectionId=${contractId}&active=true`;
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

		// populate/clear filters
		const combinedProperties = {} as { [key: string]: { [key: string]: number } };
		tokens.forEach(token => {
			Object.entries(token.metadata?.properties ?? {}).forEach(([key, value]) => {
				if (combinedProperties[key]) {
					if (combinedProperties[key][value]) {
						combinedProperties[key][value]++;
					} else {
						combinedProperties[key][value] = 1;
					}
				} else {
					combinedProperties[key] = { [value]: 1 };
				}
			});
		});

		Object.keys(combinedProperties).forEach(key => {
			const sortedObject = Object.entries(combinedProperties[key])
				.sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
				.reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
			combinedProperties[key] = sortedObject;
		});

		categories = combinedProperties;

		filters = {};
		Object.keys(categories).forEach(key => {
			filters[key] = '';
		});

	}

	let title = collection?.highforgeData?.title ?? collectionName;
	if (subpage === 'forsale') {
		title = `For Sale | ${title}`;
	}
	else if (subpage === 'collectors') {
		title = `Collectors | ${title}`;
	}
	else if (subpage === 'transactions') {
		title = `Transactions | ${title}`;
	}
	else if (subpage === 'burned') {
		title = `Burned Tokens | ${title}`;
	}
	else if (subpage === 'ranking') {
		title = `Ranking | ${title}`;
	}

	const pageMetaTags = {
        title: title,
        description: tokens[0]?.metadata?.description ?? collection?.highforgeData?.description ?? undefined,
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
		categories,
		filters,
		subpage,
		//isVoiGames: isVoiGames ? true : false,
	};
});
