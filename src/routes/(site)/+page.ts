/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Collection } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';
import { getCollections, getSales } from '$lib/utils/indexer';

export const load = (async ({ fetch }) => {
    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners', contractId: undefined });
    collections = collections.filter((c: Collection) => c.firstToken !== null);

    const sales = await getSales(null,200,fetch);
    const popularity = sales.reduce((acc: any, sale: any) => {
        if (acc[sale.collectionId]) {
            acc[sale.collectionId]++;
        } else {
            acc[sale.collectionId] = 1;
        }
        return acc;
    }, {});
    collections = collections.map((c: Collection) => {
        c.popularity = popularity[c.contractId]??0;
        return c;
    });

    voiGames.forEach((game: any) => {
        collections.forEach((c: Collection) => {
            if (c.contractId === game.applicationID) {
                c.gameData = game;
            }
        });
    });

	return {
		collections,
	};
}) satisfies PageLoad;
