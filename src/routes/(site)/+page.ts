/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection, Token } from '$lib/data/types';
import { getCollections, getSales, getTokens, getTransfers } from '$lib/utils/indexer';
import type { LayoutServerLoad } from '../$types';

export const load = (async ({ fetch }) => {
    const pageMetaTags = {
        title: 'Home',
        openGraph: {
          title: 'Voi Network NFT Navigator',
        }
    };

    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners', contractId: undefined });
    const sales = await getSales({ contractId: undefined, sortBy: '-round', limit: 200, fetch });

    // Initialize popularity with sales data
    const popularity = sales ? sales.reduce((acc: any, sale: any) => {
        if (acc[sale.collectionId]) {
            acc[sale.collectionId]++;
        } else {
            acc[sale.collectionId] = 1;
        }
        return acc;
    }, {}) : {};

    let recentMintTokens: Token[] = [];
    let mintCount = 0;
    const ZERO_ADDRESS = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ";

    try {
        const mints = await getTransfers({ 
            fetch,
            from: ZERO_ADDRESS,
            limit: 10,
            sortBy: 'desc'
        });

        recentMintTokens = await getTokens({
            fetch,
            tokenIds: mints.map((mint) => `${mint.contractId}_${mint.tokenId}`).join(',')
        }).then((tokens) => tokens.sort((a, b) => b.mintRound - a.mintRound)).then((tokens) => tokens.slice(0, 4));

        mintCount = mints.length;

        collections = collections.map((c: Collection) => {
            c.popularity = popularity[Number(c.contractId)]??0;
            return c;
        });
    } catch (error) {
        console.error('Error fetching mints:', error);
    }

    return {
        collections,
        pageMetaTags,
        recentMintTokens,
        mintCount
    };
}) satisfies LayoutServerLoad;
