The files for the ugly UI are found at \src\components:

App.js – This is the main file. It includes the HTML in the “return” function at the end.

The constructor function of App.js initializes a state object (this.state) that includes attributes corresponding to various pieces of information that are used in the app.

The updateState() function updates the attributes of this.state when the app needs an update.

Contract.js – This file serves as an interface between the contract and the app. The app (i.e., App.js) will call a function defined in contract.js, and that function will call a contract function. 

SwapForm – This file creates a SwapForm component for swapping tokens (i.e., H2O and ICE)

Wallet.js – This file contains code for connecting to a wallet. You probably won’t need to play with this file much.

So, if you want to create a new element to display information from the contract, perform the following steps:

***** 1. Create a new attribute in this.state in App.js:

this.state.icePrice

***** 2. Create a UI element in the return function of App.js that refers to the new attribute:

<tr>
    <td className="poolsRow"><b>ICE Price:</b></td>
    <td>{this.state.icePrice}</td>
</tr>

***** 3. Create a function in Contract.js that grabs the information from the controller contract

async getICEPrice() {
    return Web3.utils.fromWei(
       await this.Controller.methods.getICEPrice().call());
}

***** 4. Add code to update this.state in App.js:

async updateState() {
    if (this.contracts.isConnected()) {
        this.setState({
        	...
            icePrice:     await this.contracts.getICEPrice(),
            ...
        });
    } ...
}