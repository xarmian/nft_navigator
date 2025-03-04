import type { AggregatedNFD } from '$lib/utils/nfd';

export interface BaseLeaderboardEntry {
  address: string;
  nfd: AggregatedNFD | null;
}

export interface ProfitEntry extends BaseLeaderboardEntry {
  totalProfit: number;
  profitableTrades: number;
  totalTrades: number;
}

export interface VolumeEntry extends BaseLeaderboardEntry {
  totalVolume: number;
  buys: number;
  sells: number;
}

export interface MintingEntry extends BaseLeaderboardEntry {
  totalMints: number;
  totalMintVolume: number;
  collection: string;
}

export interface SocialEntry extends BaseLeaderboardEntry {
  totalImpressions: number;
  totalPosts: number;
  collection: string;
} 