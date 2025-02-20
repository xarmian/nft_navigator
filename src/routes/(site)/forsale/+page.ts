import { listingsStore } from '../../../stores/listings';

export const load = (async ({ fetch }) => {
    const tokens = await listingsStore.fetchListings(fetch);

    const pageMetaTags = {
        title: 'For Sale | NFT Navigator',
        description: 'NFT Tokens for Sale',
    };

    return {
        tokens,
        //voiGames,
        pageMetaTags,
    };
});
