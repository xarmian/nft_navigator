import type { Currency } from '$lib/data/types';
import { algodClient, algodIndexer } from './algod';
import { arc200 as Contract } from "ulujs";
import { currencies } from '../../stores/collection';
import { get } from 'svelte/store';
import { WVOI2_CONTRACT_ID } from '../data/constants';

export const getWalletBalance = async (address: string, assetId: number): Promise<number> => {
    try {
        if (assetId == 0) throw new Error('Native Token');
        const ctc = new Contract(assetId, algodClient, algodIndexer);
        const balance = await ctc.arc200_balanceOf(address);
        return (balance.success) ? Number(balance.returnValue) : 0;
    }
    catch (err) {
        try {
            if (assetId === 0) {
                const accountInfo = await algodClient.accountInformation(address).do();
                return accountInfo.amount;
            }
            else {
                const accountInfo = await algodClient.accountInformation(address).do();
                const assetHolding = accountInfo.assets.find((a: { assetId: number }) => a.assetId === assetId);
                return (assetHolding) ? assetHolding.amount : 0;
            }
        }
        catch (err) {
            return 0;
        }
    } 
}

// get currency from store if available, otherwise pull from blockchain
export const getCurrency = async (assetId: number, forMarket: boolean = false): Promise<Currency | null> => {
    switch (assetId) {
        case 0:
        case WVOI2_CONTRACT_ID:
            if (assetId === WVOI2_CONTRACT_ID && forMarket) break;
            return {
                assetId: 0,
                name: 'Voi',
                unitName: 'VOI',
                symbol: 'VOI',
                total: 10000000000,
                decimals: 6,
            };
        case 6779767:
            return {
                assetId: 6779767,
                name: 'Voi Incentive Asset',
                unitName: 'VIA',
                symbol: 'VIA',
                total: 10000000000,
                decimals: 6,
            };
    }

    const cstore = get(currencies).find((c: Currency) => c.assetId === assetId);
    if (cstore) {
        return cstore;
    } 
    else {
        try {
            const ctc = new Contract(assetId, algodClient, algodIndexer);
            const decimals = await ctc.arc200_decimals();
            const name = await ctc.arc200_name();
            const symbol = await ctc.arc200_symbol();
            const total = await ctc.arc200_totalSupply();

            const currency = {
                assetId: assetId,
                name: (name.success) ? name.returnValue : '',
                unitName: (symbol.success) ? symbol.returnValue : '',
                symbol: (symbol.success) ? symbol.returnValue : '',
                decimals: (decimals.success) ? Number(decimals.returnValue) : 0,
                total: (total.success) ? Number(total.returnValue) : 0,
            };

            currencies.set([...get(currencies), currency]);
            return currency;
        }
        catch (err) {
            try {
                const assetInfo = await (algodClient.getAssetByID(assetId)).do();
                const currency = {
                    assetId: assetInfo.assetIndex,
                    name: assetInfo.params.name,
                    unitName: assetInfo.params.unitName,
                    symbol: assetInfo.params.unitName,
                    total: assetInfo.params.total,
                    decimals: assetInfo.params.decimals,
                };
                currencies.set([...get(currencies), currency]);
                return currency;
            } catch (err) {
                return null;
            }
        }
    }
}

