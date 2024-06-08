import Web3 from 'web3'
import * as fs from 'fs';
import * as dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import { exit } from 'process';

// Load the .env file
var dotenvConfig = dotenv.config()
dotenvExpand(dotenvConfig)

const NETWORK_ID = process.env.DISTRIBUTION_NETWORK_ID;
const FROM_ADDRESS = process.env.DISTRIBUTION_PUBKEY
const FROM_PRIVKEY = process.env.DISTRIBUTION_PRIVKEY
const NODE_URL = process.env.DISTRIBUTION_ETH_NODE_URL

const TO_ADDRESSES = process.env.DISTRIBUTION_VENT_ADDRESSES.split(',');

const STM_AMOUNTS = process.env.DISTRIBUTION_VENT_STM_AMOUNTS.split(',');


if (TO_ADDRESSES.length != STM_AMOUNTS.length) {
    console.error("ADDRESSES and STM_AMOUNTS don't have the same size!");
    exit();
}

console.log('NETWORK_ID:' + NETWORK_ID)
console.log('FROM_ADDRESS:' + FROM_ADDRESS)
console.log('NODE_URL:' + NODE_URL)

var web3;
if (NODE_URL.startsWith("wss")) {
    web3 = new Web3(new Web3.providers.WebsocketProvider(NODE_URL));
} else {
    web3 = new Web3(new Web3.providers.HttpProvider(NODE_URL));
}

const account = web3.eth.accounts.privateKeyToAccount(FROM_PRIVKEY);
web3.eth.accounts.wallet.add(account);
web3.eth.defaultAccount = account.address;

var Distribution;
var Vent;
var SteamToken;

var DistributionAddr;
var VentAddr;
var SteamTokenAddr;

function loadJson(filepath) {
    let rawdata = fs.readFileSync(filepath);
    return JSON.parse(rawdata);
}

async function loadContracts() {
    const networkId = NETWORK_ID;

    console.log("Loading JSONs")
    
    const DistributionJson = loadJson('src/abis/Distribution.json');
    const VentJson = loadJson('src/abis/Vent.json');
    const SteamTokenJson = loadJson('src/abis/SteamToken.json');
    
    // Load the Distribution contract
    const distributionData = DistributionJson.networks[networkId];

    if (distributionData) {
        DistributionAddr = distributionData.address;
        Distribution = new web3.eth.Contract(
            DistributionJson.abi, DistributionAddr);
        
    } else {
        console.error('Distribution contract not deployed to this network.');
        return;
    }

    // Load the Vent contract
    const ventData = VentJson.networks[networkId];

    if (ventData) {
        VentAddr = ventData.address;
        Vent = new web3.eth.Contract(
            VentJson.abi, VentAddr);
        
    } else {
        console.error('Vent contract not deployed to this network.');
        return;
    }

    // Load the SteamToken contract
    const steamTokenData = SteamTokenJson.networks[networkId];
    if(steamTokenData) {
        SteamTokenAddr = steamTokenData.address;
        SteamToken = new web3.eth.Contract(SteamTokenJson.abi, SteamTokenAddr);
        
    } else {
        console.error('SteamToken contract not deployed to this network.');
        return;
    }

}

async function main() {
    await loadContracts();

    // Supply
    const stmSupply = await SteamToken.methods.balanceOf(FROM_ADDRESS).call();

    console.log("STM Supply: " + stmSupply);

    // STM Amounts
    var stmAmounts = []
    var stmSum = BigInt(0);
    for (const amount of STM_AMOUNTS) {
        const bigintAmount = BigInt(parseInt(amount*100)) * BigInt(1e16);
        stmAmounts.push(bigintAmount.toString());

        stmSum += bigintAmount;
    }

    if (stmSum > stmSupply) {
        console.error("ERROR: STM_AMOUNTS: ", stmSum, " > SUPPLY: ", stmSupply);
        exit();
    }

    // Approve STM
    await SteamToken.methods.approve(VentAddr, stmSum)
    .send(
        {
            from: FROM_ADDRESS,
            gas: 4500000,
            gasPrice: 10000000000
        }
    ).on('transactionHash', (hash) => { 
        console.log("Approved STM", stmSum.toString())
    });

    // Distribute STM
    await Distribution.methods.distributeVentAmounts(
        VentAddr, TO_ADDRESSES, stmAmounts)
    .send(
        {
            from: FROM_ADDRESS, 
            gas: 4500000,
            gasPrice: 10000000000
        }
    ).on('receipt', (hash) => { 
            console.log("Distributed STM in Vent")
        }
    ).on('error', (error, receipt) => {
            console.error("::::ERROR::::")
            console.error(error);
        }
    );

    // Final Balances
    const stmBalance = await Vent.methods.balanceOf(TO_ADDRESSES[0]).call();

    console.log("Final Balances:");
    console.log("  STM in Vent: " + stmBalance);

}

main();