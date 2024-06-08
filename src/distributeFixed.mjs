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
const TO_ADDRESSES = process.env.DISTRIBUTION_FIXED_ADDRESSES.split(',');

const DISTRIBUTION_FIXED_AMOUNT_ICE=process.env.DISTRIBUTION_FIXED_AMOUNT_ICE
const DISTRIBUTION_FIXED_AMOUNT_H2O=process.env.DISTRIBUTION_FIXED_AMOUNT_H2O
const DISTRIBUTION_FIXED_AMOUNT_STM=process.env.DISTRIBUTION_FIXED_AMOUNT_STM
const DISTRIBUTION_FIXED_AMOUNT_WIN=process.env.DISTRIBUTION_FIXED_AMOUNT_WIN

const doDistIce = parseInt(DISTRIBUTION_FIXED_AMOUNT_ICE) > 0;
const doDistH2O = parseInt(DISTRIBUTION_FIXED_AMOUNT_H2O) > 0;
const doDistSteam = parseInt(DISTRIBUTION_FIXED_AMOUNT_STM) > 0;
const doDistWin = parseInt(DISTRIBUTION_FIXED_AMOUNT_WIN) > 0;

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
var WinToken;

var DistributionAddr;
var IceTokenAddr;
var H2OTokenAddr;
var SteamTokenAddr;
var WinTokenAddr;

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
    const WinTokenJson = loadJson('src/abis/winToken.json');
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

    // Load the WinToken contract
    const winTokenData = WinTokenJson.networks[networkId];
    if(winTokenData) {
        WinTokenAddr = winTokenData.address;
        WinToken = new web3.eth.Contract(WinTokenJson.abi, WinTokenAddr);
        
    } else {
        console.error('WinToken contract not deployed to this network.');
        return;
    }
}

async function main() {
    await loadContracts();

    const iceBalance1 = await IceToken.methods.balanceOf(FROM_ADDRESS).call();

    // Supplies
    const iceSupply = await IceToken.methods.balanceOf(FROM_ADDRESS).call();
    const h2oSupply = await H2OToken.methods.balanceOf(FROM_ADDRESS).call();
    const steamSupply = await SteamToken.methods.balanceOf(FROM_ADDRESS).call();
    const winSupply = await WinToken.methods.balanceOf(FROM_ADDRESS).call();

    console.log("Supplies:");
    console.log("  ICE: " + iceSupply);
    console.log("  H2O: " + h2oSupply);
    console.log("  STM: " + steamSupply);
    console.log("  WIN: " + winSupply);

    // Get the distribution amounts
    const zeros18 = BigInt("1000000000000000000");
    const iceDistAmount = BigInt(DISTRIBUTION_FIXED_AMOUNT_ICE) * zeros18;
    const h2oDistAmount = BigInt(DISTRIBUTION_FIXED_AMOUNT_H2O) * zeros18;
    const steamDistAmount = BigInt(DISTRIBUTION_FIXED_AMOUNT_STM) * zeros18;
    const winDistAmount = BigInt(DISTRIBUTION_FIXED_AMOUNT_WIN) * zeros18;
    
    const numAddresses = BigInt(TO_ADDRESSES.length);
    const iceApproveAmount = iceDistAmount * numAddresses;
    const h2oApproveAmount = h2oDistAmount * numAddresses;
    const steamApproveAmount = steamDistAmount * numAddresses;
    const winApproveAmount = winDistAmount * numAddresses;
    
    console.log("Approve Amounts:");
    console.log("  ICE: " + iceApproveAmount);
    console.log("  H2O: " + h2oApproveAmount);
    console.log("  STM: " + steamApproveAmount);
    console.log("  WIN: " + winApproveAmount);

    console.log("Dist Amounts:");
    console.log("  ICE: " + iceDistAmount);
    console.log("  H2O: " + h2oDistAmount);
    console.log("  STM: " + steamDistAmount);
    console.log("  WIN: " + winDistAmount);

    // Approve
    if (true) {
        if (doDistIce) {
            await IceToken.methods.approve(DistributionAddr, iceApproveAmount)
                .send(
                    {
                        from: FROM_ADDRESS,
                        gas: 4500000,
                        gasPrice: 10000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("Approved ICE", iceApproveAmount.toString())
                });
        }

        if (doDistH2O) {
            await H2OToken.methods.approve(DistributionAddr, h2oApproveAmount)
                .send(
                    {
                        from: FROM_ADDRESS,
                        gas: 4500000,
                        gasPrice: 10000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("Approved H2O", h2oApproveAmount.toString())
                });
        }

        if (doDistSteam) {
            await SteamToken.methods.approve(DistributionAddr, steamApproveAmount)
                .send(
                    {
                        from: FROM_ADDRESS,
                        gas: 4500000,
                        gasPrice: 10000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("Approved STM", steamApproveAmount.toString())
                });
        }
        
        if (doDistWin) {
            await WinToken.methods.approve(DistributionAddr, winApproveAmount)
                .send(
                    {
                        from: FROM_ADDRESS,
                        gas: 4500000,
                        gasPrice: 10000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("Approved WIN", winApproveAmount.toString())
                });
        }
    }

    // Distribute
    if (true) {
        if (doDistIce) {
            console.log("Distributing ICE", iceDistAmount.toString());
            await Distribution.methods.distributeAmount(
                    IceTokenAddr, TO_ADDRESSES, iceDistAmount)
                .send(
                    {
                        from: FROM_ADDRESS, 
                        gas: 5000000,
                        gasPrice: 15000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("  done.")
                });
        }

        if (doDistH2O) {
            console.log("Distributing H2O", h2oDistAmount.toString());
            await Distribution.methods.distributeAmount(
                    H2OTokenAddr, TO_ADDRESSES, h2oDistAmount)
                .send(
                    {
                        from: FROM_ADDRESS, 
                        gas: 5000000,
                        gasPrice: 15000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("  done.")
                });
        }

        if (doDistSteam) {
            console.log("Distributing STM", steamDistAmount.toString());
            await Distribution.methods.distributeAmount(
                    SteamTokenAddr, TO_ADDRESSES, steamDistAmount) 
                .send(
                    {
                        from: FROM_ADDRESS, 
                        gas: 5000000,
                        gasPrice: 15000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("  done.")
                });
        }

        if (doDistWin) {
            console.log("Distributing WIN", winDistAmount.toString());
            await Distribution.methods.distributeAmount(
                    WinTokenAddr, TO_ADDRESSES, winDistAmount) 
                .send(
                    {
                        from: FROM_ADDRESS, 
                        gas: 4500000,
                        gasPrice: 15000000000
                    }
                ).on('transactionHash', (hash) => { 
                    console.log("  done.")
                });
        }
    }

    // Final Balances
    const iceBalance = await IceToken.methods.balanceOf(TO_ADDRESSES[0]).call();
    const h2oBalance = await H2OToken.methods.balanceOf(TO_ADDRESSES[0]).call();
    const steamBalance = await SteamToken.methods.balanceOf(TO_ADDRESSES[0]).call();
    const winBalance = await WinToken.methods.balanceOf(TO_ADDRESSES[0]).call();

    console.log("Final Balances:");
    console.log("  ICE: " + iceBalance);
    console.log("  H2O: " + h2oBalance);
    console.log("  STM: " + steamBalance);
    console.log("  WIN: " + winBalance);

}

main();