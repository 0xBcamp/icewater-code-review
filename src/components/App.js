import React, { Component } from 'react'
import SwapForm from './SwapForm'
import Contracts from './Contracts'

import '../css/App.css';

// Main <App> component.
//Tod0 - Add IceCubes, Convert Icecube Time to Seconds, 

class App extends Component {

    constructor(props) {
        super(props);
        
        this.state = {
            isConnected: false,
            errorMessage: null,
            iceBalance:   0,
            h2oBalance:   0,
            stmBalance:   0,
            //h2oPrice:     0,
            icePrice:     0,
            averageIcePrice: 0,
            icePool_ICESize:  0,
            icePool_H2OSize: 0,
            claimableH2OFromICE:  0,
            slippage: 2.0,
            swapDelay: 30,
            activePositiveAuction: false,
            activeNegativeAuction: false,
            auctionH2OAmount: 0,
            leadingBid: 0,
            leadingBidder: '',
            iLastAuctionTime: 0,
            positiveAuctionBid: 0,
            negativeAuctionBid: 0,
            icecubesToMint: 0,
            icecubeRedemptionDate: '2022-12-12',
            icecubeRecipient: '',
            icecubeRedeemID: 0


        };

        this.connectWallet = this.connectWallet.bind(this);
        this.onSwap = this.onSwap.bind(this);
        this.onSetSlippage = this.onSetSlippage.bind(this);
        this.onSetSwapDelay = this.onSetSwapDelay.bind(this);
        this.onSetPositiveAuctionBid = this.onSetPositiveAuctionBid.bind(this);
        this.onSetNegativeAuctionBid = this.onSetNegativeAuctionBid.bind(this);
        this.onInitiatePositiveAuction = this.onInitiatePositiveAuction.bind(this);
        this.onInitiateNegativeAuction = this.onInitiateNegativeAuction.bind(this);
        this.onSetIcecubesToMint = this.onSetIcecubesToMint.bind(this);
        this.onSetIcecubeRedemptionDate = this.onSetIcecubeRedemptionDate.bind(this);
        this.onSetIcecubeRecipient = this.onSetIcecubeRecipient.bind(this);
        this.onSetIceCubeRedeemId = this.onSetIceCubeRedeemId.bind(this);
        this.onMintIceCube = this.onMintIceCube.bind(this);
        this.onRedeemIceCube = this.onRedeemIceCube.bind(this);
        this.onClaimICE = this.onClaimICE.bind(this);
        this.setError = this.setError.bind(this);

        // Init the contracts
        this.contracts = new Contracts(this.setError);
    }

    async connectWallet(event) {
        event.preventDefault();

        // Load Web3 and the smart contracts
        if(await this.contracts.initWeb3()) {
            await this.contracts.load();
        }

        this.setState({ isConnected: this.contracts.isConnected() });
       
        if (this.contracts.isConnected()) {
            this.setState({ errorMessage: null });
            this.contracts.registerSwapEventHandler(this.onSwap);
        }        
        
        await this.updateState();
    }

    async onSwap(error, event) {
        if (error) {
            console.log(error);
            this.setError("While subscribing to event");
        } else {

            await this.updateState();
        }        
    }

    async onSetSlippage(event) {
        this.setState({slippage : event.target.value});
    } 

    async onSetSwapDelay(event) {
        this.setState({swapDelay : event.target.value}); 
    }   


    async onSetPositiveAuctionBid(event) {
        this.setState({positiveAuctionBid : event.target.value});
    }    

    async onSetNegativeAuctionBid(event) {
        this.setState({negativeAuctionBid : event.target.value});
    }  

    async onClaimICE(event) {
        event.preventDefault();
        await this.contracts.claimH2OFromICE();
        await this.updateState();
    }

    async onInitiatePositiveAuction(event) {
        event.preventDefault();
        await this.contracts.initiatePostitiveAuction(this.state.positiveAuctionBid);
        await this.updateState();
    }

    async onMakePositiveAuctionBid(event) {
        event.preventDefault();
        await this.contracts.makePostitiveAuctionBid(this.state.positiveAuctionBid);
        await this.updateState();
    }

    async onTerminatePositiveAuction(event) {
        event.preventDefault();
        await this.contracts.terminatePostitiveAuction();
        await this.updateState();
    }

    async onInitiateNegativeAuction(event) {
        event.preventDefault();
        await this.contracts.initiateNegativeAuction(this.state.negativeAuctionBid);
        await this.updateState();
    }

    async onMakeNegativeAuctionBid(event) {
        event.preventDefault();
        await this.contracts.makeNegativeAuctionBid(this.state.negativeAuctionBid);
        await this.updateState();
    }

    async onTerminateNegativeAuction(event) {
        event.preventDefault();
        await this.contracts.terminateNegativeAuction();
        await this.updateState();
    }

    async onMintIceCube(event) {
        event.preventDefault();
        const d = new Date(this.icecubeRedemptionDate);
        const time = d.getTime();
        //console.log("Calling Mint Function: ",this.state.icecubesToMint, " TO: ",this.state.icecubeRecipient," For Date: ",this.state.icecubeRedemptionDate);
        await this.contracts.mintIceCube(this.state.icecubesToMint,this.state.icecubeRecipient,this.state.icecubeRedemptionDate);
        await this.updateState();
    }

    async onRedeemIceCube(event) {
        event.preventDefault();
        await this.contracts.redeemIceCube(this.state.icecubeRedeemID);
        await this.updateState();
    }

    async onSetIcecubesToMint(event) {
        this.setState({icecubesToMint : event.target.value}); 
    }

    async onSetIcecubeRedemptionDate(event) {
        this.setState({icecubeRedemptionDate : event.target.value}); 
    }

    async onSetIcecubeRecipient(event) {
        this.setState({icecubeRecipient : event.target.value}); 
    }
    

    async onSetIceCubeRedeemId(event) {
        this.setState({icecubeRedeemID : event.target.value}); 
    }

    setError(message) {
        this.setState({ errorMessage: message });
    }

    async updateState() {
        if (this.contracts.isConnected()) {

            this.setState({
                iceBalance:   await this.contracts.getICEBalance(this.contracts.getAccountAddress()),
                h2oBalance:   await this.contracts.getH2OBalance(this.contracts.getAccountAddress()),
                stmBalance:   await this.contracts.getSTMBalance(this.contracts.getAccountAddress()),
                icePrice:     await this.contracts.getICEPrice(),
                meltRate: await this.contracts.getMeltRate(),
                averageIcePrice: await this.contracts.getAverageICEPrice(),
                icePool_ICESize:  await this.contracts.getICEPoolICESize(),
                icePool_H2OSize: await this.contracts.getICEPoolH2OSize(),
                claimableH2OFromICE:  await this.contracts.claimableH2OFromICE(),
                activePositiveAuction: await this.contracts.isPositiveAuctionActive(),
                activeNegativeAuction: await this.contracts.isNegativeAuctionActive(),
                auctionH2OAmount: await this.contracts.auctionH2OAmount(),
                iLastAuctionTime: await this.contracts.iLastAuctionTime(),
                leadingBid: await this.contracts.getLeadingBid()

                
    
            });
            console.log(this.state.isPositiveAuctionActive);

        } else {
            this.setState({
                iceBalance:   0,
                h2oBalance:   0,
                stmBalance:   0, 
            });
        }
    }

    async printOwnedIceCubes() {
        const accountAddress = this.contracts.getAccountAddress();
        const cubeIds = await this.contracts.getOwnedIceCubes(accountAddress);
        console.log("ICE CUBES:", cubeIds);

        const targetH2OSupply = await this.contracts.getTargetH2OSupply();
        console.log("Target H2O Supply:", targetH2OSupply);
        
        console.log("Positive Auction Active:", this.state.activePositiveAuction);
        
        console.log("H2O Auction:", this.state.auctionH2OAmount);

        const bidder = await this.contracts.getLeadingBidder();
        console.log("Leading Bidder:", bidder);

        console.log("Leading Bid:", this.state.leadingBid);

        const auctionTime = await this.contracts.getLeadingBidder();
        console.log("Auction Time:", auctionTime);

        /*
        const cubeAmount = await this.contracts.getCubeAmount(1);
        console.log("Cube Amount:", cubeAmount);
        const cubeStartTime = await this.contracts.getCubeStartTime(1);
        console.log("Cube Start Time:", cubeStartTime);
        const cubeEndTime = await this.contracts.getCubeEndTime(1);
        console.log("Cube End Time:", cubeEndTime);
        */
    }

    render() {

        var header;

        // Info about Account and Contract
        if (this.contracts.isConnected()) {
            const accountAddress = this.contracts.getAccountAddress();
            const controllerAddress = this.contracts.getControllerAddress();

            header = <div>
                <div><b>Account:</b> {accountAddress}</div>
                <div><b>Contract:</b> {controllerAddress}</div>
            </div>

            this.printOwnedIceCubes();

        } else {
            header = <div>
                <form onSubmit={this.connectWallet}>
                    <button className="connectButton">Connect&nbsp;Wallet</button>
                </form>
                <div><h3>Not Connected...</h3></div>
            </div>
        }




        // Error Messages
        var error;
        if (this.state.errorMessage) {
            error = <div><h3 className="errorText"><i>Error: {this.state.errorMessage}</i></h3></div>
        }
        
        return (
            <div align="center">               
                <div>
                    <table className='mainTable'>
                        <thead className='mainTableHead'>
                        <tr>
                            <td colSpan="2"> 
                                {header}
                                {error}
                            </td>
                        </tr>    
                        </thead>
                        
                        <tbody>
            
                        <tr>
                            <td className='swapTableCell'>
                                <SwapForm coinFrom="H2O" coinTo="ICE" slippage={this.state.slippage} delay={this.state.swapDelay} contracts={this.contracts} setError={this.setError}/>
                                <SwapForm coinFrom="ICE" coinTo="H2O" slippage={this.state.slippage} delay={this.state.swapDelay} contracts={this.contracts} setError={this.setError}/>
                            </td>

                        </tr>

                        
                        <tr>
                            <td className='swapTableCell'>
                                <div>
                                    <b>Max Slippage (%):</b><br></br>
                                    <form>
                                        <input type="number" size="3" value={this.state.slippage} onChange={this.onSetSlippage} required/>
                                    </form>
                                </div>
                            </td>
                            <td className='swapTableCell'>
                                <div>
                                    <b>Max Delay (mins):</b><br></br>
                                    <input type="number" size="3" value={this.state.swapDelay} onChange={this.onSetSwapDelay} required/>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td colSpan="2"><h3>Ice Cubes Issued:</h3></td>
                        </tr>
                        <tr>
                            <table colSpan="2" border ="10">
                                <tr>
                                    <td>Id</td>
                                    <td>Amount</td>
                                    <td>End Time</td>
                                    <td>Time Remaining</td>
                                    <td>Redeem</td>
                                </tr>
                                <tr>
                                    <td>1</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Redeem&nbsp;Ice&nbsp;Cube</button>
                                        </form>
                                    </td>
                                </tr>
                                <tr>
                                    <td>2</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Redeem&nbsp;Ice&nbsp;Cube</button>
                                        </form>
                                    </td>
                                </tr>
                                <tr>
                                    <td>3</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Redeem&nbsp;Ice&nbsp;Cube</button>
                                        </form>
                                    </td>
                                </tr>
                                <tr>
                                    <td>4</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Redeem&nbsp;Ice&nbsp;Cube</button>
                                        </form>
                                    </td>
                                </tr>
                            </table>

                        </tr>

                        <tr>
                            <td colSpan="2"><h3>Ice Cube Rewards:</h3></td>
                        </tr>

                        <tr>
                            <table colSpan="2" border ="10">
                                <tr>
                                    <td>Id</td>
                                    <td>Amount (Ice)</td>
                                    <td>End Time</td>
                                    <td>Time Remaining</td>
                                    <td>Claim H2O Rewards</td>
                                </tr>
                                <tr>
                                    <td>1</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Claim</button>
                                        </form>
                                    </td>
                                </tr>
                                <tr>
                                    <td>2</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Claim</button>
                                        </form>
                                    </td>
                                </tr>
                                <tr>
                                    <td>3</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Claim</button>
                                        </form>
                                    </td>
                                </tr>
                                <tr>
                                    <td>4</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <form onSubmit={this.onRedeemIceCube}>
                                        <button type="submit" className="swapButton">Claim</button>
                                        </form>
                                    </td>
                                </tr>
                            </table>
                        </tr>

                        <tr><td colSpan="2"><h3>Mint Ice Cubes:</h3></td></tr>

                        <tr>
                            <td>
                                <form onSubmit={this.onMintIceCube}>
                                    <button type="submit" className="swapButton">Mint&nbsp;Ice&nbsp;Cube</button>
                                </form>
                            </td>
                            <td>        
                                <div>
                                    <b>Ice to Lock Up: </b>
                                    <input type="number" size="3" value={this.state.icecubesToMint} onChange={this.onSetIcecubesToMint} required/>
                                </div>
                                <div>
                                    <b>Date to be able to redeem Ice Cubes: </b>
                                    <input type="date" size="3" value={this.state.icecubeRedemptionDate} onChange={this.onSetIcecubeRedemptionDate} required/>
                                </div>
                                <div>
                                    <b>Address of Icecube Recipient: </b>
                                    <input type="string" size="3" value={this.state.icecubeRecipient} onChange={this.onSetIcecubeRecipient} required/>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>
                                <form onSubmit={this.onRedeemIceCube}>
                                    <button type="submit" className="swapButton">Redeem&nbsp;Ice&nbsp;Cube</button>
                                </form>
                            </td>
                            <td>        
                                <div>
                                    <b>Icecube ID: </b>
                                    <input type="number" size="3" value={this.state.icecubeRedeemID} onChange={this.onSetIceCubeRedeemId} required/>
                                </div>
                            </td>
                        </tr>

                        <tr><td colSpan="2"><h3>Positive Auction (Pay eth to mint H2O):</h3></td></tr>

                        
                        <tr>
                            <td className="poolsRow"><b>Current Positive Auction:</b></td>
                            <td>{this.state.activePositiveAuction}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Last Auction Time:</b></td>
                            <td>{this.state.iLastAuctionTime}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Auction H2O Amount:</b></td>
                            <td>{this.state.auctionH2OAmount}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Leading Bid:</b></td>
                            <td>{this.state.leadingBid}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Leading Bidder:</b></td>
                            <td>{this.state.leadingBidder}</td>
                        </tr>

                        <tr>
                            <td>
                                <form onSubmit={this.onInitiatePositiveAuction}>
                                    <button type="submit" className="swapButton">Initiate&nbsp;Positive&nbsp;Auction</button>
                                </form>
                            </td>
                            <td>        
                                <div>
                                    <input type="number" size="3" value={this.state.positiveAuctionBid} onChange={this.onSetPositiveAuctionBid} required/>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <form onSubmit={this.onMakePositiveAuctionBid}>
                                    <button type="submit" className="swapButton">Make&nbsp;Positive&nbsp;Auction&nbsp;Bid</button>
                                </form>
                            </td>
                            <td>        
                                <div>
                                    <input type="number" size="3" value={this.state.positiveAuctionBid} onChange={this.onSetPositiveAuctionBid} required/>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <form onSubmit={this.onTerminatePositiveAuction}>
                                    <button type="submit" className="swapButton">Terminate&nbsp;Positive&nbsp;Auction</button>
                                </form>
                            </td>
                        </tr>


                        <tr><td colSpan="2"><h3>Negative Auction (Burn H2O to get eth):</h3></td></tr>

                        <tr>
                            <td className="poolsRow"><b>Current Negative Auction:</b></td>
                            <td>{this.state.negativePositiveAuction}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Last Auction Time:</b></td>
                            <td>{this.state.iLastAuctionTime}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Auction H2O Amount:</b></td>
                            <td>{this.state.auctionH2OAmount}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Leading Bid:</b></td>
                            <td>{this.state.leadingBid}</td>
                        </tr>
                        <tr>
                            <td className="poolsRow"><b>Leading Bidder:</b></td>
                            <td>{this.state.leadingBidder}</td>
                        </tr>

                        <tr>
                            <td>
                                <form onSubmit={this.onInitiateNegativeAuction}>
                                    <button type="submit" className="swapButton">Initiate&nbsp;Negative&nbsp;Auction</button>
                                </form>
                            </td>
                            <td>        
                                <div>
                                    <input type="number" size="3" value={this.state.negativeAuctionBid} onChange={this.onSetNegativeAuctionBid} required/>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <form onSubmit={this.onMakeNegativeAuctionBid}>
                                    <button type="submit" className="swapButton">Make&nbsp;Negative&nbsp;Auction&nbsp;Bid</button>
                                </form>
                            </td>
                            <td>        
                                <div>
                                    <input type="number" size="3" value={this.state.negativeAuctionBid} onChange={this.onSetNegativeAuctionBid} required/>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <form onSubmit={this.onTerminateNegativeAuction}>
                                    <button type="submit" className="swapButton">Terminate&nbsp;Negative&nbsp;Auction</button>
                                </form>
                            </td>
                        </tr>


                        <tr><td colSpan="2"><h3>Claim Rewards:</h3></td></tr>

                        <tr>
                            <td>
                                <form onSubmit={this.onClaimICE}>
                                    <button type="submit" className="swapButton">Claim&nbsp;H2O&nbsp;From&nbsp;ICE</button>
                                </form>
                            </td>
                        </tr>

                        


                        <tr>
                            <td className="poolsRow"><b>H2O Price:</b></td>
                            <td>{this.state.h2oPrice}</td>
                        </tr>

                        <tr><td colSpan="2"><h3>Ice Parameters:</h3></td></tr>

                        <tr>
                            <td className="poolsRow"><b>Claimable H2O from ICE:</b></td>
                            <td>{this.state.claimableH2OFromICE}</td>
                        </tr>

                        <tr>
                            <td className="poolsRow"><b>ICE Melt Rate:</b></td>
                            <td>{this.state.meltRate}</td>
                        </tr>

                        <tr>
                            <td className="poolsRow"><b>Average ICE Price:</b></td>
                            <td>{this.state.averageIcePrice}</td>
                        </tr>

                        <tr>
                            <td className="poolsRow"><b>ICE Price:</b></td>
                            <td>{this.state.icePrice}</td>
                        </tr>

                        <tr>
                            <td className="poolsRow"><b>ICE Yield:</b></td>
                            <td>{this.state.meltRate*100/this.state.icePrice}%</td>
                        </tr>


                        <tr><td colSpan="2"><h3>Account Balances:</h3></td></tr>
                        <tr>
                            <td className="balancesRow"><b>H2O:</b></td>
                            <td>{this.state.h2oBalance}</td>
                        </tr>
                        <tr>
                            <td className="balancesRow"><b>ICE:</b></td>
                            <td>{this.state.iceBalance}</td>
                        </tr>
                        <tr>
                            <td className="balancesRow"><b>STEAM:</b></td>
                            <td>{this.state.stmBalance}</td>
                        </tr>

                        <tr><td colSpan="2"><h3>Pools:</h3></td></tr>

                        <tr>
                            <td className="balancesRow"><b>Ice Pool: ICE:</b></td>
                            <td>{this.state.icePool_ICESize}</td>
                        </tr>

                        <tr>
                            <td className="balancesRow"><b>Ice Pool: H2O:</b></td>
                            <td>{this.state.icePool_H2OSize}</td>
                        </tr>


                        </tbody>
                    </table>
                </div>        
                <br></br>
            </div>  
        );
    }

}

export default App;
