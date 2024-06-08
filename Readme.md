

## Setup

    npm install

## Compile

 -    `npx hardhat compile`

## Local Deploy / Run Ugly UI

### Ganache
 - Launch Ganache
 - On the first time this is launched:
     - Change the Network ID to 1337 (Gear Icon -> Server -> Network ID)
	 - Copy one of the Ganache default accounts' private key
	 - Add a new account to Metamask via Import Account with this key
	 - Now copy the public key
	 - Copy the `.env.example` into `.env`
	 - In the .env file add this public key to the `ADMIN_PUBKEY` and `HOLDER_PUBKEY` variables. (This will be used as the admin account and the account that will receive the initial supply of the tokens during deploy.)
	 - Add this network to Metamask:
		 - Network Name: `Ganache Local`
		 - New RPC URL: `http://localhost:7545`
		 - Chain ID: `1337`
		 - Currency Symbol: `ETH`
 - `npx hardhat run scripts/deploy.js --network ganache`
 or:    
 - `npm run deployGanache`
 - Launch the ugly UI: `npm start`
	 - Make sure Metamask network is  `Ganache Local`
	 - And the account is the one added above

### Hardhat Network
 - In one terminal launch Hardhat Network:  `npx hardhat node`
 - On the first time this is launched: 
	 - Copy one of the private keys printed at start
	 - Add a new account to Metamask via Import Account with this key
	 - Now copy the public key
	 - Copy the `.env.example` into `.env`
	 - In the .env file add this public key to the `ADMIN_PUBKEY` and `HOLDER_PUBKEY` variables. (This will be used as the admin account and the account that will receive the initial supply of the tokens during deploy.)
	 - Add this network to Metamask:
		 - Network Name: `Hardhat Local`
		 - New RPC URL: `http://localhost:8545`
		 - Chain ID: `31337`
		 - Currency Symbol: `ETH`
 - In another terminal:
 - `npx hardhat run scripts/deploy.js --network localhost`
 or
 - `npm run deployLocal`
 - Launch the ugly UI: `npm start`
     - Make sure Metamask network is  `Hardhat Local`
     - And the account is the one added above
     - Unlike Ganache, Hardhat does not keep the state between sessions. This means that Metamask will probably get a "nonce to high" error when running a transaction - Metamask continues to increment the nonce for this account, but because the state was reset, the nonce should also 
