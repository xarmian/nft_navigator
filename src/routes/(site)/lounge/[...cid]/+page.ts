import type { Collection } from '$lib/data/types';
import { getCollection } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../$types';

export const load = (async ({ data, params, fetch }) => {
    const { cid } = params;

    let collection: Collection | null = null;
    let collectionName = '';

    if (cid) {
        collection = await getCollection({ contractId: Number(cid), fetch });
        collectionName = (collection?.highforgeData?.title ?? '');
    }

    const title = (collectionName == '') ? 'Voi Lounge' : collectionName + ' - Voi Lounge';
    const desc = (collectionName == '') ? 'Voi Lounge, an exclusive community for NFT collectors' : collectionName + ' Lounge, an exclusive community for NFT collectors';

	const pageMetaTags = {
		title: title,
		description: desc,
        imageUrl: collection?.highforgeData?.coverImageURL
	};

	return {
        ...data,
		pageMetaTags,
	};
}) satisfies LayoutServerLoad;
