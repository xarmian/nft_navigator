/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Collection } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';
import { getCollections } from '$lib/utils/indexer';

export const load = (async ({ fetch }) => {
    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners', contractId: undefined });
    collections = collections.filter((c: Collection) => c.firstToken !== null);

	return {
		collections,
        voiGames,
	};
}) satisfies PageLoad;
