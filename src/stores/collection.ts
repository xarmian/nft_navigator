import { writable } from 'svelte/store';
import type { Token } from '$lib/data/types';

export const tokenGroup = writable(<Token[]><unknown>[]);
export const viewCollection = writable(false);

export const filters = writable({
    voiGames: false,
    forSale: false,
});

// Path: src/stores/collection.ts