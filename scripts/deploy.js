// Load the .env file
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
var dotenvConfig = dotenv.config()
dotenvExpand.expand(dotenvConfig)

const deployUtils = require("./deployUtils.js");
const distributeUtils = require("./distributeUtils.js");

async function main() {
    // Get deployment signer.
    const deployer = deployUtils.getSignerFromPrivKey(process.env.DEPLOYER_PRIVKEY)
    console.log("Deploying with", deployer.address)
    if (deployer === undefined) {
        console.error("Getting DEPLOYER_PRIVKEY");
        return;
    }

    // Get Holder and Admin addresses
    const holderAddr = process.env.HOLDER_PUBKEY;
    if (!holderAddr) {
        console.error("Getting HOLDER_PUBKEY");
        return;
    }

    const adminAddr = process.env.ADMIN_PUBKEY;
    if (!adminAddr) {
        console.error("Getting ADMIN_PUBKEY");
        return;
    }
    
    // Initialize
    await deployUtils.init(deployer);
    
    // Deploy Controller before the tokens so that they can set the controller
    // as one of their admins.
    const controller = await deployUtils.deployUpgradeable("Controller", "Controller.sol");

    // The admin accounts of the tokens
    const admins = [adminAddr, controller.address]

    // Deploy IceToken
    const ice = await deployUtils.deployUpgradeable("IceToken", "tokens/IceToken.sol", admins, holderAddr);

    // Deploy H2OToken
    const h2o = await deployUtils.deployUpgradeable("H2OToken", "tokens/H2OToken.sol", admins, holderAddr);

    // Deploy IceCube
    const iceCube = await deployUtils.deployUpgradeable("IceCube", "tokens/IceCube.sol", admins);

    // Deploy SteamToken
    //const stm = await deployUtils.deployUpgradeable("SteamToken", "tokens/SteamToken.sol", admins, holderAddr);

    // Deploy Ice/H2O pool.
    const icePool = await deployUtils.deployUpgradeable("H2OIceVirtualPool", "H2OIceVirtualPool.sol", h2o.address, ice.address, controller.address);
    
    // Set the tokens in the Controller.
    {
        console.log("\nSetting Tokens in Controller.");
        const transaction = await controller.setTokens(ice.address, h2o.address, iceCube.address, icePool.address);
        const transactionReceipt = await transaction.wait();
        if (transactionReceipt.status !== 1) {
            throw('Error in transaction when calling controller.setTokens()');
        }
        console.log("  Done.");
    }

    // Ignore the auction termination period if IGNORE_AUCTION_PERIOD is set.
    if (deployUtils.isEnvVarTrue("IGNORE_AUCTION_PERIOD")) {
        console.log("\n == Ignoring Auction Period == ");
        await controller.setIgnoreAuctionPeriod(true);
    }

    // Set the owner
    {
        console.log("\nSetting Owner/Admin in Controller.");
        const transaction = await controller.transferOwnership(adminAddr);
        const transactionReceipt = await transaction.wait();
        if (transactionReceipt.status !== 1) {
            throw('Error in transaction when calling controller.transferOwnership()');
        }
        console.log("  Done.");
    }    

    // Deploy the Distribution contract and run the distribution.
    if (deployUtils.isEnvVarTrue("RUN_DISTRIBUTION")) {
        const holder = deployUtils.getSignerFromPrivKey(process.env.HOLDER_PRIVKEY)

        // The holder needs some eth in order to approve transfers.
        if (await ethers.provider.getBalance(holder.address) == 0) {
            console.error("Holder needs eth balance to run distribution!");
        } else {
            const distribution = await deployUtils.deploy("Distribution", "Distribution.sol");
            await distributeUtils.distribute(holder, ice, h2o, distribution);
        }
    }

    console.log("\nSuccessfully Deployed! (" + deployUtils.getGasSpent() + "eth)");
}
  
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
