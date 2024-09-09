import type { PageServerLoad } from './$types';
import { getMessages, postMessage, postComment, getMessage, saveAction, postReaction, postPollVote, storeMessageImage, getAction } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import { getTokens } from '$lib/utils/indexer';
import { error } from '@sveltejs/kit';
import type { IPoll, NMessage } from '$lib/data/types';
import { v4 as uuidv4 } from 'uuid';

export const load: PageServerLoad = async ({ params, cookies, url }) => {
  const { cid: route } = params;
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const page = url.searchParams.get('page') ?? 1;

  const routeParts = route.split('/');  
  const cid = routeParts[0];
  const messageId = routeParts[1] ?? null;

  if (cid === 'undefined' || cid === undefined) return {
    server_data: { collectionId: cid, messages: [], nfds: [] },
  }
  const limit = 100;

  if (cid === 'undefined') {
    error(400, { message: 'Invalid collection ID. Please try again.' });
  }

  // get token from cookie avm-wallet-token
  const walletId = cookies.get('avm-wallet');
  const token = cookies.get(`avm-wallet-token-${walletId}`);

  // validate user's wallet token
  let isValid = false;
  try {
    isValid = (walletId && token) ? await verifyToken(walletId,token) : false;
  } catch (e) {
    console.log(e);
  }

  let data = [];

  if (cid == 'all') {
    //const collectionIds = (await getTokens({ owner: walletId })).map((t) => String(t.contractId));
    //data = (await getPublicFeed([], true, limit, Number(page))).concat(await getPrivateFeed(collectionIds, true));
    data = await getMessages(null, null, false, walletId, limit);
    //console.log(data);
  }
  else if (cid === 'myfeed') {
    const collectionIds = (await getTokens({ owner: walletId })).map((t) => String(t.contractId));
    //data = (await getPublicFeed(collectionIds, true, limit, Number(page))).concat(await getPrivateFeed(collectionIds, true));
    data = await getMessages(collectionIds, null, true, walletId, limit);
  }
  else if (cid === '0') {
    //data = await getMessages(cid, messageId, true, walletId, limit);
  }
  else {
    // validate user can access collection
    const ownsToken = (await getTokens({ owner: walletId, contractId: cid })).length > 0;

    // fetch messages from supabase
    data = (cid ? await getMessages(cid, messageId, (isValid && ownsToken), walletId, limit) : []);

    /*if (data.length === 0) {
      data.push({
        collectionId: cid,
        walletId: 'R7TBR3Y5QCM6Y2OPQP3BPNUQG7TLN75IOC2WTNRUKO4VPNSDQF52MZB4ZE',
        message: 'Be the change you want to see in the world. - Mahatma Gandhi',
        private: false,
        timestamp: new Date().toString(),
      });
    }*/
  }

  return {
    server_data: { collectionId: cid, messageId, messages: data as NMessage[], nfds: [] },
  }
}

export const actions = {
  postMessage: async ({ request, params, cookies, locals }) => {
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

    // generate a uuid for each file
    for (let i = 0; i < files.length; i++) {
      const uuid = uuidv4();
      imageIds.push(uuid);
    }

    const message = {
      collectionId: Number(cid),
      walletId: walletId,
      message: formData.get('message')?.toString() ?? '',
      private: formData.get('privacy') === 'Private',
      poll: postPoll, // JSON
      images: imageIds,
    };

    // post message to supabase
    const messageId = await postMessage(message);

    if (messageId && files.length > 0) {
      for (const [idx, file] of files.entries()) {
        // store file in supabase
        await storeMessageImage(imageIds[idx], messageId, idx, 'messages-images', file, 480, 480);
      }
    }

    const actionType = (message.private ? 'post_private' : 'post_public')

    const action = {
      action: actionType,
      address: walletId,
      description: `Posted a ${actionType} message in collection ${cid}`,
      ip: locals.ipAddress,
    }

    const isFirstAction = ((await getAction(actionType, walletId)??[]).length === 0);

    await saveAction(action);

    return { success: true, isFirstAction };
  },
  postComment: async ({ request, cookies, locals }) => {
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
      ip: locals.ipAddress,
    }

    const isFirstAction = ((await getAction('post_comment', walletId)??[]).length === 0);

    await saveAction(action);

    return { success: true, isFirstAction };
  },
  postReaction: async ({ request, cookies, locals }) => {
    const formData = await request.formData();
    const messageId = Number(formData.get('messageId')?.toString()) ?? 0;
    const commentId = Number(formData.get('commentId')?.toString()) ?? 0;
    const reaction = formData.get('reaction')?.toString() || undefined;

    if (messageId === 0 || !reaction) {
      error(400, { message: 'Invalid reaction data. Please try again.' });
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

   // post reaction to supabase
    await postReaction(messageId, (commentId == 0 ? null : commentId), walletId, parseInt(reaction));

    const action = {
      action: 'post_reaction',
      address: walletId,
      description: `Posted reaction ${reaction} in message ${messageId}, comment ${commentId}`,
      ip: locals.ipAddress,
    }

    await saveAction(action);

    const isFirstAction = ((await getAction('post_reaction', walletId)??[]).length) === 0;

    return { success: true, isFirstAction };
  },
  postPollVote: async ({ request, cookies, locals }) => {
    const formData = await request.formData();
    const messageId = Number(formData.get('messageId')?.toString()) ?? 0;
    const vote = formData.get('vote')?.toString()??'';

    if (messageId === 0 || vote === '') {
      error(400, { message: 'Invalid poll vote data. Please try again.' });
    }

    // get token from cookie avm-wallet-token
    const walletId = cookies.get('avm-wallet');
    const token = cookies.get(`avm-wallet-token-${walletId}`);

    // validate user's wallet token
    const isValid = (walletId && token) ? await verifyToken(walletId,token) : false;

    const message = await getMessage(messageId);
    const cid = message?.collectionId;

    // check if we are past the end time of the poll
    if (new Date() > new Date(message?.poll?.endTime ?? 0)) {
      error(400, { message: 'Poll has ended. Please try again.' });
    }
    
    if (!isValid || !walletId) {
      error(401, { message: 'Invalid authorization token. Please re-authenticate and try again.' });
    }

    if ((message?.poll?.publicVoting??false) === false) {
      // validate user can access collection
      const ownsToken = (walletId && cid) ? (await getTokens({ owner: walletId, contractId: cid })).length > 0 : false;

      if (!ownsToken) {
        error(401, { message: 'This poll does not allow public voting, and the selected wallet does not own a token in the collection.' });
      }
    }

    // post poll vote to supabase
    const status = await postPollVote(messageId, walletId, Number(vote));

    if (status) {
      const action = {
        action: 'post_poll_vote',
        address: walletId,
        description: `Voted in poll in message ${messageId}`,
        ip: locals.ipAddress,
      }

      const isFirstAction = ((await getAction('post_poll_vote', walletId)??[]).length == 0);

      await saveAction(action);

      return { success: true, isFirstAction };
    }
    else {
      error(401, { message: 'Error posting poll vote. Please try again.' });
    }
  },
};