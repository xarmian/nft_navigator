/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection } from '$lib/data/types';
import { getCollections, getSales } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../$types';

export const load = (async ({ fetch }) => {
    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners', contractId: undefined });

    const sales = await getSales({ contractId: undefined, sortBy: '-round', limit: 500, fetch: fetch });
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

    const pageMetaTags = {
        title: 'Home',
        openGraph: {
          title: 'ARC-72 Collections',
        }
      };

	return {
		collections,
        pageMetaTags,
	};
}) satisfies LayoutServerLoad;
