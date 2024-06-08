const { ethers, upgrades } = require("hardhat");
const fs = require("fs");

var _gasCount = ethers.BigNumber.from(0);
var _deployer = undefined;

function _checkDeployer()
{
    if (_deployer === undefined) {
        throw 'Deployer account not set. Call init() first.';
    }
}

async function _updateContractJson(name, address, solPath)
{
    const artifactPath = "artifacts/contracts/" + solPath + "/" + name + ".json";
    const artifactRawData = fs.readFileSync(artifactPath);
    var artifactData = JSON.parse(artifactRawData);

    const network = await ethers.provider.getNetwork();
    const chaindIdKey = network.chainId.toString();

    if (!fs.existsSync('abis')){
        fs.mkdirSync('abis');
    }
    
    const abiPath = "abis/" + name + ".json";
    var abiData = {};
    if (fs.existsSync(abiPath)) {
        var abiRawData = fs.readFileSync(abiPath);
        abiData = JSON.parse(abiRawData);
    }

    if (!('networks' in abiData)) {
        abiData['networks'] = {};
    }
    abiData['networks'][chaindIdKey] =  {"address" : address};
    abiData['abi'] = artifactData.abi;

    outRawData = JSON.stringify(abiData, null, 2);

    fs.writeFileSync(abiPath, outRawData);
}

async function _getContractAddrFromABI(abiDir, name)
{
    if (!fs.existsSync(abiDir)) {
        throw "Invalid ABI dir: " + abiBasePath;
    }

    const abiPath = abiDir + "/" + name + ".json";

    const rawdata = fs.readFileSync(abiPath);
    const abi = JSON.parse(rawdata);

    const network = await ethers.provider.getNetwork();
    const chaindIdKey = network.chainId.toString();

    if (!abi.networks[chaindIdKey]) {
        return;
    }

    return abi.networks[chaindIdKey].address;
}

async function _copyOpenZeppelinDirFromRepo(repoPath)
{
    const network = await ethers.provider.getNetwork();
    const chaindIdKey = network.chainId.toString();

    const ozDir = repoPath + "/.openzeppelin";
    if (!fs.existsSync(ozDir)) {
        throw "Old Version .openzeppelin dir not found:" + ozDir;
    }

    const destDir = "./.openzeppelin";
    if (!fs.existsSync(destDir)){
        fs.mkdirSync(destDir);
    }

    const filter = "-" + chaindIdKey + '.json';    
    var files = fs.readdirSync(ozDir).filter(fn => fn.endsWith(filter));
    for (let i = 0; i < files.length; i++) {
        const from = ozDir + "/" + files[i];
        const to = destDir + "/" + files[i];

        fs.copyFile(from, to, (err) => {
            if (err) throw err;
        });
        console.log("  Copying ", from, "->", to);
    }
}


function _dot(newline=false)
{
    process.stdout.write(".")
    if (newline) {
        process.stdout.write('\n');
    }
}

async function init(deployer) {
    const network = await ethers.provider.getNetwork();
    console.log();
    console.log("Network name:", network.name);
    console.log("Network chain id:", network.chainId);

    if (deployer === undefined) {
        [_deployer] = await ethers.getSigners();
    } else {
        _deployer = deployer
    }

    console.log("Deployment account:", _deployer.address);

    _gasCount = ethers.BigNumber.from(0);

    return _deployer;
}

function getGasSpent()
{
    return ethers.utils.formatEther(_gasCount);
}

function getSignerFromPrivKey(privateKey)
{
    if (privateKey == undefined) {
        throw 'Private key not set for signer.';
    }
    return new ethers.Wallet(privateKey, ethers.provider);
}

async function deploy(contractName, solPath, ...args)
{
    console.log("\nDeploying " + contractName + "...")
    _checkDeployer();
    _dot();
    
    const Contract = await ethers.getContractFactory(contractName, _deployer);
    _dot();
    
    const contract = await Contract.deploy(...args);
    _dot();
    
    await contract.deployed();
    _dot();

    const receipt = await contract.deployTransaction.wait();
    _dot();

    const gasPrice = 'effectiveGasPrice' in receipt?
        receipt.effectiveGasPrice :
        await ethers.provider.getGasPrice();
    _dot();
    
    const gas = receipt.gasUsed.mul(gasPrice);
    _dot(true);
    
    _gasCount = _gasCount.add(gas);
    console.log(" => address:",
                contract.address,
                "(gas: " + ethers.utils.formatEther(gas) + "eth)");

    await _updateContractJson(contractName, contract.address, solPath);

    return contract;
}

async function deployUpgradeable(contractName, solPath, ...args)
{
    console.log("\nDeploying Upgradeable " + contractName + " + Proxy...")
    _checkDeployer();
    _dot();

    const Contract = await ethers.getContractFactory(contractName, _deployer);
    _dot();

    const contract = await upgrades.deployProxy(Contract,
                                                args,
                                                { kind: 'uups' });
    _dot();
    
    const receipt = await contract.deployTransaction.wait();
    _dot();

    const gasPrice = 'effectiveGasPrice' in receipt ?
        receipt.effectiveGasPrice :
        await ethers.provider.getGasPrice();
    _dot();
    
    const gas = receipt.gasUsed.mul(gasPrice);
    _dot(true);
    
    _gasCount = _gasCount.add(gas);
    console.log(" => address:",
                contract.address,
                "(gas: " + ethers.utils.formatEther(gas) + "eth)");

    await _updateContractJson(contractName, contract.address, solPath);

    return contract;
}

async function upgrade(oldVersionRepoPath,
                       oldContractName,
                       newContractName,
                       solPath,
                       signer = undefined,
                       unsafeAllowRenames=false)
{
    console.log("\nLoading old contract " + oldContractName);
    if (!fs.existsSync(oldVersionRepoPath)) {
        throw "Old Version Repo Path does not exist:" + oldVersionRepoPath;
    }
    await _copyOpenZeppelinDirFromRepo(oldVersionRepoPath);

    oldAddr = await _getContractAddrFromABI(
        oldVersionRepoPath + "/abis", oldContractName);
    console.log("  Old contract addr: " + oldAddr);

    console.log("\nUpgrading  " + oldContractName + " -> " + newContractName);
    const Contract = await ethers.getContractFactory(newContractName, signer);
    _dot();

    const contract = await upgrades.upgradeProxy(
        oldAddr, Contract, { kind: 'uups',
                             unsafeAllowRenames: unsafeAllowRenames } );
    _dot();

    const receipt = await contract.deployTransaction.wait();
    _dot();

    const gasPrice = 'effectiveGasPrice' in receipt ?
        receipt.effectiveGasPrice :
        await ethers.provider.getGasPrice();
    _dot();
    
    const gas = receipt.gasUsed.mul(gasPrice);
    _dot(true);
    
    _gasCount = _gasCount.add(gas);
    console.log(" => address:",
                contract.address,
                "(gas: " + ethers.utils.formatEther(gas) + "eth)");

    await _updateContractJson(newContractName, contract.address, solPath);

    return contract;
}


async function getDeployed(contractName)
{
    const contractAddr = await _getContractAddrFromABI("abis/", contractName);
    if (!contractAddr) {
        return;
    }
    const Contract = await ethers.getContractFactory(contractName);
    return await Contract.attach(contractAddr);
}


function isEnvVarTrue(envVar) 
{
    const value = process.env[envVar];
    return (value !== undefined && (
                value === true ||
                value.toLowerCase() === 'true' ||
                parseInt(value) === 1) );
}

module.exports = {
    init,
    getGasSpent,
    getSignerFromPrivKey,
    deploy,
    deployUpgradeable,
    upgrade,
    getDeployed,
    isEnvVarTrue
}