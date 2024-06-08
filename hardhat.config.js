require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require('@openzeppelin/hardhat-upgrades');
require('solidity-coverage');
require('hardhat-storage-layout');


// Load the .env file
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
var dotenvConfig = dotenv.config()
dotenvExpand.expand(dotenvConfig)
module.exports = {
    
    networks: {
    
        hardhat: {
        },
    
        ganache: {
            url: "http://localhost:7545",
            chainId: 1337
        },
        
        goerli: {
            url: "https://goerli.infura.io/v3/ca7f238b94074f9286655058d6fdb191",
            chainId: 5,
            accounts: [process.env.DEPLOYER_PRIVKEY]
        },

        optimism: {
            url: "https://opt-mainnet.g.alchemy.com/v2/1Vfjge6hDCMNtco65opLagDKkhXmTBmu",
            chainId: 10,
            accounts: [process.env.DEPLOYER_PRIVKEY]
        },

        optgoerli: {
            url: "https://goerli.optimism.io",
            chainId: 420,
            accounts: [process.env.DEPLOYER_PRIVKEY]
        }

        /*
        mainnet: {
            url: "https://mainnet.infura.io/v3/ef0e5accf1ae493697f3ed53325b4c25",
            chainId: 1,
            accounts: [process.env.DEPLOYER_PRIVKEY_MAINNET]
        },

        rinkeby: {
            url: process.env.ETH_NODE_URL_RINKEBY,
            chainId: 4,
            accounts: [process.env.DEPLOYER_PRIVKEY_RINKEBY]
        },


        kovan: {
            url: "https://kovan.infura.io/v3/ef0e5accf1ae493697f3ed53325b4c25",
            chainId: 42,
            accounts: [process.env.DEPLOYER_PRIVKEY_KOVAN]
        },
      

        optkovan: {
            url: "https://kovan.optimism.io",
            chainId: 69,
            accounts: [process.env.DEPLOYER_PRIVKEY_OPT_KOVAN]
        },

        polygon: {
            url: process.env.ETH_NODE_URL_POLYGON,
            chainId: 137,
            accounts: [process.env.DEPLOYER_PRIVKEY_POLYGON]
        },

        mumbai: {
            url: process.env.ETH_NODE_URL_MUMBAI,
            chainId: 80001,
            accounts: [process.env.DEPLOYER_PRIVKEY_MUMBAI]
        }     
         */
        
    },

    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
    },

    solidity: {
        version: "0.8.4",
        settings: {
            optimizer: {
                enabled: true,
                runs: 800,
            },
        },
    },
    
};

