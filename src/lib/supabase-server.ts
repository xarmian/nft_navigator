// src/lib/supabaseClient.ts
import type { IPoll } from '$lib/data/types';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { PRIVATE_SUPABASE_ROLE_KEY } from '$env/static/private';
import sharp from 'sharp';

const supabaseUrl = PUBLIC_SUPABASE_URL;
const supabaseAnonKey = PUBLIC_SUPABASE_ANON_KEY;
const supabaseRoleKey = PRIVATE_SUPABASE_ROLE_KEY;

export const supabasePublicClient = createClient(supabaseUrl!, supabaseAnonKey!);
export const supabasePrivateClient = createClient(supabaseUrl!, supabaseRoleKey!);

interface PReaction {
    id: number;
    walletId: string;
    messages_id: number;
    comments_id: number;
    reaction: number;
}

interface PMessage {
    collectionId: number;
    message: string;
    walletId: string;
    timestamp?: Date;
    userName?: string;
    private: boolean;
    deleted?: boolean;
    comments?: PComment[];
    reactions?: number[];
    mr?: PReaction[];
    poll?: IPoll;
    poll_responses?: { response: string, response_time: string, wallet_id: string }[];
    images: string[]; // uuids of images in storage
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
    reactions?: number[];
    mcr?: PReaction[];
}

interface PGroupProfile {
    id: number;
    name?: string;
    description?: string;
    avatar?: string;
    cover?: string;
    members?: string[];
    admins?: string[];
    creator: string;
    nsfw: boolean;
    settings?: Record<string, string>;
    created_at: number;
    updated_at: number;
    deleted?: boolean;
}

type FileOptions = {
    contentType?: string;
    metadata?: Record<string, string>;
};

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
    const query = supabasePrivateClient
        .from('messages')
        .select(`
            *,
            mr:reactions (
                reaction,
                messages_id,
                comments_id
            ),
            comments (
                *,
                mcr:reactions (
                    reaction,
                    messages_id,
                    comments_id
                )
            ),
            poll_responses (
                response,
                response_time,
                wallet_id
            )
        `)
        .eq('id', messageId);
    
    const { data, error } = await query;

    if (error) {
        console.error('getMessage', error);
    }

    return data?.[0] ?? null;
}

export const getMessages = async (collectionId: string[] | string | null, messageId: string | null, includePrivate: boolean, walletId: string = '', limit: number = 10) => {
    let query = supabasePrivateClient
        .from('messages')
        .select(`
            *,
            mr:reactions (
                reaction,
                messages_id,
                comments_id
            ),
            comments (
                *,
                mcr:reactions (
                    reaction,
                    messages_id,
                    comments_id
                )
            ),
            poll_responses (
                response,
                response_time,
                wallet_id
            )
        `)
        .neq('deleted', true)
        .eq('reactions.wallet_id', walletId)
        .order('timestamp', { ascending: false })
        .limit(limit)

    if (messageId) {
        query = query.eq('id', messageId);
    }

    if (Array.isArray(collectionId)) {
        query = query.in('collectionId', collectionId);
    }
    else if (collectionId) {
        query = query.eq('collectionId', collectionId);
    }

    if (!includePrivate) {
        query = query.neq('private', true);
    }

    const { data: messagesData, error: messagesError } = await query;

    if (messagesError) {
        console.error('getMessages', messagesError);
    }

    for (const message of messagesData ?? []) {
        if (message.poll && message.poll_responses && (message.poll_responses?.length ?? 0) > 0) {
            // aggregate poll responses and add to message.poll.votes object
            const pollResponses = message.poll_responses;
            const pollVotes: Record<number, number> = {};
            for (const response of pollResponses) {
                if (pollVotes[Number(response.response)]) {
                    pollVotes[Number(response.response)]++;
                } else {
                    pollVotes[Number(response.response)] = 1;
                }

                if (response.wallet_id === walletId && message.poll) {
                    message.poll.voted = response.response;
                }
            }

            message.poll.votes = pollVotes;
        }
        delete message.poll_responses;
    }

    return messagesData ?? [];
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
    const { data, error } = await supabasePrivateClient.from('messages').insert(message).select();

    if (error) {
        console.error('Error inserting message:', error);
    } else if (data) {
        const insertedId = data[0].id;
        return insertedId;
    }

    return null;
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

export const postReaction = async (p_message_id: number, p_comment_id: number | null, p_wallet_id: string, p_reaction: number) => {
    const { data, error } = await supabasePrivateClient.rpc('handle_reaction_json', { p_message_id, p_comment_id, p_wallet_id, p_reaction });

    if (error) {
        console.error('postReaction', error);
    }

    return data;
}

export const postPollVote = async (p_message_id: number, p_wallet_id: string, p_response: number): Promise<boolean> => {
    const { error } = await supabasePrivateClient.from('poll_responses').insert({ messages_id: p_message_id, wallet_id: p_wallet_id, response: p_response });

    if (error) {
        console.error('postPollVote', error);
        return false;
    }

    return true;
}

export async function storeMessageImage(key: string, messageId: string, idx: number, bucket: string, file: File, maxWidth: number, maxHeight: number): Promise<void> {
    // Convert the File object to a Buffer
    const buffer = await file.arrayBuffer();

    const metadata = {
        messageId: messageId,
        index: String(idx),
        contentType: file.type,
        originalFileName: file.name,
        originalFileUrl: file instanceof File ? URL.createObjectURL(file) : '',  // Generates a URL for local preview
    };

    // Resize the image
    const resizedBuffer = await sharp(Buffer.from(buffer))
        .resize(maxWidth, maxHeight, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .toBuffer();

    // Convert the Buffer to a File object
    const resizedFile = new File([resizedBuffer], file.name, { type: file.type });

    // Upload the resized image
    const { error } = await supabasePrivateClient.storage.from(bucket).upload(key, resizedFile, { contentType: file.type, metadata: metadata } as FileOptions);
    if (error) {
        console.error('Error uploading file:', error);
    }
}

export async function storeFile(key: string, bucket: string, file: File): Promise<void> {
    const fileName = `${key}`;  // Generates a unique filename based on wallet ID and timestamp
    const metadata = {
        contentType: file.type,
        originalFileName: file.name,
        originalFileUrl: file instanceof File ? URL.createObjectURL(file) : '',  // Generates a URL for local preview
    };

    const { error } = await supabasePrivateClient
        .storage
        .from(bucket)
        .upload(fileName, file, { contentType: file.type, metadata: metadata } as FileOptions);

    if (error) {
        console.error('Error uploading file:', error);
        return;
    }

    console.log('File uploaded successfully');
}

export async function retrieveFile(bucket: string, key: string): Promise<string | null> {
    try {
        const { data } = supabasePrivateClient
            .storage
            .from(bucket)
            .getPublicUrl(key);

        if (data) {
            return data.publicUrl;
        } else {
            console.log('No file found for the given key', key);
            return null;
        }
    } catch (error) {
        console.error('Error retrieving file:', error);
        return null;
    }
}

export async function deleteFile(bucket: string, key: string): Promise<void> {
    const { error } = await supabasePrivateClient
        .storage
        .from(bucket)
        .remove([key]);

    if (error) {
        console.error('Error deleting file:', error);
        return;
    }

    console.log('File deleted successfully');
}

export async function setProfile(groupProfile: PGroupProfile) {
    const { data, error } = await supabasePrivateClient.from('group_profiles').insert(groupProfile);

    if (error) {
        console.error('setProfile', error);
    }

    return data;
}

export async function getProfile(groupId: number): Promise<PGroupProfile | null> {
    const { data, error } = await supabasePrivateClient.from('group_profiles').select('*').eq('id', groupId);

    if (error) {
        console.error('getProfile', error);
    }

    return data?.[0] ?? null;
}

export async function updateProfile(groupProfile: PGroupProfile) {
    const { data, error } = await supabasePrivateClient.from('group_profiles').upsert(groupProfile);

    if (error) {
        console.error('updateProfile', error);
    }

    return data;
}