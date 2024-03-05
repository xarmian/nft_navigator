import type { Currency } from '$lib/data/types';
import { algodClient, algodIndexer } from './algod';
import { arc200 as Contract } from "ulujs";
import { currencies } from '../../stores/collection';
import { get } from 'svelte/store';

// get currency from store if available, otherwise pull from blockchain
export const getCurrency = async (assetId: number): Promise<Currency | null> => {
    switch (assetId) {
        case 0:
            return {
                assetId: 0,
                name: 'Voi',
                unitName: 'VOI',
                total: 10000000000,
                decimals: 6,
            };
        case 6779767:
            return {
                assetId: 6779767,
                name: 'Voi Incentive Asset',
                unitName: 'VIA',
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

