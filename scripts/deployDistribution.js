// Load the .env file
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
var dotenvConfig = dotenv.config()
dotenvExpand.expand(dotenvConfig)

const deployUtils = require("./deployUtils.js");

async function main() {
    await deployUtils.deploy("Distribution", "Distribution.sol");

    console.log("\nSuccessfully Deployed! (" + deployUtils.getGasSpent() + "eth)");
}
  
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
