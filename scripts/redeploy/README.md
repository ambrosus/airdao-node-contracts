## Redeploying devnet/testnet contracts

### What it will do:
- Delete old deployments files
- Deploy new contracts and save their addresses to `deployments` folder
- MIGRATE FROM AMBROSUS-NODE-CONTRACTS LEGACY CONTRACTS
- Generate and print new chainspec

Migration is transferring all funds from all nodes (base nodes + pool nodes + server nodes) to newly deployed contracts.

all operations are stateless and revertible EXCEPT FOR MIGRATION.   
DON'T RUN MIGRATION TWICE OR SOME SHIT WILL HAPPEN. 

### Usage

prepare .env file with private keys of deployer `PRIVATEKEY_OWNER_AMB` and 2 multisig owners `PRIVATEKEY_TEST_MULTISIG1` `PRIVATEKEY_TEST_MULTISIG2`.  
`PRIVATEKEY_OWNER_AMB` can be anything, multisig keys should be the same that used in ambrosus-node-contracts, ask someone about it. 


run scripts in root directory.

redeploy:
```bash
./scripts/utils/redeploy.sh [dev/test]
```

only show chainspec:
```bash
npx hardhat run scripts/utils/genChainspec.ts --network dev
```


