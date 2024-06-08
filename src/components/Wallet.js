import React, { Component } from 'react'

// Connects to the Web3 wallet. Presents a button if not

class Wallet extends Component {

    constructor(props) {
        super(props);

        this.contracts = props.contracts;
        this.onConnected = props.onConnected;

        this.onConnectWallet = this.onConnectWallet.bind(this);
    }

    async onConnectWallet(event) {
        event.preventDefault();

        // Load Web3 and the smart contracts
        await this.contracts.initWeb3();
        await this.contracts.load();
        
        await this.onConnected();
    }

    render() {
        if (this.contracts.isConnected()) {
            return null;
        } else {
            return (
                <form onSubmit={this.onConnectWallet}>
                    <button className="App-button">
                        Connect&nbsp;Wallet
                    </button>
                </form>
            );
        }
    }
   
}

export default Wallet;
