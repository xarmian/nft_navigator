import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMessage, saveAction, getAction, postPollVote } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
    const data = await request.json();
    const messageId = Number(data.messageId) ?? 0;
    const vote = data.vote?.toString() ?? '';

    if (messageId === 0 || vote === '') {
        throw error(400, 'Invalid poll vote data. Please try again.');
    }

    // Get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // Validate user's wallet token
    const isValid = (walletId && token) ? await verifyToken(walletId, token) : false;

    const message = await getMessage(messageId);
    const messageCollectionId = message?.collectionId;

    // Check if we are past the end time of the poll
    if (new Date() > new Date(message?.poll?.endTime ?? 0)) {
        throw error(400, 'Poll has ended. Please try again.');
    }
    
    if (!isValid || !walletId) {
        throw error(401, 'Invalid authorization token. Please re-authenticate and try again.');
    }

    if ((message?.poll?.publicVoting ?? false) === false) {
        // Validate user can access collection
        const ownsToken = (walletId && messageCollectionId) ? (await getTokens({ owner: walletId, contractId: messageCollectionId })).length > 0 : false;

        if (!ownsToken) {
            throw error(401, 'This poll does not allow public voting, and the selected wallet does not own a token in the collection.');
        }
    }

    // Post poll vote to supabase
    const status = await postPollVote(messageId, walletId, Number(vote));

    if (status) {
        const action = {
            action: 'post_poll_vote',
            address: walletId,
            description: `Voted in poll in message ${messageId}`,
            ip: locals.ipAddress,
        };

        const isFirstAction = ((await getAction('post_poll_vote', walletId) ?? []).length === 0);

        await saveAction(action);

        return json({ success: true, isFirstAction });
    } else {
        throw error(500, 'Error posting poll vote. Please try again.');
    }
}; 