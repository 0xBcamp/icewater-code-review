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
const TO_ADDRESSES = process.env.DISTRIBUTION_MIST_ADDRESSES.split(',');
const AMOUNTS = process.env.DISTRIBUTION_MIST_AMOUNTS.split(',');

if (TO_ADDRESSES.length != AMOUNTS.length) {
    console.error("ADDRESSES and AMOUNTS don't have the same size!");
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
var MistToken;

var DistributionAddr;
var MistTokenAddr;

function loadJson(filepath) {
    let rawdata = fs.readFileSync(filepath);
    return JSON.parse(rawdata);
}

async function loadContracts() {
    const networkId = NETWORK_ID;

    console.log("Loading JSONs")
    const MistTokenJson = loadJson('src/abis/MistToken.json');
    const DistributionJson = loadJson('src/abis/Distribution.json');
    
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

    // Load the MistToken contract
    const mistTokenData = MistTokenJson.networks[networkId];
    if(mistTokenData) {
        MistTokenAddr = mistTokenData.address;
        MistToken = new web3.eth.Contract(MistTokenJson.abi, MistTokenAddr);
        
    } else {
        console.error('MistToken contract not deployed to this network.');
        return;
    }
}

async function main() {
    await loadContracts();

    // Supply
    const mistSupply = await MistToken.methods.balanceOf(FROM_ADDRESS).call();
    console.log("Supply:");
    console.log("  MIST: " + mistSupply);

    // Amounts
    var amounts = []
    var sum = BigInt(0);
    for (const amount of AMOUNTS) {
        const bigintAmount = BigInt(parseInt(amount*100)) * BigInt(1e16);
        amounts.push(bigintAmount.toString());

        sum += bigintAmount;

    }

    if (sum > mistSupply) {
        console.error("ERROR: AMOUNTS: ", sum, " > SUPPLY: ", mistSupply);
        exit();
    }

    // Approve
    await MistToken.methods.approve(DistributionAddr, mistSupply)
        .send(
            {
                from: FROM_ADDRESS,
                gas: 4500000,
                gasPrice: 10000000000
            }
        ).on('transactionHash', (hash) => { 
            console.log("Approved MIST", mistSupply.toString())
        });
        
    // Distribute
    await Distribution.methods.distributeAmounts(
            MistTokenAddr, TO_ADDRESSES, amounts)
        .send(
            {
                from: FROM_ADDRESS, 
                gas: 4500000,
                gasPrice: 10000000000
            }
        ).on('receipt', (hash) => { 
                console.log("Distributed MIST")
            }
        ).on('error', (error, receipt) => {
                console.error("::::ERROR::::")
                console.error(error);
            }
        );



    // Final Balances
    const mistBalance = await MistToken.methods.balanceOf(TO_ADDRESSES[0]).call();

    console.log("Final Balances:");
    console.log("  MIST: " + mistBalance);

}

main();