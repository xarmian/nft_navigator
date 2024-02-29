/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PageLoad } from './$types';
import type { Collection } from '$lib/data/types';
import voiGames from '$lib/data/voiGames.json';

export const load = (async ({ fetch }) => {
    const url = `https://arc72-idx.nftnavigator.xyz/nft-indexer/v1/collections`;
    let collections: Collection[] = [];
    
    try {
        const data = await fetch(url).then((response) => response.json());
        collections = data.collections.filter((c: Collection) => c.firstToken !== null);
    }
    catch(err) {
        console.error(err);
    }

	return {
		collections,
        voiGames,
	};
}) satisfies PageLoad;
