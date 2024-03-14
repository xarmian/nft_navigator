/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Collection } from '$lib/data/types';
import { getCollections, getSales } from '$lib/utils/indexer';

export const load = (async ({ fetch }) => {
    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners', contractId: undefined });

    const sales = await getSales(null,'-round',200,fetch);
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
        description: 'NFT Navigator Homepage',
        openGraph: {
          title: 'Home',
          description: 'NFT Navigator Homepage',
        }
      };

	return {
		collections,
        pageMetaTags,
	};
}) satisfies PageLoad;
