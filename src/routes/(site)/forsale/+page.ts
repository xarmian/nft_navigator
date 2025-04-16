import { mimirListingsStore } from '../../../stores/mimirListings';
import { resolveEnvoiToken } from '$lib/utils/envoi';
import { getEnvoiNames } from '$lib/utils/envoi';

export const load = (async ({ fetch }) => {
    // Get all active listings using the mimir listings store with a high limit
    // to ensure we get most or all listings in one request
    const result = await mimirListingsStore.fetchListings({ 
        fetch,
        limit: 1000, // Request a large number of listings at once
        reset: true // Ensure we're starting fresh
    });
    
    // Get total count for accurate stats
    const totalCount = result.totalCount;
    const tokens = result.tokens;
    
    // Process ENVOi names for owners
    const uniqueOwners = [...new Set(tokens.map(t => t.owner))];
    if (uniqueOwners.length > 0) {
        try {
            const envoiResults = await getEnvoiNames(uniqueOwners);
            if (envoiResults.length > 0) {
                // Update tokens with owner info
                tokens.forEach(token => {
                    const ownerEnvoi = envoiResults.find(r => r.address === token.owner);
                    if (ownerEnvoi) {
                        token.ownerNFD = ownerEnvoi.name;
                        token.ownerAvatar = ownerEnvoi.metadata?.avatar || '/blank_avatar_small.png';
                    }
                });
            }
        } catch (error) {
            console.error("Error resolving Envoi names for owners:", error);
        }
    }
    
    // Process ENVOi tokens if needed
    const envoiTokens = tokens.filter(t => t.contractId === 797609 && t.metadata && !t.metadata.envoiName);
    if (envoiTokens.length > 0) {
        try {
            const tokenIds = envoiTokens.map(token => token.tokenId);
            const envoiResults = await resolveEnvoiToken(tokenIds);
            
            // Update tokens with ENVOi data
            envoiTokens.forEach(token => {
                const envoiData = envoiResults.find(result => result.token_id === token.tokenId);
                if (envoiData && token.metadata) {
                    // Use record type for metadata extensions
                    const metadata = token.metadata as unknown as Record<string, unknown>;
                    metadata.envoiName = envoiData.name || token.metadata.name;
                    metadata.envoiMetadata = envoiData.metadata;
                }
            });
        } catch (error) {
            console.error("Error resolving Envoi token names:", error);
        }
    }

    const pageMetaTags = {
        title: 'For Sale | NFT Navigator',
        description: 'NFT Tokens for Sale',
    };

    return {
        tokens,
        totalCount,
        hasMore: result.hasMore,
        pageMetaTags,
    };
});
