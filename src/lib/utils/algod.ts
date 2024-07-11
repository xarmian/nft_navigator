import algosdk from 'algosdk';
//import { PUBLIC_ALGOD_TOKEN, PUBLIC_INDEXER_TOKEN } from '$env/static/public';

// Algorand node settings

//const server = "https://voi-testnet-node.nftnavigator.xyz";
//const token = PUBLIC_ALGOD_TOKEN;

const server = 'https://testnet-api.voi.nodly.io';
const token = '';

const port = '443';

// Algorand indexer settings

//const indexerServer = "https://voi-testnet-idx.nftnavigator.xyz"
//const indexerToken = PUBLIC_INDEXER_TOKEN;

const indexerServer = 'https://testnet-idx.voi.nodly.io';
const indexerToken = '';

const indexerPort = '443';

// Initialize the Algodv2 client
export const algodClient = new algosdk.Algodv2(token, server, port);
export const algodIndexer = new algosdk.Indexer(indexerToken, indexerServer, indexerPort);