import { writable } from 'svelte/store';
import type { Token } from '$lib/data/types';

export const tokenGroup = writable(<Token[]><unknown>[]);
export const viewCollection = writable(false);
export const showVoiGamesOnly = writable(false);

// Path: src/stores/collection.ts