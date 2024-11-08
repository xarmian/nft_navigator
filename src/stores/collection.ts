import { writable } from 'svelte/store';
import type { Collection, Token, Listing, Currency } from '$lib/data/types';
import type { AggregatedNFD } from '$lib/utils/nfd';

export const collectionStore = writable(<Collection[]>[]);
export const tokenStore = writable<Map<number, Token[]>>(new Map());
export const listingStore = writable(<Listing[]>[]);
export const recentSearch = writable(<Collection[]>[]);
export const nfdStore = writable(<AggregatedNFD[]>[]);

export const tokenGroup = writable(<Token[]><unknown>[]);
export const viewCollection = writable(false);

export const filters = writable({
    voiGames: false,
    forSale: false,
    currency: '*',
    mintable: false,
});

export const collectionSort = writable({
    by: 'Popularity',
    direction: 'Descending',
});

export const saleSort = writable({
    by: 'List',
    direction: 'Descending',
});

export const currencies = writable(<Currency[]>[]);

export const userPreferences = writable({
    cleanGridView: true,
    analyticsCollectionId: 0,
    analyticsStart: undefined as Date | undefined,
    analyticsEnd: undefined as Date | undefined,
});

export const showConfetti = writable(false);

export const viewMode = writable('Collection'); // Can be 'Token' or 'Collection'

// Path: src/stores/collection.ts