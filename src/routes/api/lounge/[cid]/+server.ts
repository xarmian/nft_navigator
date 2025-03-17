import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMessages, postMessage, getMessage, saveAction, getAction, storeMessageImage } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';
import type { IPoll } from '$lib/data/types';
import { getNFD } from '$lib/utils/nfd';

export const GET: RequestHandler = async ({ params, cookies, url }) => {
    const { cid } = params;
    const limit = 100;

    if (!cid || cid === 'undefined') {
        throw error(400, 'Invalid collection ID');
    }

    // Get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // Validate user's wallet token
    let isValid = false;
    try {
        isValid = (walletId && token) ? await verifyToken(walletId, token) : false;
    } catch (e) {
        console.error(e);
    }

    // Validate user can access collection
    const ownsToken = (walletId && cid) ? (await getTokens({ owner: walletId, contractId: cid })).length > 0 : false;

    // Fetch messages from supabase
    const messages = await getMessages(cid, null, (isValid && ownsToken), walletId, limit);

    // Get NFD data for all wallets in messages
    const wallets = Array.from(new Set(messages.map(m => m.walletId).concat(messages.flatMap(m => m.comments?.map(c => c.walletId) ?? []))));
    const nfds = await getNFD(wallets);

    return json({
        messages,
        nfds
    });
};

export const POST: RequestHandler = async ({ request, params, cookies, locals }) => {
    const { cid } = params;
    const formData = await request.formData();

    // Get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // Validate user's wallet token
    const isValid = (walletId && token) ? await verifyToken(walletId, token) : false;

    // Validate user can access collection
    const ownsToken = (walletId && cid) ? (await getTokens({ owner: walletId, contractId: cid })).length > 0 : false;

    if (!isValid || !ownsToken || !walletId) {
        throw error(401, 'Invalid authorization token. Please re-authenticate and try again.');
    }

    let postPoll: IPoll | undefined;
    const poll: string | undefined = formData.get('poll')?.toString() ?? undefined;
    if (poll !== '' && poll !== undefined) {
        try {
            postPoll = JSON.parse(poll);
        } catch (e) {
            postPoll = undefined;
        }
    }

    const files = formData.getAll('image') as File[];
    const imageIds = [];

    // Generate a uuid for each file
    for (let i = 0; i < files.length; i++) {
        const uuid = uuidv4();
        imageIds.push(uuid);
    }

    const message = {
        collectionId: Number(cid),
        walletId: walletId,
        message: formData.get('message')?.toString() ?? '',
        private: formData.get('privacy') === 'Private',
        poll: postPoll,
        images: imageIds,
    };

    // Post message to supabase
    const messageId = await postMessage(message);

    if (messageId && files.length > 0) {
        for (const [idx, file] of files.entries()) {
            // Store file in supabase
            await storeMessageImage(imageIds[idx], messageId, idx, 'messages-images', file, 480, 480);
        }
    }

    const actionType = (message.private ? 'post_private' : 'post_public');

    const action = {
        action: actionType,
        address: walletId,
        description: `Posted a ${actionType} message in collection ${cid}`,
        ip: locals.ipAddress,
    };

    const isFirstAction = ((await getAction(actionType, walletId) ?? []).length === 0);

    await saveAction(action);

    return json({ success: true, isFirstAction });
}; 