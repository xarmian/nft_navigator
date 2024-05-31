import type { Collection } from '$lib/data/types';
import { getNFD, type AggregatedNFD } from '$lib/utils/nfd';
import { getCollection, getTokens } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../../../$types';
import { nfdStore } from '../../../../stores/collection';

export const load = (async ({ data, params, fetch }) => {
    const { cid } = params;

    let collection: Collection | null = null;
    let collectionName = '';

    if (cid && cid !== 'undefined' && cid !== 'all' && cid !== 'myfeed') {
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

    // get a list of unique wallets from data.messages.walletId and data.messages.comments.walletId and then get their NFD data
    const wallets: string[] = Array.from(new Set(data.server_data.messages.map((m) => m.walletId).concat(data.server_data.messages.flatMap((m) => m.comments?.map((c: { walletId: string; }) => c.walletId)))));
    const nfd: AggregatedNFD[] = await getNFD(wallets);

    const tokenPromises = wallets.map((w) => {
        if (!nfd.find((n) => n.key === w)) {
            return getTokens({ owner: w, limit: 1 });
        }
        return Promise.resolve([]);
    });
    
    const tokens = await Promise.all(tokenPromises);
    for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        if (!nfd.find((n) => n.key === w)) {
            const token = tokens[i]?.[0] ?? {};
            nfd.push({ 
                key: w, 
                replacementValue: w?.slice(0, 8) + '...' + w?.slice(-8),
                avatar: token.metadata?.image ?? '/blank_avatar_small.png'
            });
            nfdStore.update((nfdStore) => ({ ...nfdStore, [w]: nfd.find((n) => n.key === w) }));
        }
        else {
            const n = nfd.find((n) => n.key === w);
            if (n && !n.avatar) {
                const token = tokens[i]?.[0] ?? {};
                n.avatar = token.metadata?.image ?? '/blank_avatar_small.png';
            }
            nfdStore.update((nfdStore) => ({ ...nfdStore, [w]: n }));
        }
    }
    data.server_data.nfds = nfd;

	return {
        ...data,
		pageMetaTags,
	};
}) satisfies LayoutServerLoad;
