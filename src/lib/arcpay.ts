import type { ArcpayClient } from 'arcpay-sdk';
import { PUBLIC_ARCPAY_KEY } from '$env/static/public';
import { get } from 'svelte/store';
import type { Token } from './data/types';
import { writable } from 'svelte/store';
import type { PostgrestError } from '@supabase/supabase-js';

declare interface AClient {
    toggleDarkMode(isDarkMode: boolean): void;
    create(options?: CreateOptions): Promise<string>;
    buy(id: string): Promise<TransactionConfirmation | undefined>;
    getListings(): Promise<{ data: Listing[] | null; error: PostgrestError | null }>;
}

declare interface CreateOptions {
    listingType: string;
    assetId: string;
}

declare interface TransactionConfirmation {
    txIds: string[];
}

declare interface Sale {
    price: number;
    start_price?: number;
    buyer_address?: string;
    seller_address?: string;
    currency?: string;
    status?: string;
    type?: string;
}

declare interface Auction {
    start_price: number;
    end_price?: number;
    start_time?: string;
    end_time?: string;
    status?: string;
}

//export const arcpayClientStore = writable<AClient | undefined>(undefined);
export const listingStore = writable<Listing[]>([]);

export interface Listing {
    account_id: number;
    app_id: number;
    asset_creator: string;
    asset_id: string;
    asset_qty: number;
    asset_thumbnail: string;
    asset_type: string;
    auctions: Auction[]; 
    chain: string;
    created_at: string;
    id: string;
    currency: string;
    name: string;
    type: string;
    sales: Sale[];
    seller_address: string;
    status: string;
    tags: string | null;
    updated_at: string | null;
}

/*export const getArcpayClient = (): AClient => {
    const arcpayClient = get(arcpayClientStore);
    if (typeof arcpayClient === 'undefined') {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const newArcpayClient = useArcpay({
            apiKey: PUBLIC_ARCPAY_KEY,
            network: 'voi:mainnet',
            darkMode: isDarkMode,
        }) as AClient;

        arcpayClientStore.set(newArcpayClient);

        return newArcpayClient;
    }
    return arcpayClient;
}*/

// Create a browser-only version of the client creation
const createBrowserClient = async () => {
    if (typeof window !== 'undefined') {
        try {
            const arcpaySdk = await import('arcpay-sdk');
            return arcpaySdk.createClient('voi:mainnet', {
                apiKey: PUBLIC_ARCPAY_KEY,
                darkMode: true,
            });
        } catch (error) {
            console.error('Error loading arcpay-sdk:', error);
            return undefined;
        }
    }
    return undefined;
}

export const getArcpayClient = async (): Promise<ArcpayClient | undefined> => {
    return createBrowserClient();
}

// Cache expiry time in milliseconds (e.g., 5 minutes)
const CACHE_EXPIRY = 5 * 60 * 1000;
let lastCacheUpdate = 0;
let currentFetchPromise: Promise<Listing[]> | null = null;

// Type for the raw SDK response
interface SDKListing {
    account_id: number;
    app_id: number;
    asset_creator: string | null;
    asset_id: string;
    asset_qty: number;
    asset_thumbnail: string | null;
    asset_type: string;
    chain: string;
    created_at: string;
    id: string;
    currency: string;
    name: string;
    type: string;
    seller_address: string;
    status: string;
    tags: string | null;
    updated_at: string | null;
    auctions?: Auction[];
    sales?: Sale[];
}

export const getListings = async (token?: Token, invalidate: boolean = false): Promise<Listing[]> => {
    try {
        if (typeof window === 'undefined') return [];

        const now = Date.now();
        const cachedListings = get(listingStore);

        // Return cached listings if they exist and aren't expired
        if (!invalidate && cachedListings.length > 0 && (now - lastCacheUpdate) < CACHE_EXPIRY) {
            if (token) {
                return cachedListings.filter((listing) => listing.asset_id === `${token.contractId}/${token.tokenId}`);
            }
            return cachedListings;
        }

        // If there's already a fetch in progress, wait for it
        if (currentFetchPromise) {
            const listings = await currentFetchPromise;
            if (token) {
                return listings.filter((listing) => listing.asset_id === `${token.contractId}/${token.tokenId}`);
            }
            return listings;
        }

        // Start a new fetch
        currentFetchPromise = (async () => {
            try {
                const arcpayClient = await getArcpayClient();
                if (!arcpayClient) return [];

                const response = await arcpayClient.getListings();
                const listings = (response.data || []) as SDKListing[];
                
                // Map the SDK response to our Listing type
                const typedListings = listings.map(listing => ({
                    ...listing,
                    auctions: listing.auctions || [],
                    sales: listing.sales || []
                } as Listing));

                // Sort by creation date
                typedListings.sort((a, b) => {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });

                // Update cache
                listingStore.set(typedListings);
                lastCacheUpdate = now;

                return typedListings;
            } catch (error) {
                console.error('Error in fetch promise:', error);
                return [];
            }
        })();

        // Clear the promise after it resolves or rejects
        currentFetchPromise.finally(() => {
            currentFetchPromise = null;
        });

        const listings = await currentFetchPromise;
        if (token) {
            return listings.filter((listing) => listing.asset_id === `${token.contractId}/${token.tokenId}`);
        }
        return listings;
    } catch (error) {
        console.error('Error fetching listings:', error);
        return [];
    }
}

// Helper function to get listing for a specific token
export const getTokenListing = async (token: Token): Promise<Listing | null> => {
    // Get all listings (this will use cache if available)
    const listings = await getListings();
    
    // Find and return the specific token's listing
    return listings.find((listing) => 
        listing.asset_id === `${token.contractId}/${token.tokenId}` && 
        listing.status === 'active'
    ) || null;
}

// Helper function to get listings for multiple tokens at once
export const getTokenListings = async (tokens: Token[]): Promise<Map<string, Listing>> => {
    const listings = await getListings();
    const listingMap = new Map<string, Listing>();
    
    // Create a map of token key to listing for efficient lookup
    listings.forEach((listing) => {
        if (listing.status === 'active') {
            listingMap.set(listing.asset_id, listing);
        }
    });

    // Return only the listings for the requested tokens
    const result = new Map<string, Listing>();
    tokens.forEach((token) => {
        const key = `${token.contractId}/${token.tokenId}`;
        const listing = listingMap.get(key);
        if (listing) {
            result.set(key, listing);
        }
    });

    return result;
}

// Function to explicitly invalidate the listings cache
export const invalidateListingsCache = () => {
    lastCacheUpdate = 0;
    currentFetchPromise = null;
    listingStore.set([]);
}

export const listToken = async (token: Token): Promise<string> => {
    if (typeof window === 'undefined') return '';
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    const client = await getArcpayClient();
    if (!client) return '';

    client.toggleDarkMode(isDarkMode);
    const listingId: string = await client.create({
        assetId: `${token.contractId}/${token.tokenId}`,
        listingType: 'sale'
    });
    console.log('Listing ID:', listingId);
    
    // Invalidate cache after creating a listing
    invalidateListingsCache();
    
    return listingId;
}

export const buyToken = async (listingId: string): Promise<string | undefined> => {
    const client = await getArcpayClient();
    if (!client) return undefined;
    
    const isDarkMode = document.documentElement.classList.contains('dark');
    client.toggleDarkMode(isDarkMode);
    const tx: TransactionConfirmation | undefined = await client.buy(listingId);
    console.log(tx);
    
    // Invalidate cache after buying a token
    invalidateListingsCache();
    
    if (tx) {
        return tx.txIds[0];
    }
    return undefined;
}

export const cancelListing = async (listingId: string): Promise<void> => {
    const client = await getArcpayClient();
    if (!client) return;
    
    await client.cancel(listingId);
    
    // Invalidate cache after canceling a listing
    invalidateListingsCache();
}
