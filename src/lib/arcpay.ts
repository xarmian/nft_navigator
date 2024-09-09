import { useArcpay, createClient } from 'arcpay-sdk';
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
    auctions: []; // Assuming auctions is an array of unknown objects
    chain: string;
    created_at: string; // ISO 8601 date string
    id: string;
    currency: string;
    name: string;
    type: string;
    sales: Sale[]; // Assuming sales is an array of unknown objects
    seller_address: string;
    status: string;
    tags: string | null; // Assuming tags can be of any type, including null
    updated_at: string | null; // Can be a date string or null
}

/*export const getArcpayClient = (): AClient => {
    const arcpayClient = get(arcpayClientStore);
    if (typeof arcpayClient === 'undefined') {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const newArcpayClient = useArcpay({
            apiKey: PUBLIC_ARCPAY_KEY,
            network: 'voi:testnet',
            darkMode: isDarkMode,
        }) as AClient;

        arcpayClientStore.set(newArcpayClient);

        return newArcpayClient;
    }
    return arcpayClient;
}*/

export const getArcpayClient = (): ArcpayClient => {
    return createClient('voi:testnet', {
        apiKey: PUBLIC_ARCPAY_KEY, // API key can be obtained from the arcpay dashboard
        darkMode: true,
    });
} 

export const getListings = async (token?: Token, invalidate: boolean = false): Promise<Listing[]> => {
    try {
        if (!invalidate) {
            const cachedListings = get(listingStore);
            if (cachedListings.length > 0) {
                if (token) return cachedListings.filter((listing) => listing.asset_id === `${token.contractId}/${token.tokenId}`);
                return cachedListings;
            }
        }

        const arcpayClient = getArcpayClient();
        if (arcpayClient) {
            const listings = (await arcpayClient.getListings()).data;

            if (listings) {
                // sort listings by created_at date/time
                listings.sort((a: Listing, b: Listing) => {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });

                listingStore.set(listings);

                if (token) return listings.filter((listing: Listing) => listing.asset_id === `${token.contractId}/${token.tokenId}`);
                return listings;
            }
        }
        return [];
    } catch (error) {
        console.error('Error fetching listings:', error);
        return [];
    }
}

export const listToken = async (token: Token): Promise<string> => {
    const isDarkMode = (document) ? document.documentElement.classList.contains('dark') : false;
    const client = getArcpayClient();

    client.toggleDarkMode(isDarkMode);
    const listingId: string = await client.create({
        assetId: `${token.contractId}/${token.tokenId}`,
    });
    console.log('Listing ID:', listingId);
    return listingId;
}

export const buyToken = async (listingId: string): Promise<string | undefined> => {
    const client = getArcpayClient();
    const isDarkMode = document.documentElement.classList.contains('dark');
    client.toggleDarkMode(isDarkMode);
    const tx: TransactionConfirmation | undefined = await client.buy(listingId);
    console.log(tx);
    if (tx) {
        return tx.txIds[0];
    }
    return undefined;
}

export const cancelListing = async (listingId: string): Promise<void> => {
    const client = getArcpayClient();
    await client.cancel(listingId);
}
