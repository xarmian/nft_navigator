import { json } from '@sveltejs/kit';
import { saveAction } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';
import type { RequestHandler } from '@sveltejs/kit';

type Wallet = {
    address: string;
    app: string;
}

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const body: { action: string; wallets?: Wallet[], wallet?: Wallet, detail?: { from: string, to: string, token: string, transactionId: string } } = await request.json();

    const ipAddress = locals.ipAddress;

    if (body.action == 'connect_wallet' && body.wallets) {
        const wallets = body.wallets
        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            const action = {
                action: body.action,
                address: wallet.address,
                description: `Connected ${wallet.app}, Total connected = ${wallets.length}`,
                ip: ipAddress,
            }
            await saveAction(action);
        }
    }
    else if (body.action == 'auth_wallet' && body.wallet) {
        const wallet = body.wallet;

        // test wallet authentication
        const walletId = cookies.get('avm-wallet');
        const token = cookies.get(`avm-wallet-token-${walletId}`);
        const isValid = (walletId && token) ? await verifyToken(walletId,token) : false;
    
        if (!isValid) {
            return json({ 'success':'false', 'error':'invalid auth token' }, { status: 401 });
        }

        const action = {
            action: body.action,
            address: body.wallet.address,
            description: `Authenticated wallet ${wallet.app}`,
            ip: ipAddress,
        }
        await saveAction(action);
    }
    else if (body.action == 'token_approve' && body.detail) {
        const detail = body.detail;
        const action = {
            action: body.action,
            address: detail.from,
            description: `Approved token ${detail.token} to ${detail.to}, txId: ${detail.transactionId}`,
            ip: ipAddress,
        }
        await saveAction(action);
    }
    else if (body.action == 'token_transfer' && body.detail) {
        const detail = body.detail;
        const action = {
            action: body.action,
            address: detail.from,
            description: `Transferred token ${detail.token} to ${detail.to}, txId: ${detail.transactionId}`,
            ip: ipAddress,
        }
        await saveAction(action);
    }
  
	return json({ 'success':'true' }, { status: 200 });
}