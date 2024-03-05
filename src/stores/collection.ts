import { writable } from 'svelte/store';
import type { Token, Currency } from '$lib/data/types';

export const tokenGroup = writable(<Token[]><unknown>[]);
export const viewCollection = writable(false);

export const filters = writable({
    voiGames: false,
    forSale: false,
    currency: '*',
});

export const sort = writable({
    by: 'Name',
    direction: 'Ascending',
});

export const currencies = writable(<Currency[]>[]);

// Path: src/stores/collection.ts