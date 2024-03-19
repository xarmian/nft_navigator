interface AdditionalData {
    [key: string]: {
        name: string;
        properties?: {
            verified?: {
                avatar?: string;
            };
            userDefined?: {
                avatar?: string;
            };
        };
    };
}

interface AggregatedNFD {
    key: string;
    replacementValue: string;
    avatar: string | null;
}

export async function getAddressesForNFD(nfdName: string, fetchF: typeof fetch = fetch): Promise<string[]> {
    // Define the API endpoint
    const url = `https://api.nf.domains/nfd/${nfdName.toLocaleLowerCase()}?view=brief&poll=false&nocache=false`;

    try {
        // Make a GET request to the API
        const response = await fetchF(url);

        if (!response.ok) {
            // If response is not OK, throw an error
            const errorData = await response.json();
            throw new Error(errorData.message || 'An error occurred while fetching data');
        }

        // Parse the JSON response
        const data = await response.json();

        // merge data.caAlgo and data.unverifiedCaAlgo arrays, but one or both may be undefined
        if (!data.caAlgo && !data.unverifiedCaAlgo) {
            return [];
        } else if (!data.caAlgo) {
            return data.unverifiedCaAlgo;
        } else if (!data.unverifiedCaAlgo) {
            return data.caAlgo;
        }
        else {
            return Array.from(new Set(data.caAlgo.concat(data.unverifiedCaAlgo)));        
        }
    } catch (error) {
        // Handle errors (e.g., NFD not found, API issues)
        console.error(`Error: ${(error as Error).message}`);
    }
    return [];
}

export async function getNFD(data: string[], fetchF: typeof fetch = fetch): Promise<unknown[]> {
    const aggregatedNFDs: AggregatedNFD[] = [];
    const addressChunks = [];
    const chunkSize = 20;

    for (let i = 0; i < data.length; i += chunkSize) {
        addressChunks.push(data.slice(i, i + chunkSize));
    }

    const allFetches = addressChunks.map((addressChunk) => {
        let url = "https://api.nf.domains/nfd/lookup?";
        const params = new URLSearchParams();

        addressChunk.forEach((address: string) => {
            params.append("address", address);
        });

        params.append("view", "brief");
        params.append("allowUnverified", "true");

        url += params.toString();

        return fetchF(url)
        .then((response: Response) => response.json())
        .then((additionalData: AdditionalData) => {
            Object.entries(additionalData).forEach((val) => {
                const key = val[0];
                const value = val[1];
    
                const replacementValue: string = value.name;
                const avatar: string | null = value.properties?.verified?.avatar ?? value.properties?.userDefined?.avatar ?? null;
                aggregatedNFDs.push({ key, replacementValue, avatar });
            });
        })
        .catch(() => {
            // console.error("Error fetching additional data:", error);
        });
    });

    await Promise.all(allFetches);
    return aggregatedNFDs;
}
