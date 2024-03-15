/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection } from '$lib/data/types';
import { getCollections } from '$lib/utils/indexer';
import type { PageLoad } from './$types';

export const load = (async ({ fetch }) => {

    const collections: Collection[] = (await getCollections({ fetch }));

    const pageMetaTags = {
        title: 'Analytics | NFT Navigator',
        description: 'NFT Token Market Statistics',
      };

	return {
        pageMetaTags,
        collections
	};
}) satisfies PageLoad;
