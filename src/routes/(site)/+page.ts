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

    // Get mints from the last 24 hours
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - (24 * 60 * 60);

    try {
        const transfers = await getTransfers({ 
            fetch,
            from: ZERO_ADDRESS,
            minTime: oneDayAgo
        });

        // Filter transfers that occurred in the last 24 hours
        const mints = transfers.filter(transfer => {
            const transferTime = transfer.timestamp;
            return transferTime >= oneDayAgo && transferTime <= now;
        });
        mints.sort((a, b) => b.timestamp - a.timestamp);

        // Add mint activity to popularity score
        mints.forEach(mint => {
            if (popularity[mint.contractId]) {
                popularity[mint.contractId] += 1;
            } else {
                popularity[mint.contractId] = 1;
            }
        });

        recentMintTokens = (await Promise.all(mints.slice(0, 4).map(async (mint) => 
            await getTokens({
                fetch,
                contractId: mint.contractId,
                tokenId: mint.tokenId
            })
        ))).flat();

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
