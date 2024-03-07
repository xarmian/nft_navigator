import { writable } from 'svelte/store';
import type { Token, Currency } from '$lib/data/types';

export const tokenGroup = writable(<Token[]><unknown>[]);
export const viewCollection = writable(false);

export const filters = writable({
    voiGames: false,
    forSale: false,
    currency: '*',
});

export const collectionSort = writable({
    by: 'Mint',
    direction: 'Descending',
});

export const saleSort = writable({
    by: 'List',
    direction: 'Descending',
});

export const currencies = writable(<Currency[]>[]);

// Path: src/stores/collection.ts