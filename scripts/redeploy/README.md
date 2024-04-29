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
run scripts in root directory.

redeploy:
```bash
./scripts/utils/redeploy.sh [dev/test]
```

only show chainspec:
```bash
npx hardhat run scripts/utils/genChainspec.ts --network dev
```


