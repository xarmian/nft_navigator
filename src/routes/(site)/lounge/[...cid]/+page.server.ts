import type { PageServerLoad } from './$types';
import { getMessages, postMessage } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';
import { getNFD } from '$lib/utils/nfd';

export const load: PageServerLoad = async ({ params, cookies }) => {
  const { cid } = params;

  // get token from cookie avm-wallet-token
  const walletId = cookies.get('avm-wallet');
  const token = cookies.get(`avm-wallet-token-${walletId}`);

  // validate user's wallet token
  const isValid = (walletId && token) ? await verifyToken(walletId,token) : false;

  // validate user can access collection
  const ownsToken = (await getTokens({ owner: walletId, contractId: cid })).length > 0;

  // fetch messages from supabase
  const data = (cid ? await getMessages(cid, (isValid && ownsToken)) : []);

  if (data.length === 0) {
    data.push({
      collectionId: cid,
      walletId: 'R7TBR3Y5QCM6Y2OPQP3BPNUQG7TLN75IOC2WTNRUKO4VPNSDQF52MZB4ZE',
      message: 'Be the change you want to see in the world. - Mahatma Gandhi',
      private: false,
      timestamp: new Date().toString(),
    });
  }

  // get a list of unique wallets from data.messages.walletId and then get their NFD data
  const wallets = Array.from(new Set(data.map((m) => m.walletId)));
  const nfd = await getNFD(wallets);

  data.forEach((m) => {
    const n = nfd.find((n) => n.key === m.walletId);
    if (n) {
      m.nfd = n;
    }
  });

  return {
    server_data: { collectionId: cid, messages: data, nfd: nfd },
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

    return { success: true };
  }
};