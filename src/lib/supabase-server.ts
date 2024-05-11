// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_ROLE_KEY } from '$env/static/private';

const supabaseUrl = PUBLIC_SUPABASE_URL;
const supabaseAnonKey = PUBLIC_SUPABASE_ANON_KEY;
const supabaseRoleKey = PRIVATE_SUPABASE_ROLE_KEY;

export const supabasePublicClient = createClient(supabaseUrl!, supabaseAnonKey!);
export const supabasePrivateClient = createClient(supabaseUrl!, supabaseRoleKey!);

interface PMessage {
    collectionId: number;
    message: string;
    walletId: string;
    timestamp?: Date;
    userName?: string;
    private: boolean;
    deleted?: boolean;
    comments?: PComment[];
}

interface PAction {
    action: string;
    address: string;
    created_at?: string;
    description: string;
}

interface PComment {
    id?: number;
    parent_message_id: number;
    walletId: string;
    comment: string;
    timestamp?: Date;
    deleted?: boolean;
}

export const getMessagesSim = async () => {
    function generateRandomAddress() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let address = '';
        for (let i = 0; i < 58; i++) {
          address += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return address;
    }
    
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const simdata = Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        message: 'hello',
        userName: `user${index + 1}`,
        userId: generateRandomAddress(),
        timestamp: new Date(Math.random() * (Date.now() - threeDaysAgo.getTime()) + threeDaysAgo.getTime()),
        avatar: undefined,
    }));
    
    return simdata;
}

export const getMessage = async (messageId: number): Promise<PMessage | null> => {
    const { data, error } = await supabasePrivateClient.from('messages').select('*').eq('id', messageId);

    if (error) {
        console.error('getMessage', error);
    }

    return data?.[0] ?? null;
}

export const getMessages = async (collectionId: string, includePrivate: boolean, includeComments: boolean = false) => {
    if (!collectionId) return [];

    let query = supabasePrivateClient.from('messages').select('*').eq('collectionId', collectionId).neq('deleted', true);

    if (!includePrivate) {
        query = query.neq('private', true);
    }

    const { data: messagesData, error: messagesError } = await query;

    if (messagesError) {
        console.error('getMessages', messagesError);
    }

    if (!includeComments) {
        return messagesData?.reverse() ?? [];
    }

    const messageIds = messagesData?.map((message) => message.id) ?? [];

    const { data: commentsData, error: commentsError } = await supabasePrivateClient
        .from('comments')
        .select('*')
        .in('parent_message_id', messageIds);

    if (commentsError) {
        console.error('getMessages - Comments', commentsError);
    }

    const messagesWithComments = messagesData?.map((message) => {
        const messageComments = commentsData?.filter((comment) => comment.parent_message_id === message.id);
        return { ...message, comments: messageComments };
    });

    return messagesWithComments?.reverse() ?? [];
}

export const getPublicFeed = async ( collectionIds: string[] ) => {
    let query = supabasePrivateClient.from('messages').select('*').neq('deleted', true).eq('private', false);

    if (collectionIds.length > 0) {
        query = query.in('collectionId', collectionIds);
    }

    const { data, error } = await query;

    if (error) {
        console.error('getPublicFeed',error);
    }

    return data?.reverse()??[];
}

export const getPrivateFeed = async ( collectionIds: string[] ) => {
    const query = supabasePrivateClient.from('messages').select('*').neq('deleted', true).eq('private', true).in('collectionId', collectionIds);

    const { data, error } = await query;

    if (error) {
        console.error('getPrivateFeed',error);
    }

    return data?.reverse()??[];
}

// Get collection data, which is generally settings for a collection
export const getCollectionData = async (collectionId: string) => {
    console.log('getCollectionData function not yet implemented');
    return [];

    const { data, error } = await supabasePublicClient.from('collections').select('*').eq('collectionId', collectionId);

    if (error) {
    console.error('getCollectionData',error);
    }

    return data;
}

// Get user data, which is generally settings for a user
export const getUserData = async (userId: string) => {
    console.log('getUserData function not yet implemented');
    return [];

    const { data, error } = await supabasePublicClient.from('users').select('*').eq('userId', userId);

    if (error) {
    console.error('getUserData',error);
    }

    return data;
}

// postMessage
export const postMessage = async (message: PMessage) => {
    const { data, error } = await supabasePrivateClient.from('messages').insert(message);

    if (error) {
    console.error('postMessage',error);
    }

    return data;
}

export const postComment = async ( comment: PComment) => {
    const { data, error } = await supabasePrivateClient.from('comments').insert(comment);

    if (error) {
    console.error('postComment',error);
    }

    return data;
}

export const saveAction = async (action: PAction) => {
    const { data, error } = await supabasePrivateClient.from('actions').insert(action);

    if (error) {
    console.error('saveAction',error);
    }

    return data;
}