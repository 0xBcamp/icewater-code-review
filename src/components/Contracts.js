import ControllerJson from '../abis/Controller.json'
import IceTokenJson from '../abis/IceToken.json'
import H2OTokenJson from '../abis/H2OToken.json'
import SteamTokenJson from '../abis/SteamToken.json'
import IceCubeJson from '../abis/IceCube.json'
import Web3 from 'web3'

var BN = Web3.utils.BN;

// Wraps the necessary H2O smart contracts.

class Contracts 
{
    constructor(setError) 
    {
        this.Controller = null;
        this.IceToken = null;
        this.H2OToken = null;
        this.SteamToken = null;
        this.IceCube = null;
        
        this.controllerAddress = null;
        this.account = null;

        this.setError = setError;
    }

    isConnected() {
        return this.Controller && this.IceToken && this.H2OToken && this.SteamToken && this.IceCube && this.account;
    }

    async initWeb3() {
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.enable();
        }
        else if (window.web3) {
            window.web3 = new Web3(window.web3.currentProvider);
        }
        else {
            this.setError('Non-Ethereum browser detected. You should consider trying MetaMask!');
            return false;
        }

        return true;
    }

    async load() {
        try {
            const web3 = window.web3;
            if (!web3) {
                //todo
                return;
            }
            
            const networkId = await web3.eth.net.getId();

            console.log(networkId);
            
            // Get the current account
            const accounts = await web3.eth.getAccounts();
            this.account = accounts[0];
        
            // Load the Controller contract
            const controllerData = ControllerJson.networks[networkId];
            if(controllerData) {
                this.Controller = new web3.eth.Contract(ControllerJson.abi, controllerData.address);
                this.controllerAddress = controllerData.address;
            } else {
                this.setError('Controller contract not deployed to this network.');
                return;
            }


            // Load the IceToken contract
            const iceTokenData = IceTokenJson.networks[networkId];
            if(iceTokenData) {
                this.IceToken = new web3.eth.Contract(IceTokenJson.abi, iceTokenData.address);
            } else {
                this.setError('IceToken contract not deployed to this network.');
                return;
            }

            // Load the H2OToken contract
            const h2oTokenData = H2OTokenJson.networks[networkId];
            if(h2oTokenData) {
                this.H2OToken = new web3.eth.Contract(H2OTokenJson.abi, h2oTokenData.address);
            } else {
                this.setError('H2OToken contract not deployed to this network.');
                return;
            }

            // Load the SteamToken contract
            const steamTokenData = SteamTokenJson.networks[networkId];
            if(steamTokenData) {
                this.SteamToken = new web3.eth.Contract(SteamTokenJson.abi, steamTokenData.address);
            } else {
                this.setError('SteamToken contract not deployed to this network.');
                return;
            }

            // Load the IceCube contract
            const iceCubeData = IceCubeJson.networks[networkId];
            if(iceTokenData) {
                this.IceCube = new web3.eth.Contract(IceCubeJson.abi, iceCubeData.address);
            } else {
                this.setError('IceCube contract not deployed to this network.');
                return;
            }
       
        } catch (err) {
            this.account = null;
            this.Controller = null;

            this.setError(err);
        }
    }

    registerSwapEventHandler(onSwapHandler) {
        // Subscribe to events
        this.Controller.events.Swap(
           { fromBlock: 'latest', filter: {account: this.account} },
           onSwapHandler);
   } 

    getShortAddress(addr) {
        if (!addr) {
            return addr;
        }
        return addr.slice(0, 8) + "..." + addr.slice(-4);
    }

    getAccountAddress() {
        return this.account;
    }

    getControllerAddress() {
        if (this.Controller && this.controllerAddress) {
            return this.controllerAddress;
        }

        return null;
    }

    async getMeltRate() {
        return Web3.utils.fromWei(
            await this.Controller.methods.annualMeltRate().call());
    }

    async getAverageICEPrice() {
        return Web3.utils.fromWei(
            await this.Controller.methods.getAverageICEPrice().call());
    }

    async getICETotalSupply() {
        return Web3.utils.fromWei(
            await this.IceToken.methods.totalSupply().call());
    }

    async getH2OTotalSupply() {
        return Web3.utils.fromWei(
            await this.H2OToken.methods.totalSupply().call());
    }

    async getSTMTotalSupply() {
        return Web3.utils.fromWei(
            await this.SteamToken.methods.totalSupply().call());
    }

    async getIceCubeTotalSupply() {
        return await this.IceCube.methods.totalSupply().call();
    }

    async getICEPrice() {
        return Web3.utils.fromWei(
            await this.Controller.methods.getICEPrice().call());
    }

    async getICEPoolICESize() {
        return Web3.utils.fromWei(
            await this.Controller.methods.getICEPoolICESize().call());
    }

    async getICEPoolH2OSize() {
        return Web3.utils.fromWei(
            await this.Controller.methods.getICEPoolH2OSize().call());
    }


    async getTargetH2OSupply() {
        return Web3.utils.fromWei(
            await this.Controller.methods.dTargetH2OSupply().call());
    }

    async getCubeRedemptionAmount(id) {
        return Web3.utils.fromWei(
            await this.Controller.methods.getCubeRedemptionAmount(id).call());
    }

    async getCubeRedemptionTime(id) {
        return Web3.utils.fromWei(
            await this.Controller.methods.getCubeRedemptionTime(id).call());
    }

    async claimableH2OFromICE() {
        return Web3.utils.fromWei(
            await this.Controller.methods.claimableH2OFromICE().call({ from: this.account }));
    }


    async claimH2OFromICE() {
        this.Controller.methods.claimRewards()
            .send({ from: this.account })
                .on('transactionHash', (hash) => {
                    console.log("claim melt")
                });
    }


    async getICEBalance(account) {
        return Web3.utils.fromWei(
            await this.IceToken.methods.balanceOf(account).call());
    }

    async getH2OBalance(account) {
        return Web3.utils.fromWei(
            await this.H2OToken.methods.balanceOf(account).call());
    }

    async getSTMBalance(account) {
        return Web3.utils.fromWei(
            await this.SteamToken.methods.balanceOf(account).call());
    }

    async getOwnedIceCubes(account) {
        const balance = await this.IceCube.methods.balanceOf(account).call();
        var cubeIds = [];

        console.log(" Balance of ", account, ":", balance);

        for (let i = 0; i < balance; i++) {
            cubeIds[i] = await this.IceCube.methods.tokenOfOwnerByIndex(account, i).call();
        }
        
        return cubeIds;
    }

    async previewSwapICEForH2O(amount) {
        const weiAmount = Web3.utils.toWei(amount);
        const result = await this.Controller.methods.previewSwapICEForH2O(weiAmount).call();
        return Web3.utils.fromWei(result);
    }

    async swapICEForH2O(amount, minH2OAmount, deadline) {
        this.Controller.methods.swapICEForH2O(
                Web3.utils.toWei(new BN(amount)),
                Web3.utils.toWei(new BN(minH2OAmount)),
                new BN(deadline))

            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Swapped ICE->H2O:", amount.toString())
                });
    }

    async previewSwapH2OForICE(amount) {
        const weiAmount = Web3.utils.toWei(amount);
        const result = await this.Controller.methods.previewSwapH2OForICE(weiAmount).call();
        return Web3.utils.fromWei(result);
    }

    async swapH2OForICE(amount, minICEAmount, deadline) {
        this.Controller.methods.swapH2OForICE(
                Web3.utils.toWei(new BN(amount)),
                Web3.utils.toWei(new BN(minICEAmount)),
                new BN(deadline))
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Swapped H2O->ICE:", amount.toString())
                });
    }

    async mintIceCube(amount, account, endTime) {
        console.log("Minting IceCubes: ",amount, " TO: ", account," For Time: ",endTime);
        const t = 1671232873127;
        this.Controller.methods.mintIceCube(
                Web3.utils.toWei(new BN(amount)),this.account,t)
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Swapped H2O->CUBE:", amount.toString())
                });
    }

    async redeemIceCube(id) {
        this.Controller.methods.redeemIceCube(id)
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Swapped CUBE->H2O:", id.toString())
                });
    }

    async getCubeAmount(id) {
        return Web3.utils.fromWei(
            await this.IceCube.methods.getAmount(id).call());
    }

    async getCubeStartTime(id) {
        return
           await this.IceCube.methods.getStartTime(id).call();
    }

    async getCubeEndTime(id) {
        return
           await this.IceCube.methods.getEndTime(id).call();
    }

    async initiatePostitiveAuction(bid) {
        console.log("Initiating positive auction for: ",bid);
        this.Controller.methods.initiatePositiveAuction()
            .send({ from: this.account, value: Web3.utils.toWei(new BN(bid)) })
                .on('transactionHash', (hash) => { 
                    console.log("Initiated Positive Auction:", bid.toString())
                });
    }

    async makePostitiveAuctionBid(bid) {
        console.log("Initiating positive auction for: ",bid);
        this.Controller.methods.makePositiveAuctionBid()
            .send({ from: this.account, value: Web3.utils.toWei(new BN(bid)) })
                .on('transactionHash', (hash) => { 
                    console.log("Initiated Positive Auction:", bid.toString())
                });
    }

    async terminatePostitiveAuction() {
        console.log("Terminating positive auction ");
        this.Controller.methods.terminatePositiveAuction()
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Terminated Positive Auction:")
                });
    }

    async initiateNegativeAuction(bid) {
        console.log("Initiating positive auction for: ",bid);
        this.Controller.methods.initiateNegativeAuction(Web3.utils.toWei(new BN(bid)))
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Initiated Negative Auction:", bid.toString())
                });
    }

    async makeNegativeAuctionBid (bid) {

        this.Controller.methods.makeNegativeAuctionBid(Web3.utils.toWei(new BN(bid)))
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Made Negative Auction Bid:", bid.toString())
                });

    }

    async terminateNegativeAuction() {
        console.log("Terminating negative auction ");
        this.Controller.methods.terminateNegativeAuction()
            .send({ from: this.account })
                .on('transactionHash', (hash) => { 
                    console.log("Terminated Positive Auction:")
                });
    }

    async getLeadingBidder() {
        return 
            await this.Controller.methods.leadingBidder().call();
    }

    async getLeadingBid() {
        return Web3.utils.fromWei(
            await this.Controller.methods.dLeadingBid().call());
    }

    async isPositiveAuctionActive() {
        //console.log ("Checking Positive Auction");
        return await this.Controller.methods.isPositiveAuctionActive().call();
    }

    async isNegativeAuctionActive() {
        return 
            await this.Controller.methods.isNegativeAuctionActive().call();
    }

    async auctionH2OAmount() {
        return Web3.utils.fromWei(
            await this.Controller.methods.dAuctionH2OAmount ().call());

    }

    async iLastAuctionTime() {
        return
            await this.Controller.methods.iLastAuctionTime().call();

    }

  
}

export default Contracts;