/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection } from '$lib/data/types';
import { getCollections } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../$types';

export const load = (async ({ params, fetch }) => {
    const collectionId = Number(params.collection?.split('/')?.[1])??null;

    const collections: Collection[] = (await getCollections({ fetch })).sort((a, b) => (a.highforgeData?.title ?? String(a.contractId)).localeCompare(b.highforgeData?.title ?? String(b.contractId)) as number)?? [];

    const collection = collections.find((c) => c.contractId === collectionId)??null;
    const collectionName = (collection) ? collection?.highforgeData?.title ?? String(collection?.contractId) : 'All Collections';

    const collectionOptions = [ { id: 0, name: 'All Collections', imageUrl: '' } ];
    collections.forEach((collection) => {
        collectionOptions.push({ id: collection.contractId, name: collection.highforgeData?.title ?? String(collection.contractId), imageUrl: collection.imageUrl ?? '' });
    });


    const pageMetaTags = {
        title: `Analytics | ${collectionName} | NFT Navigator`,
        description: collection?.highforgeData?.description 
            ? collection.highforgeData.description + ' Market Analytics' 
            : 'NFT Token Market Statistics',
        imageUrl: collection?.imageUrl ?? undefined,
      };

	return {
        pageMetaTags,
        collectionId,
        collection,
        collectionOptions,
	};
}) satisfies LayoutServerLoad;
