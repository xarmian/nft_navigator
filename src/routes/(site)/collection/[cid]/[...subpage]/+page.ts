import type { Token, Collection, Listing } from '$lib/data/types';
import { getCollection, getTokensWithPagination, mimirBaseURL, getListingsWithPagination } from '$lib/utils/mimir';
import { getCurrency } from '$lib/utils/currency';
import { userPreferences, recentSearch } from '../../../../../stores/collection';
import { get } from 'svelte/store';
import { resolveEnvoiToken } from '$lib/utils/envoi';
import { selectedWallet } from 'avm-wallet-svelte';

export const load = (async ({ params, fetch }) => {
	const contractId = params.cid;
	let tokens: Token[] = [];
	let collection: Collection | null = null;
	let collectionName: string = '';
	let categories: { [key: string]: { [key: string]: number } } = {};
	let filters: { [key: string]: string } = {};
	let initialNextToken: string | null = null;
	let listingsNextToken: string | null = null;

	let subpage = params.subpage ?? 'tokens';
	if (subpage === null || subpage === '') {
		subpage = 'tokens';
	}

	let floor = '';
	let ceiling = '';
	let listings: Listing[] = [];
	let totalTokenCount = 0;
	let burnedTokenCount = 0;
	let userTokenCount = 0;
	let forSaleCount = 0;

	if (contractId) {
		if (get(userPreferences).analyticsCollectionId !== Number(contractId)) {
			userPreferences.update((up) => {
				return { ...up, analyticsCollectionId: Number(contractId) };
			});
		}

		// Fetch collection, tokens, and counts in parallel
		const [
			collectionResult, 
			tokensResponse, 
			burnedResponse, 
			userResponse,
			listingsResponse
		] = await Promise.all([
			// Get collection
			getCollection({ contractId: Number(contractId), fetch }),
			
			// Fetch tokens with pagination
			getTokensWithPagination({ 
				contractId: contractId.toString(), 
				fetch,
				limit: 50,
				includes: 'metadata'
			}),
			
			// Get count of burned tokens
			fetch(`${mimirBaseURL}/tokens?contractId=${contractId}&isBurned=true&limit=1`)
				.then(res => res.json())
				.catch(err => {
					console.error('Error fetching burned token count:', err);
					return { 'total-count': 0 };
				}),
				
			// Get user's tokens count
			fetch(`${mimirBaseURL}/tokens?contractId=${contractId}&owner=${get(selectedWallet)?.address}&limit=1`)
				.then(res => res.json())
				.catch(err => {
					console.error('Error fetching user token count:', err);
					return { 'total-count': 0 };
				}),
				
			// Get marketplace data for collection
			getListingsWithPagination({
				collectionId: contractId.toString(),
				active: true,
				includes: 'token,collection',
				fetch,
				limit: 50
			})
		]);
		
		// Process results
		collection = collectionResult;
		
		if (collection) {
			let recentSearchValue = get(recentSearch) as Collection[];
			recentSearchValue = [collection, ...recentSearchValue.filter((r) => r.contractId !== collection?.contractId)].slice(0,5);
			recentSearch.set(recentSearchValue);
		}
		
		tokens = tokensResponse.tokens.sort((a: Token, b: Token) => 
			a.tokenId.toString().localeCompare(b.tokenId.toString())
		);
		initialNextToken = tokensResponse.nextToken;
		totalTokenCount = tokensResponse.totalCount;
		
		burnedTokenCount = burnedResponse['total-count'] || 0;
		userTokenCount = userResponse['total-count'] || 0;
		
		listings = listingsResponse.listings;
		listingsNextToken = listingsResponse.nextToken;
		forSaleCount = listingsResponse.totalCount;

		collectionName = tokens[0]?.metadata?.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
		
		// Use collection data if available for total supply and burned count
		if (collection?.totalSupply) {
			totalTokenCount = parseInt(collection.totalSupply.toString());
		}
		if (collection?.burnedSupply) {
			burnedTokenCount = parseInt(collection.burnedSupply.toString());
		}

		// Process Envoi tokens in listings
		const envoiListingTokens = listings
			.filter(l => l.collectionId === 797609 && l.token)
			.map(l => l.token?.tokenId)
			.filter(Boolean) as string[];

		if (envoiListingTokens.length > 0) {
			try {
				console.log(`Initial load: Resolving ${envoiListingTokens.length} Envoi tokens`);
				const envoiResults = await resolveEnvoiToken(envoiListingTokens);
				console.log(`Initial load: Received ${envoiResults.length} Envoi results`);
				
				// Update the listing tokens with Envoi data
				listings.forEach(listing => {
					if (listing.collectionId === 797609 && listing.token) {
						const envoiData = envoiResults.find(result => result.token_id === listing.token?.tokenId);
						if (envoiData && listing.token) {
							console.log(`Initial load: Processing Envoi token ${listing.token.tokenId}: ${envoiData.name}`);
							// Parse metadata if it's a string
							let metadata: Record<string, unknown> = {};
							if (typeof listing.token.metadata === 'string') {
								try {
									metadata = JSON.parse(listing.token.metadata);
								} catch (e) {
									console.error("Error parsing token metadata", e);
									// Parsing failed, use empty object
								}
							} else {
								metadata = listing.token.metadata as Record<string, unknown>;
							}
							
							// Update the metadata with Envoi info
							listing.token.metadata = {
								...metadata,
								name: metadata.name || '',
								envoiName: envoiData.name,
								avatar: envoiData.metadata?.avatar || null,
								envoiMetadata: envoiData.metadata || null
							};
							console.log(`Initial load: Updated metadata for ${listing.token.tokenId}`, listing.token.metadata);
						}
					}
				});
			} catch (error) {
				console.error("Error resolving Envoi names for listings:", error);
			}
		}

		// Find lowest and highest prices in listings
		if (listings.length > 0) {
			// Find lowest price (floor)
			const floorListing = listings.reduce((acc, listing) => {
				if (!listing.sale && !listing.delete && (acc === null || listing.price < acc.price)) {
					return listing;
				}
				return acc;
			}, null as Listing | null);

			// Find highest price (ceiling)
			const ceilingListing = listings.reduce((acc, listing) => {
				if (!listing.sale && !listing.delete && (acc === null || listing.price > acc.price)) {
					return listing;
				}
				return acc;
			}, null as Listing | null);

			if (floorListing) {
				const cf = await getCurrency(floorListing.currency);
				floor = (floorListing.price / (10 ** (cf?.decimals??0))).toLocaleString() + ' ' + cf?.unitName;
			}

			if (ceilingListing) {
				const ch = await getCurrency(ceilingListing.currency);
				ceiling = (ceilingListing.price / (10 ** (ch?.decimals??0))).toLocaleString() + ' ' + ch?.unitName;
			}
		}

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
		listings,
		totalTokenCount,
		burnedTokenCount,
		userTokenCount,
		initialNextToken,
		listingsNextToken,
		forSaleCount
	};
});
