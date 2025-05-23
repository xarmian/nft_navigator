interface EnvoiNameResult {
    token_id?: string;
    address: string;
    name: string;
    metadata: {
        url?: string;
        avatar?: string;
        location?: string;
        'com.twitter'?: string;
        'com.github'?: string;
        [key: string]: string | undefined;
    };
    cached?: boolean;
}

interface EnvoiNameResponse {
    results: EnvoiNameResult[];
}

export async function getEnvoiNames(addresses: string[]): Promise<EnvoiNameResult[]> {
    const aggregatedNames: EnvoiNameResult[] = [];
    const addressChunks = [];
    const chunkSize = 50;

    for (let i = 0; i < addresses.length; i += chunkSize) {
        addressChunks.push(addresses.slice(i, i + chunkSize));
    }

    const allFetches = addressChunks.map(async (addressChunk) => {
        const addressList = addressChunk.join(',');
        const url = `https://api.envoi.sh/api/name/${addressList}`;

        return fetch(url)
            .then(response => response.json())
            .then((data: EnvoiNameResponse) => {
                data.results.forEach((result) => {
                    if (result.name) {
                        aggregatedNames.push({
                            address: result.address,
                            name: result.name,
                            metadata: result.metadata,
                            cached: result.cached
                        });
                    }
                });
            })
            .catch(() => {
                // Silently handle errors like in the NFD implementation
                return [];
            });
    });

    await Promise.all(allFetches);
    return aggregatedNames;
}

interface EnvoiAddressResult {
    address: string;
    name: string;
    cached?: boolean;
}

interface EnvoiAddressResponse {
    results: EnvoiAddressResult[];
}

export async function getEnvoiAddresses(name: string): Promise<string[]> {
    const url = `https://api.envoi.sh/api/address/${name.toLowerCase()}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'An error occurred while fetching data');
        }

        const data: EnvoiAddressResponse = await response.json();
        return data.results.map(result => result.address);
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        return [];
    }
}

export interface EnvoiSearchResult {
    address: string;
    name: string;
    cached?: boolean;
    metadata: {
        url?: string;
        avatar?: string;
        location?: string;
        'com.twitter'?: string;
        'com.github'?: string;
        [key: string]: string | undefined;
    };
}

export async function searchEnvoi(pattern: string): Promise<EnvoiSearchResult[]> {
    const url = `https://api.envoi.sh/api/search?pattern=${encodeURIComponent(pattern)}`;

    try {
        // Create an AbortController to timeout the request
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Set a timeout of 5 seconds
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, { signal });
        
        // Clear the timeout if the request completes
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'An error occurred while fetching data');
        }

        const data: { results: EnvoiSearchResult[] } = await response.json();
        return data.results;
    } catch (error) {
        // Handle AbortError specifically
        if (error instanceof DOMException && error.name === 'AbortError') {
            console.error('Request timed out after 5 seconds');
        } else {
            console.error(`Error: ${(error as Error).message}`);
        }
        return [];
    }
}

export async function resolveEnvoiToken(tokenIds: string[]): Promise<EnvoiNameResult[]> {
    const chunkSize = 10;
    const chunks = [];
    
    // Split tokenIds into chunks of 10
    for (let i = 0; i < tokenIds.length; i += chunkSize) {
        chunks.push(tokenIds.slice(i, i + chunkSize));
    }

    try {
        // Make parallel requests for each chunk
        const results = await Promise.all(
            chunks.map(async (chunk) => {
                const url = `https://api.envoi.sh/api/token/${chunk.join(',')}?avatar=small`;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to fetch token data');
                }
                const data: EnvoiNameResponse = await response.json();
                return data.results;
            })
        );

        // Flatten the results array
        return results.flat();
    } catch (error) {
        console.error(`Error resolving Envoi tokens: ${(error as Error).message}`);
        return [];
    }
}