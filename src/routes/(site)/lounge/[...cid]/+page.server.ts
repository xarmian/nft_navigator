import type { PageServerLoad } from './$types';
import { getMessages, postMessage, postComment, getMessage, saveAction, getPublicFeed, getPrivateFeed } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';
import { getNFD, type AggregatedNFD } from '$lib/utils/nfd';

export const load: PageServerLoad = async ({ params, cookies }) => {
  const { cid } = params;

  // get token from cookie avm-wallet-token
  const walletId = cookies.get('avm-wallet');
  const token = cookies.get(`avm-wallet-token-${walletId}`);

  // validate user's wallet token
  const isValid = (walletId && token) ? await verifyToken(walletId,token) : false;

  let data = [];

  if (cid == 'all') {
    const collectionIds = (await getTokens({ owner: walletId })).map((t) => String(t.contractId));
    data = (await getPublicFeed([])).concat(await getPrivateFeed(collectionIds));
  }
  else if (cid === 'myfeed') {
    const collectionIds = (await getTokens({ owner: walletId })).map((t) => String(t.contractId));
    data = (await getPublicFeed(collectionIds)).concat(await getPrivateFeed(collectionIds));
  }
  else {
    // validate user can access collection
    const ownsToken = (await getTokens({ owner: walletId, contractId: cid })).length > 0;

    // fetch messages from supabase
    data = (cid ? await getMessages(cid, (isValid && ownsToken), true) : []);

    if (data.length === 0) {
      data.push({
        collectionId: cid,
        walletId: 'R7TBR3Y5QCM6Y2OPQP3BPNUQG7TLN75IOC2WTNRUKO4VPNSDQF52MZB4ZE',
        message: 'Be the change you want to see in the world. - Mahatma Gandhi',
        private: false,
        timestamp: new Date().toString(),
      });
    }
  }

  // get a list of unique wallets from data.messages.walletId and data.messages.comments.walletId and then get their NFD data
  const wallets = Array.from(new Set(data.map((m) => m.walletId).concat(data.flatMap((m) => m.comments?.map((c) => c.walletId)))));
  const nfd: AggregatedNFD[] = await getNFD(wallets);

  // if wallets key is not in nfd, add it with default value and avatar. use token image if available
  for (const w of wallets) {
    if (!nfd.find((n) => n.key === w)) {
      const token = (await getTokens({ owner: w, limit: 1 }))?.[0] ?? {};
      nfd.push({ 
        key: w, 
        replacementValue: w, 
        avatar: token.metadata?.image ?? '/blank_avatar_small.png'
      });
    }
    else {
      const n = nfd.find((n) => n.key === w);
      if (n && !n.avatar) {
        const token = (await getTokens({ owner: w, limit: 1 }))?.[0] ?? {};
        n.avatar = token.metadata?.image ?? '/blank_avatar_small.png';
      }
    }
  }

  return {
    server_data: { collectionId: cid, messages: data, nfds: nfd },
  }
}

export const actions = {
  postMessage: async ({ request, params, cookies }) => {
    const { cid } = params;
    const formData = await request.formData();

    // get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // validate user's wallet token
    const isValid = (walletId && token) ? await verifyToken(walletId,token) : false;

    // validate user can access collection
    const ownsToken = (walletId && cid) ? (await getTokens({ owner: walletId, contractId: cid })).length > 0 : false;

    if (!isValid || !ownsToken || !walletId) {
      error(401, { message: 'Invalid authorization token. Please re-authenticate and try again.' });
    }

    const message = {
      collectionId: Number(cid),
      walletId: walletId,
      message: formData.get('message')?.toString() ?? '',
      private: formData.get('privacy') === 'Private',
    };

    // post message to supabase
    await postMessage(message);

    const actionType = (message.private ? 'post_private' : 'post_public')

    const action = {
      action: actionType,
      address: walletId,
      description: `Posted a ${actionType} message in collection ${cid}`,
    }

    await saveAction(action);

    return { success: true };
  },
  postComment: async ({ request, cookies }) => {
    const formData = await request.formData();
    const messageId = Number(formData.get('messageId')?.toString()) ?? null;
    const comment = formData.get('comment')?.toString() ?? '';

    if (messageId === null || comment === '') {
      error(400, { message: 'Invalid comment data. Please try again.' });
    }

    // get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // validate user's wallet token
    const isValid = (walletId && token) ? await verifyToken(walletId,token) : false;

    const message = await getMessage(messageId);
    const cid = message?.collectionId;

    // validate user can access collection
    const ownsToken = (walletId && cid) ? (await getTokens({ owner: walletId, contractId: cid })).length > 0 : false;

    if (!isValid || !ownsToken || !walletId) {
      error(401, { message: 'Invalid authorization token. Please re-authenticate and try again.' });
    }

    const c = {
      parent_message_id: messageId,
      walletId: walletId,
      comment: comment,
    };

    // post comment to supabase
    await postComment(c);

    const action = {
      action: 'post_comment',
      address: walletId,
      description: `Posted a comment in message ${messageId}`,
    }

    await saveAction(action);

    return { success: true };
  }
};