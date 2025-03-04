import { writable, derived } from 'svelte/store';
import type { Collection, Transfer } from '$lib/data/types';

export interface CollectionGameStats {
    contractId: number;
    gamePeriodMints: number;  // number of tokens minted during game period
    gamePeriodMintVolume: number;  // total VOI value of mints during game period
    secondaryVolume: number;  // in VOI
    basePrices: Map<string, number>;  // tokenId -> price in VOI
}

export interface GameStats {
    collections: Map<string, CollectionGameStats>;  // contractId -> stats
    totalGamePeriodMints: number;
    totalGamePeriodMintVolume: number;
    totalSecondaryVolume: number;
}

interface CollectionPricing {
    wlPrice: number;  // in microVOI
    publicPrice: number;  // in microVOI
    launchStart: number;  // timestamp when WL period ends
    wlLaunchStart: number;  // timestamp when WL period starts
}

const createGameStats = () => {
    const defaultStats: GameStats = {
        collections: new Map(),
        totalGamePeriodMints: 0,
        totalGamePeriodMintVolume: 0,
        totalSecondaryVolume: 0
    };

    const { subscribe, set, update } = writable<GameStats>(defaultStats);

    const getCollectionPricing = (collection: Collection): CollectionPricing | null => {
        const globalState = collection.globalState;
        if (!globalState) return null;

        const getValue = (key: string): number => {
            const value = globalState.find(gs => gs.key === key)?.value;
            return value ? Number(value) : 0;
        };

        return {
            wlPrice: getValue('wlPrice'),
            publicPrice: getValue('price'),
            launchStart: getValue('launchStart'),
            wlLaunchStart: getValue('wlLaunchStart')
        };
    };

    const getMintPrice = (pricing: CollectionPricing, timestamp: number): number => {
        if (timestamp >= pricing.wlLaunchStart && timestamp < pricing.launchStart) {
            return pricing.wlPrice;
        }
        return pricing.publicPrice;
    };

    return {
        subscribe,
        reset: () => set(defaultStats),
        updateMintStats: (collections: Collection[], transfers: Transfer[]) => {
            update(stats => {
                // Reset mint-related stats
                stats.totalGamePeriodMints = 0;
                stats.totalGamePeriodMintVolume = 0;
                
                // Create a new map to avoid stale data
                stats.collections = new Map();

                transfers.forEach(transfer => {
                    const collection = collections.find(c => c.contractId.toString() === transfer.contractId.toString());
                    if (!collection) return;

                    const contractId = collection.contractId.toString();
                    if (!stats.collections.has(contractId)) {
                        stats.collections.set(contractId, {
                            contractId: collection.contractId,
                            gamePeriodMints: 0,
                            gamePeriodMintVolume: 0,
                            secondaryVolume: 0,
                            basePrices: new Map()
                        });
                    }

                    const collectionStats = stats.collections.get(contractId)!;
                    const pricing = getCollectionPricing(collection);
                    
                    if (pricing) {
                        const mintPriceVoi = getMintPrice(pricing, transfer.timestamp) / Math.pow(10, 6);

                        // Update collection stats for this game period mint
                        collectionStats.gamePeriodMints++;
                        collectionStats.gamePeriodMintVolume += mintPriceVoi;
                        collectionStats.basePrices.set(transfer.tokenId, mintPriceVoi);

                        // Update totals
                        stats.totalGamePeriodMints++;
                        stats.totalGamePeriodMintVolume += mintPriceVoi;
                    }
                });

                // hard code contractId 963191 to 96700 VOI due to price change
                const contractId963191 = stats.collections.get('963191');
                if (contractId963191) {
                    contractId963191.gamePeriodMintVolume = 96700;
                }

                return stats;
            });
        }
    };
};

export const gameStats = createGameStats();

// Derived store for minting leaderboard
export const mintingLeaderboard = derived(gameStats, $gameStats => {
    return Array.from($gameStats.collections.values())
        .map(stats => ({
            contractId: stats.contractId,
            totalValue: stats.gamePeriodMintVolume,
            mintCount: stats.gamePeriodMints
        }))
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 100);
}); 