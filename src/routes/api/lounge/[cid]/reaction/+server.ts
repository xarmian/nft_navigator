import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postReaction, getMessage, saveAction, getAction } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
    const data = await request.json();
    const messageId = Number(data.messageId) ?? 0;
    const commentId = Number(data.commentId) ?? 0;
    const reaction = data.reaction?.toString();

    if (messageId === 0 || reaction === undefined) {
        throw error(400, 'Invalid reaction data. Please try again.');
    }

    // Get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // Validate user's wallet token
    const isValid = (walletId && token) ? await verifyToken(walletId, token) : false;

    const message = await getMessage(messageId);
    const messageCollectionId = message?.collectionId;

    // Validate user can access collection
    const ownsToken = (walletId && messageCollectionId) ? (await getTokens({ owner: walletId, contractId: messageCollectionId })).length > 0 : false;

    if (!isValid || !ownsToken || !walletId) {
        throw error(401, 'Invalid authorization token. Please re-authenticate and try again.');
    }

    // Post reaction to supabase
    await postReaction(messageId, (commentId === 0 ? null : commentId), walletId, parseInt(reaction));

    const action = {
        action: 'post_reaction',
        address: walletId,
        description: `Posted reaction ${reaction} in message ${messageId}, comment ${commentId}`,
        ip: locals.ipAddress,
    };

    await saveAction(action);

    const isFirstAction = ((await getAction('post_reaction', walletId) ?? []).length === 0);

    return json({ success: true, isFirstAction });
}; 