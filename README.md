# Airdao node contracts

Smart contracts used in Airdao.  
+Javascript SDK, that can be imported for convenient communication with deployed contracts.

## Contracts documentation
Can be found [here](https://github.com/ambrosus/local-network-test/blob/2a04f429e71a0bde97944755eb3b51cca1202ca3/docs/CONTRACTS.md)


## Development

Run `npm run test` or `npm run coverage` to test contacts;

Run `npm run sourcify:test` or `npm run sourcify:main` to verify deployed contracts;

Run `make run` in `amb-node-cluster` folder to launch local amb network in your docker;

### Deployment

Provide your private key as `PRIVATEKEY_OWNER_AMB` env var or put it in `.env` file.

Run `npx hardhat run ./scripts/deploy_multisig.ts --network test` to deploy masterMultisig contract in testnet
network;  
Run `npx hardhat run ./scripts/deploy_finance.ts --network main` to deploy finance contracts (with their multisigs)
in mainnet network;  
_And so on..._

## SDK

#### Installing

Add `@airdao/airdao-node-contracts` to your dependencies

#### Usage

It contains deployed contract addresses for both (testnet and mainnet) networks and convenient methods to use it.  
It also contains `AmbErrorProvider` - use it instead of default provider to get human-readable errors from contracts.

Examples:

```javascript
import { AmbErrorProviderWeb3, Contracts, ContractNames, Multisig } from "airdao-node-contracts";

const provider = new AmbErrorProviderWeb3(window.ethereum); // for human-readable errors
const signer = provider.getSigner();
const chainId = (await provider.getNetwork()).chainId;

// signer can be undefined, if you dont want to call methods
// chainId must be testnet or mainnet network; Received contract addresses depends on it
const contracts = new Contracts(signer, chainId);
// `contracts` contains all deployed contracts
// you can get contract instance (ethers) via `getContractByName` or `getContractByAddress`,
// but in most cases you doesn't need to use this;
// PLEASE, use `ContractNames` enum for contract names! real value can be changed!

// get all multisig permissions
const { users, groups } = await Multisig.getPermissions(contracts);

// get all transactions
const txs = await Multisig.getTransactionsFromContracts(contracts);

// you can use map like this to display contract names that you want
const contractsNames = {
  [contracts.getContractByName(ContractNames.MasterMultisig).address]: "Permissions",
  [contracts.getContractByName(ContractNames.FinanceRewards).address]: "Finance: Rewards",
};
const nameToDisplay = contractsNames[txs[0].calledContractAddress];

// Create multisig tx, that withdraw 420 amb (wei) from FinanceMaster contract to signer
await Multisig.financeWithdraw(contracts, ContractNames.FinanceMaster, await signer.getAddress(), 420);
```
