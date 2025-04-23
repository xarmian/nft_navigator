import type { Token, Collection, Listing } from '$lib/data/types';
import { getCollection, getTokensWithPagination, mimirBaseURL, getListingsWithPagination, getCollectors } from '$lib/utils/mimir';
import { getCurrency } from '$lib/utils/currency';
import { userPreferences, recentSearch } from '../../../../../stores/collection';
import { get } from 'svelte/store';
import { resolveEnvoiToken } from '$lib/utils/envoi';
import { selectedWallet } from 'avm-wallet-svelte';
import { getImageUrl } from '$lib/utils/functions';

// Interface for collection metadata with trait counts
interface TraitCountMetadata {
    traitCount?: {
        [category: string]: {
            [value: string]: number;
        };
    };
    [key: string]: unknown;
}

export const load = (async ({ params, fetch, depends }) => {
	// Add dependency to allow selective reloading when needed
	depends('app:collection');
	
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
	let rawCollectors: any[] = [];

	if (contractId) {
		if (get(userPreferences).analyticsCollectionId !== Number(contractId)) {
			userPreferences.update((up) => {
				return { ...up, analyticsCollectionId: Number(contractId) };
			});
		}

		// Fetch essential data in parallel
		const [collectionResult, tokensResponse, listingsResponse, collectorsResponse] = await Promise.all([
			// Get collection
			getCollection({ contractId: Number(contractId), fetch }),
			
			// Fetch tokens (always needed for metadata and filters)
			getTokensWithPagination({ 
				contractId: contractId.toString(), 
				fetch,
				limit: 50
			}),
			
			// Get marketplace data (always needed for counts, used directly in forsale tab)
			getListingsWithPagination({
				collectionId: contractId.toString(),
				active: true,
				includes: 'token,collection',
				fetch,
				limit: 50
			}),
			
			getCollectors({ contractId: Number(contractId), limit: 1000, fetch })
		]);

		rawCollectors = collectorsResponse;
		
		// Process collection data
		collection = collectionResult;
		collectionName = collection?.name ?? tokens[0]?.metadata?.name.replace(/(\d+|#)(?=\s*\S*$)/g, '') ?? '';
		
		// Add to recent search if valid collection
		if (collection) {
			let recentSearchValue = get(recentSearch) as Collection[];
			recentSearchValue = [collection, ...recentSearchValue.filter((r) => r.contractId !== collection?.contractId)].slice(0,5);
			recentSearch.set(recentSearchValue);
		}
		
		// Process tokens data
		tokens = tokensResponse.tokens.sort((a: Token, b: Token) => 
			a.tokenId.toString().localeCompare(b.tokenId.toString())
		);
		initialNextToken = tokensResponse.nextToken;
		totalTokenCount = tokensResponse.totalCount;
		
		// Process listings data
		listings = listingsResponse.listings;
		listingsNextToken = listingsResponse.nextToken;
		forSaleCount = listingsResponse.totalCount;
		
		// Get additional counts in parallel
		const countPromises = [
			// Get count of burned tokens
			fetch(`${mimirBaseURL}/tokens?contractId=${contractId}&isBurned=true&limit=1`)
				.then(res => res.json())
				.catch(err => {
					console.error('Error fetching burned token count:', err);
					return { 'total-count': 0 };
				})
		];
		
		// Only fetch user token count if logged in
		if (get(selectedWallet)?.address) {
			countPromises.push(
				fetch(`${mimirBaseURL}/tokens?contractId=${contractId}&owner=${get(selectedWallet)?.address}&limit=1`)
					.then(res => res.json())
					.catch(err => {
						console.error('Error fetching user token count:', err);
						return { 'total-count': 0 };
					})
			);
		}
		
		// Get additional counts 
		const countResults = await Promise.all(countPromises);
		
		// Set burned count
		burnedTokenCount = countResults[0]['total-count'] || 0;
		
		// Set user token count if available
		if (countResults.length > 1 && get(selectedWallet)?.address) {
			userTokenCount = countResults[1]['total-count'] || 0;
		}
		
		// Use collection data if available for total supply and burned count
		if (collection?.totalSupply) {
			totalTokenCount = parseInt(collection.totalSupply.toString());
		}
		if (collection?.burnedSupply) {
			burnedTokenCount = parseInt(collection.burnedSupply.toString());
		}

		// Process Envoi tokens in listings if needed (for forsale tab)
		if (subpage === 'forsale') {
			const envoiListingTokens = listings
				.filter(l => l.collectionId === 797609 && l.token)
				.map(l => l.token?.tokenId)
				.filter(Boolean) as string[];
				
			if (envoiListingTokens.length > 0) {
				try {
					const envoiResults = await resolveEnvoiToken(envoiListingTokens);
					
					// Update listing tokens with Envoi data
					if (envoiResults.length > 0) {
						listings = listings.map(listing => {
							if (listing.collectionId === 797609 && listing.token) {
								const envoiData = envoiResults.find(r => r.token_id === listing.token?.tokenId);
								if (envoiData) {
									// Parse metadata to ensure it's an object
									let metadata = {};
									if (typeof listing.token.metadata === 'string') {
										try {
											metadata = JSON.parse(listing.token.metadata);
										} catch (e) {
											console.error("Error parsing token metadata", e);
											metadata = {};
										}
									} else if (listing.token.metadata) {
										metadata = listing.token.metadata;
									}
									
									return {
										...listing,
										token: {
											...listing.token,
											metadata: {
												...metadata,
												name: envoiData.name,
												envoiName: envoiData.name,
												envoiMetadata: envoiData.metadata
											}
										}
									};
								}
							}
							return listing;
						});
					}
				} catch (error) {
					console.error("Error resolving Envoi names:", error);
				}
			}
		}
		
		// Find floor and ceiling prices from listings
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

		// Try to use collection metadata trait counts for filters if available
		let useCollectionMetadata = false;
		
		if (collection?.metadata) {
			try {
				// Parse metadata if it's a string
				let parsedMetadata: TraitCountMetadata = {};
				if (typeof collection.metadata === 'string') {
					parsedMetadata = JSON.parse(collection.metadata);
				} else {
					parsedMetadata = collection.metadata as TraitCountMetadata;
				}

				// Check if the metadata contains traitCount
				if (parsedMetadata.traitCount && Object.keys(parsedMetadata.traitCount).length > 0) {
					categories = parsedMetadata.traitCount;
					useCollectionMetadata = true;
				}
			} catch (error) {
				console.error("Error parsing collection metadata for traits:", error);
				// If parsing fails, we'll fall back to using tokens
			}
		}
		
		// Fallback to using tokens to build filters if collection metadata isn't available or doesn't have traits
		if (!useCollectionMetadata && tokens.length > 0) {
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
		}

		// Set up initial filter values
		filters = {};
		Object.keys(categories).forEach(key => {
			filters[key] = '';
		});
	}

	let title = collectionName;
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

	const imageUrl = collection?.imageUrl ?? collection?.highforgeData?.coverImageURL ?? tokens[0]?.metadata?.image ?? undefined;

	const pageMetaTags = {
        title: title,
        description: tokens[0]?.metadata?.description ?? collection?.highforgeData?.description ?? undefined,
        imageUrl: getImageUrl(imageUrl ?? ''),
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
		forSaleCount,
		rawCollectors
	};
});
