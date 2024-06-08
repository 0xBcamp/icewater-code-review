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

const TO_ADDRESSES = process.env.DISTRIBUTION_ADDRESSES.split(',');

const ICE_AMOUNTS = process.env.DISTRIBUTION_ICE_AMOUNTS.split(',');
const H2O_AMOUNTS = process.env.DISTRIBUTION_H2O_AMOUNTS.split(',');
const STM_AMOUNTS = process.env.DISTRIBUTION_STM_AMOUNTS.split(',');

if (TO_ADDRESSES.length != ICE_AMOUNTS.length) {
    console.error("ADDRESSES and ICE_AMOUNTS don't have the same size!");
    exit();
}

if (TO_ADDRESSES.length != H2O_AMOUNTS.length) {
    console.error("ADDRESSES and H2O_AMOUNTS don't have the same size!");
    exit();
}

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
var IceToken;
var H2OToken;
var SteamToken;

var DistributionAddr;
var IceTokenAddr;
var H2OTokenAddr;
var SteamTokenAddr;

function loadJson(filepath) {
    let rawdata = fs.readFileSync(filepath);
    return JSON.parse(rawdata);
}

async function loadContracts() {
    const networkId = NETWORK_ID;

    console.log("Loading JSONs")
    const IceTokenJson = loadJson('src/abis/IceToken.json');
    const H2OTokenJson = loadJson('src/abis/H2OToken.json');
    const SteamTokenJson = loadJson('src/abis/SteamToken.json');
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

    // Load the IceToken contract
    const iceTokenData = IceTokenJson.networks[networkId];
    if(iceTokenData) {
        IceTokenAddr = iceTokenData.address;
        IceToken = new web3.eth.Contract(IceTokenJson.abi, IceTokenAddr);
        
    } else {
        console.error('IceToken contract not deployed to this network.');
        return;
    }

    // Load the H2OToken contract
    const h2oTokenData = H2OTokenJson.networks[networkId];
    if(h2oTokenData) {
        H2OTokenAddr = h2oTokenData.address;
        H2OToken = new web3.eth.Contract(H2OTokenJson.abi, H2OTokenAddr);        
    } else {
        console.error('H2OToken contract not deployed to this network.');
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
    const iceSupply = await IceToken.methods.balanceOf(FROM_ADDRESS).call();
    const h2oSupply = await H2OToken.methods.balanceOf(FROM_ADDRESS).call();
    const stmSupply = await SteamToken.methods.balanceOf(FROM_ADDRESS).call();

    console.log("Supplies:");
    console.log("  ICE: " + iceSupply);
    console.log("  H2O: " + h2oSupply);
    console.log("  STM: " + stmSupply);

    // Ice Amounts
    var iceAmounts = []
    var iceSum = BigInt(0);
    for (const amount of ICE_AMOUNTS) {
        const bigintAmount = BigInt(parseInt(amount*100)) * BigInt(1e16);
        iceAmounts.push(bigintAmount.toString());

        iceSum += bigintAmount;
    }

    if (iceSum > iceSupply) {
        console.error("ERROR: ICE_AMOUNTS: ", iceSum, " > SUPPLY: ", iceSupply);
        exit();
    }

    // H2O Amounts
    var h2oAmounts = []
    var h2oSum = BigInt(0);
    for (const amount of H2O_AMOUNTS) {
        const bigintAmount = BigInt(parseInt(amount*100)) * BigInt(1e16);
        h2oAmounts.push(bigintAmount.toString());

        h2oSum += bigintAmount;
    }

    if (h2oSum > h2oSupply) {
        console.error("ERROR: H2O_AMOUNTS: ", h2oSum, " > SUPPLY: ", h2oSupply);
        exit();
    }

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


    // Approve ICE
    if (iceSum > BigInt(0)) {
        await IceToken.methods.approve(DistributionAddr, iceSum)
            .send(
                {
                    from: FROM_ADDRESS,
                    gas: 4500000,
                    gasPrice: 10000000000
                }
            ).on('transactionHash', (hash) => { 
                console.log("Approved ICE", iceSum.toString())
            });
    }

    // Approve H2O
    if (h2oSum > BigInt(0)) {
        await H2OToken.methods.approve(DistributionAddr, h2oSum)
            .send(
                {
                    from: FROM_ADDRESS,
                    gas: 4500000,
                    gasPrice: 10000000000
                }
            ).on('transactionHash', (hash) => { 
                console.log("Approved H2O", h2oSum.toString())
            });
    }
    
    // Approve STM
    if (stmSum > BigInt(0)) {
        await SteamToken.methods.approve(DistributionAddr, stmSum)
        .send(
            {
                from: FROM_ADDRESS,
                gas: 4500000,
                gasPrice: 10000000000
            }
        ).on('transactionHash', (hash) => { 
            console.log("Approved STM", stmSum.toString())
        });
    }

    // Distribute ICE
    if (iceSum > BigInt(0)) {
        await Distribution.methods.distributeAmounts(
                IceTokenAddr, TO_ADDRESSES, iceAmounts)
            .send(
                {
                    from: FROM_ADDRESS, 
                    gas: 4500000,
                    gasPrice: 10000000000
                }
            ).on('receipt', (hash) => { 
                    console.log("Distributed ICE")
                }
            ).on('error', (error, receipt) => {
                    console.error("::::ERROR::::")
                    console.error(error);
                }
            );
    }

    // Distribute H2O
    if (h2oSum > BigInt(0)) {
        await Distribution.methods.distributeAmounts(
            H2OTokenAddr, TO_ADDRESSES, h2oAmounts)
        .send(
            {
                from: FROM_ADDRESS, 
                gas: 4500000,
                gasPrice: 10000000000
            }
        ).on('receipt', (hash) => { 
                console.log("Distributed H2O")
            }
        ).on('error', (error, receipt) => {
                console.error("::::ERROR::::")
                console.error(error);
            }
        );
    }

    // Distribute STM
    if (stmSum > BigInt(0)) {
        await Distribution.methods.distributeAmounts(
            SteamTokenAddr, TO_ADDRESSES, stmAmounts)
        .send(
            {
                from: FROM_ADDRESS, 
                gas: 4500000,
                gasPrice: 10000000000
            }
        ).on('receipt', (hash) => { 
                console.log("Distributed STM")
            }
        ).on('error', (error, receipt) => {
                console.error("::::ERROR::::")
                console.error(error);
            }
        );
    }

    // Final Balances
    const iceBalance = await IceToken.methods.balanceOf(TO_ADDRESSES[0]).call();
    const h2oBalance = await H2OToken.methods.balanceOf(TO_ADDRESSES[0]).call();
    const stmBalance = await SteamToken.methods.balanceOf(TO_ADDRESSES[0]).call();

    console.log("Final Balances:");
    console.log("  ICE: " + iceBalance);
    console.log("  H2O: " + h2oBalance);
    console.log("  STM: " + stmBalance);

}

main();