import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postComment, getMessage, saveAction, getAction } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params, cookies, locals }) => {
    const { cid } = params;
    const formData = await request.formData();
    const messageId = Number(formData.get('messageId')?.toString()) ?? null;
    const comment = formData.get('comment')?.toString() ?? '';

    if (messageId === null || comment === '') {
        throw error(400, 'Invalid comment data. Please try again.');
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

    const c = {
        parent_message_id: messageId,
        walletId: walletId,
        comment: comment,
    };

    // Post comment to supabase
    await postComment(c);

    const action = {
        action: 'post_comment',
        address: walletId,
        description: `Posted a comment in message ${messageId}`,
        ip: locals.ipAddress,
    };

    const isFirstAction = ((await getAction('post_comment', walletId) ?? []).length === 0);

    await saveAction(action);

    return json({ success: true, isFirstAction });
}; 