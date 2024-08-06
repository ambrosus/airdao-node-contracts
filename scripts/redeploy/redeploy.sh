NETWORK=${1:-dev}

set -e


if [ "$NETWORK" = "dev" ]; then
  rm -f .openzeppelin/unknown-30746.json
  echo "{}" > deployments/30746.json
elif [ "$NETWORK" = "test" ]; then
  rm -f .openzeppelin/unknown-22040.json
  echo "{}" > deployments/22040.json
else
  echo "only dev and test support"
  exit 1
fi

npx hardhat run scripts/multisig/deploy_multisig.ts --network "${NETWORK}"
npx hardhat run scripts/finance/deploy_finance.ts --network "${NETWORK}"
npx hardhat run scripts/finance/deploy_airdrop.ts --network "${NETWORK}"
npx hardhat run scripts/staking/deploy_validatorset.ts --network "${NETWORK}"
npx hardhat run scripts/staking/deploy_treasury.ts --network "${NETWORK}"
npx hardhat run scripts/staking/deploy_basenodes_manager.ts --network "${NETWORK}"
npx hardhat run scripts/staking/deploy_servernodes_manager.ts --network "${NETWORK}"
npx hardhat run scripts/staking/deploy_legacy_pool_manager.ts --network "${NETWORK}"
npx hardhat run scripts/staking/migrate_to_new_staking.ts --network "${NETWORK}"
npx hardhat run scripts/fees/deploy_fees.ts --network "${NETWORK}"

npx hardhat run scripts/multisig/deploy_ecosystem_multisig.ts --network "${NETWORK}"
npx hardhat run scripts/ecosystem/bond-marketplace/deploy.ts --network "${NETWORK}"
npx hardhat run scripts/ecosystem/starfleet/deploy.ts --network "${NETWORK}"
npx hardhat run scripts/ecosystem/astradex/deploy.ts --network "${NETWORK}"
npx hardhat run scripts/ecosystem/astradex/deployTokensSafe.ts --network "${NETWORK}"

npx hardhat sourcify --network "${NETWORK}"

npx hardhat run scripts/redeploy/genChainspec.ts --network "${NETWORK}"
