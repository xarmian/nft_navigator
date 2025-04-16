/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Collection, Token } from '$lib/data/types';
import { getCollections, getSales, getTokens, getTransfers } from '$lib/utils/mimir';
import type { LayoutServerLoad } from '../$types';

export const load = (async ({ fetch }) => {
    const pageMetaTags = {
        title: 'Home',
        openGraph: {
          title: 'Voi Network NFT Navigator',
        }
    };

    let collections: Collection[] = await getCollections({ fetch, includes: 'unique-owners' });
    const sales = await getSales({ limit: 200, fetch, includes: 'listing' });

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
            includes: 'token'
        });

        // Extract tokenIds from mints
        const tokenIds = mints.map(mint => mint.tokenId).join(',');
        
        // Fetch token details
        if (tokenIds.length > 0) {
            recentMintTokens = await getTokens({
                fetch,
                tokenIds,
                includes: 'metadata'
            });
            
            // Sort by mintRound and take the first 4
            recentMintTokens = recentMintTokens
                .sort((a, b) => b.mintRound - a.mintRound)
                .slice(0, 4);
        }

        mintCount = mints.length;

        collections = collections.map((c: Collection) => {
            c.popularity = popularity[c.contractId] ?? 0;
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
