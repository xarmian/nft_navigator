import { json } from '@sveltejs/kit';
import { saveAction } from '$lib/supabase-server';
import { verifyToken } from 'avm-wallet-svelte';

type Wallet = {
    address: string;
    app: string;
}

export async function POST({ request, cookies }) {
	const body: { action: string; wallets?: Wallet[], wallet?: Wallet, detail?: { from: string, to: string, token: string, transactionId: string } } = await request.json();

    const cookieWallet = cookies.get('avm-wallet');
    if (!cookieWallet || cookieWallet.length < 58) {
        return json({ 'success':'false', 'error':'no wallet' }, { status: 400 });
    }

    console.log('action',body.action);

    if (body.action == 'connect_wallet' && body.wallets) {
        const wallets = body.wallets
        wallets.forEach(async (wallet: { address: string; app: string;}) => {
            const action = {
                action: body.action,
                address: wallet.address,
                description: `Connected ${wallet.app}, Total connected = ${wallets.length}`,
            }
            await saveAction(action);
        });
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
        }
        await saveAction(action);
    }
    else if (body.action == 'token_approve' && body.detail) {
        const detail = body.detail;
        const action = {
            action: body.action,
            address: detail.from,
            description: `Approved token ${detail.token} to ${detail.to}, txId: ${detail.transactionId}`,
        }
        await saveAction(action);
    }
    else if (body.action == 'token_transfer' && body.detail) {
        const detail = body.detail;
        const action = {
            action: body.action,
            address: detail.from,
            description: `Transferred token ${detail.token} to ${detail.to}, txId: ${detail.transactionId}`,
        }
        await saveAction(action);
    }
  
	return json({ 'success':'true' }, { status: 200 });
}