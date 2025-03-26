/* eslint-disable @typescript-eslint/no-explicit-any */
import { getEnvoiNames } from '$lib/utils/envoi';
import { getCollections, getTokens, getSales } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';

export const load = async ({ params, fetch }: any) => {
    const walletId = params.walletId;
    
    if (!walletId) {
        throw error(404, 'Creator not found');
    }
    
    // Get creator ENS/Envoi name and information
    let creatorInfo = undefined;
    try {
        const nfd = await getEnvoiNames([walletId]);
        creatorInfo = nfd.find((n: any) => n.address === walletId);
    } catch (err) {
        console.error('Error fetching creator info:', err);
    }
    
    // Get all collections to filter for creator
    const collections = await getCollections({ fetch });
    
    // Filter for collections created by this wallet
    const createdCollections = collections.filter((collection: any) => 
        collection.creator === walletId
    );
    
    // Check if they've created any collections
    if (createdCollections.length === 0) {
        throw error(404, 'No collections found for this creator');
    }
    
    // Get collection analytics and statistics
    const totalNFTs = createdCollections.reduce((sum: number, collection: any) => 
        sum + collection.totalSupply, 0
    );
    
    const totalOwners = createdCollections.reduce((sum: number, collection: any) => 
        sum + (collection.uniqueOwners || 0), 0
    );

    const burnedNFTs = createdCollections.reduce((sum: number, collection: any) => 
        sum + collection.burnedSupply, 0
    );
    
    // Get example tokens from each collection for display
    const allCollectionTokens: Record<number, any[]> = {};
    
    // Get sales data for these collections to analyze popularity
    let salesData = [];
    try {
        // Get sales for collections created by this wallet
        const contractIds = createdCollections.map((c: any) => c.contractId).join(',');
        salesData = await getSales({ 
            contractId: contractIds, 
            limit: 100, 
            sortBy: '-round',
            fetch: fetch
        });
    } catch (err) {
        console.error('Error fetching sales data:', err);
    }
    
    // Calculate total sales volume
    let totalSalesVolume = 0;
    const salesByCollection: Record<number, {count: number, volume: number}> = {};
    
    // Process sales data
    if (salesData && salesData.length) {
        salesData.forEach((sale: any) => {
            // Add to total volume
            const price = sale.price || 0;
            totalSalesVolume += price;
            
            // Track by collection
            if (!salesByCollection[sale.collectionId]) {
                salesByCollection[sale.collectionId] = { count: 0, volume: 0 };
            }
            salesByCollection[sale.collectionId].count++;
            salesByCollection[sale.collectionId].volume += price;
        });
    }
    
    // Sort collections by various metrics for different sections
    const collectionsByPopularity = [...createdCollections].sort((a: any, b: any) => {
        const aPopularity = salesByCollection[a.contractId]?.count || 0;
        const bPopularity = salesByCollection[b.contractId]?.count || 0;
        return bPopularity - aPopularity;
    });
    
    const collectionsByVolume = [...createdCollections].sort((a: any, b: any) => {
        const aVolume = salesByCollection[a.contractId]?.volume || 0;
        const bVolume = salesByCollection[b.contractId]?.volume || 0;
        return bVolume - aVolume;
    });
    
    const collectionsByOwnership = [...createdCollections].sort((a: any, b: any) => 
        (b.uniqueOwners || 0) - (a.uniqueOwners || 0)
    );
    
    // Get first creation date (earliest mint round)
    const firstCreationBlock = Math.min(...createdCollections.map((c: any) => c.mintRound || 0));
    
    // Find creation date from most recent collection
    const latestCreationBlock = Math.max(...createdCollections.map((c: any) => c.mintRound || 0));
    
    // Fetch sample tokens from each collection (limited to save resources)
    for (const collection of createdCollections) {
        try {
            const tokens = await getTokens({ 
                contractId: collection.contractId, 
                limit: 10,
                invalidate: true
            });
            
            allCollectionTokens[collection.contractId] = tokens;
        } catch (err) {
            console.error(`Error fetching tokens for collection ${collection.contractId}:`, err);
            allCollectionTokens[collection.contractId] = [];
        }
    }
    
    // Generate page metadata
    const pageMetaTags = {
        title: `${creatorInfo?.name || walletId} - Creator Profile`,
        description: `View NFT collections created by ${creatorInfo?.name || walletId} on Voi Network`,
        imageUrl: creatorInfo?.metadata?.avatar || '/blank_avatar_small.png',
    };
    
    return {
        walletId,
        creatorInfo,
        createdCollections,
        totalNFTs,
        totalOwners,
        burnedNFTs,
        allCollectionTokens,
        salesData,
        totalSalesVolume,
        collectionsByPopularity,
        collectionsByVolume,
        collectionsByOwnership,
        firstCreationBlock,
        latestCreationBlock,
        pageMetaTags,
    };
}; 