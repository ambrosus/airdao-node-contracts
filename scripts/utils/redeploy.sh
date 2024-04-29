NETWORK=${1:-dev}

set -e
cd ../..


if [ "$NETWORK" = "dev" ]; then
  rm -f .openzeppelin/unknown-30746.json
  echo "{}" > deployments/30746.json
elif [ "$NETWORK" = "test" ]; then
  rm .openzeppelin/unknown-22040.json
  echo "{}" > deployments/30746.json
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
npx hardhat run scripts/fees/deploy_fees.ts --network "${NETWORK}"
npx hardhat run scripts/bond-marketplace/deploy_rewards_bank.ts --network "${NETWORK}"
npx hardhat run scripts/staking/migrate_to_new_staking.ts --network "${NETWORK}"
npx hardhat run scripts/utils/genChainspec.ts --network "${NETWORK}"
