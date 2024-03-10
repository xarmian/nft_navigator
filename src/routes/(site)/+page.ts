/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Collection } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';
import { getCollections, getSales } from '$lib/utils/indexer';

export const load = (async ({ fetch }) => {
    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners', contractId: undefined });
    collections = collections.filter((c: Collection) => c.firstToken !== null);

    // get highforge project data from https://test-voi.api.highforge.io/projects
    const url = 'https://test-voi.api.highforge.io/projects';
    const response = await fetch(url);
    const data = await response.json();
    const projects = data.results;

    // for each project, replace collection's firstToken url with projects.coverImageURL
    collections.forEach((c: Collection) => {
        projects.forEach((p: any) => {
            if (c.contractId === p.applicationID) {
                const metadata = JSON.parse(c.firstToken.metadata);
                c.firstToken.metadata = JSON.stringify({ ...metadata, image: p.coverImageURL });
            }
        });
    });

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
