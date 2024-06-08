import React, { Component } from 'react'

import '../css/App.css';

class SwapForm extends Component {

    constructor(props) {
        super(props);
        this.state = {
            amountToSwap : 0
        };

        this.contracts = props.contracts;
        this.setError = props.setError;
        
        this.coinFrom = props.coinFrom;
        this.coinTo = props.coinTo;
        this.slippage = props.slippage;
        this.delay = props.delay;
        
        this.onSetAmount = this.onSetAmount.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
    }

    async onSetAmount(event) {
        const amountToSwap = event.target.value;
        console.log("amountToSwap = ",amountToSwap)
        this.setState({amountToSwap : amountToSwap});

        try {

            var result = 0;
            if (this.coinFrom === "H2O" && this.coinTo === "ICE") {
                result = await this.contracts.previewSwapH2OForICE(amountToSwap);
            } else if (this.coinFrom === "ICE" && this.coinTo === "H2O") {
                result = await this.contracts.previewSwapICEForH2O(amountToSwap);
            }
            // Success:
            console.log("====", event.target.value,"->", result);
        } catch(error) {
            // Fail:
            console.log("==== FAIL!");

            console.error(error);
        }
    }

    async onSubmit(event) {
        event.preventDefault();

        if (!this.contracts.isConnected()) {
            this.setError("Not Connected!");
            return;
        }

        if (this.state.amountToSwap <= 0) {
            this.setError("Amount Has to be > 0!");
            return;
        }

        const amount = this.state.amountToSwap;


        //todo: this is defaulting to half hour
        const deltaTime = this.delay * 60;
        const deadline = Math.round(+new Date()/1000) + deltaTime;
        const iceCubeDate = new Date() + (365 * 1000 * 60 * 60 * 24);

        // todo request from form
        const maxSlippage = this.slippage * 0.01;

        console.log("Slippage: ", maxSlippage, "Deadline:", deadline);

        if (this.coinFrom === "H2O" && this.coinTo === "ICE") {
            const expected = await this.contracts.previewSwapH2OForICE(amount);
            const minAmount = expected / (1 + maxSlippage);
            await this.contracts.swapH2OForICE(amount, minAmount, deadline);
        } else if (this.coinFrom === "ICE" && this.coinTo === "H2O") {
            const expected = await this.contracts.previewSwapICEForH2O(amount);
            const minAmount = expected / (1 + maxSlippage);
            await this.contracts.swapICEForH2O(amount, minAmount, deadline);
        }  

        this.setState({amountToSwap : 0});
    }


    render() {
        var buttonText = "";
        
        if  (this.coinFrom === "H2O") {
            buttonText = "Buy " + this.coinTo;
        } else if (this.coinFrom === "ICE") {
            buttonText = "Sell " + this.coinFrom;
        }

        return (
            <div>
                <b>Swap {this.coinFrom} for {this.coinTo}</b>
                <form className="App-form" onSubmit={this.onSubmit}>
                    <input type="number" size="4" value={this.state.amountToSwap} onChange={this.onSetAmount} required className="swapNumberBox"/>
                    <br></br>
                    <button type="submit" className="swapButton">{buttonText}</button>
                </form>
            </div>
        );

    }
   
}

export default SwapForm;
