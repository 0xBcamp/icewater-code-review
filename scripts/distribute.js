const distributeUtils = require("./distributeUtils.js");
const deployUtils = require("./deployUtils.js");
const hre = require("hardhat");

//todo get already deployed contracts in deployUtils


function getAllMethods(object) {
    return Object.getOwnPropertyNames(object).filter(function(property) {
        return typeof object[property] == 'function';
    });
}

async function main() {
    const deployer = deployUtils.getSignerFromPrivKey(process.env.DEPLOYER_PRIVKEY)
    console.log("Deploying with", deployer.address)
    if (deployer === undefined) {
        console.error("Getting DEPLOYER_PRIVKEY");
        return;
    }

    // Initialize
    await deployUtils.init(deployer);
    
    // Get signers for the holder and admin.
    const holderPrivKey = process.env.HOLDER_PRIVKEY;
    if (!holderPrivKey) {
        console.error("Set HOLDER_PRIVKEY!");
        return;
    }
    const holder = new ethers.Wallet(holderPrivKey).connect(ethers.provider);

    // Get Ice
    const ice = await deployUtils.getDeployed("IceToken");
    if (!ice) {
        throw("Ice deployment not found.")
    }

    // Get H2O
    const h2o = await  deployUtils.getDeployed("H2OToken");
    if (!h2o) {
        throw("H2O deployment not found.")
    }

    // Get or deploy the Distribution contract
    var distribution = await deployUtils.getDeployed("Distribution");
    if (!distribution) {
        // Get deployment signer.
        distribution = await deployUtils.deploy("Distribution", "Distribution.sol");
        console.log("done.")
    }

    console.log();
    console.log("Ice Contract:", ice.address);
    console.log("H2O Contract:", h2o.address);
    console.log("Distribution Contract:", distribution.address);
    console.log();

    // Distribute
    await distributeUtils.distribute(holder, ice, h2o, distribution);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });