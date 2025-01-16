import { nfdStore } from "../../stores/collection";
import { get as getStoreValue } from 'svelte/store';
import { getEnvoiAddresses, getEnvoiNames } from './envoi';

export interface AggregatedNFD {
    key: string;
    replacementValue: string;
    avatar: string | null;
}

export async function getAddressesForNFD(nfdName: string): Promise<string[]> {
    return getEnvoiAddresses(nfdName);
}

export async function getNFD(data: string[]): Promise<AggregatedNFD[]> {
    const aggregatedNFDs: AggregatedNFD[] = [];
    let nfdStoreValue = getStoreValue(nfdStore);
    
    // Ensure nfdStoreValue is an array
    if (!Array.isArray(nfdStoreValue)) {
        nfdStoreValue = [];
        nfdStore.set(nfdStoreValue);
    }

    // Check store first for cached values
    const addressesToFetch = data.filter(address => 
        !nfdStoreValue.some(nfd => nfd?.key === address)
    );
    
    if (addressesToFetch.length === 0) {
        // All addresses were in store
        return nfdStoreValue.filter(nfd => data.includes(nfd?.key));
    }

    // Fetch new values from Envoi
    const envoiResults = await getEnvoiNames(addressesToFetch);

    // Process results
    envoiResults.forEach((result) => {
        const nfdData: AggregatedNFD = {
            key: result.address,
            replacementValue: result.name,
            avatar: result.metadata.avatar || null
        };
        aggregatedNFDs.push(nfdData);
    });

    // Update store with new values
    nfdStore.set([...nfdStoreValue, ...aggregatedNFDs]);

    // Add cached values from store
    data.forEach(address => {
        const cachedValue = nfdStoreValue.find(nfd => nfd?.key === address);
        if (cachedValue && !aggregatedNFDs.some(nfd => nfd.key === address)) {
            aggregatedNFDs.push(cachedValue);
        }
    });

    return aggregatedNFDs;
}
