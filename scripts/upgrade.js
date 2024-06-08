// Load the .env file
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
var dotenvConfig = dotenv.config()
dotenvExpand.expand(dotenvConfig)

const deployUtils = require("./deployUtils.js");

// XXX This is just and example of an upgrade script that tries to upgrade
// IceCube from a previous version. Not meant to be used in production.
async function main() {
    const deployer = await deployUtils.init();
    const holderAddr = process.env.HOLDER_PUBKEY;
    const admin = await deployUtils.getSignerFromPrivKey(
        process.env.ADMIN_PRIVKEY)

    const iceCube = await deployUtils.upgrade(
        process.env.OLD_VERSION_REPO_PATH,
        "IceCube", "IceCube", "tokens/IceCube.sol", admin, true);
    
    console.log(
        "\nSuccessfully Upgraded! (" + deployUtils.getGasSpent() + "eth)");
}
  
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });