import { writable } from 'svelte/store';
import type { Token } from '$lib/data/types';

export const tokenGroup = writable(<Token[]><unknown>[]);
export const viewCollection = writable(false);
//export const showVoiGamesOnly = writable(false);
//export const forSaleFilter = writable(false);

export const filters = writable({
    voiGames: false,
    forSale: true,
});

// Path: src/stores/collection.ts