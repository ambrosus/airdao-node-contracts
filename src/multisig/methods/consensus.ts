//getNodeStake
// getValidators
// getTopStakes
// getQueuedStakes
// getStakesByManager

import { Contracts } from "../../contracts/contracts";
import { submitTransaction2 } from "./internal";
import { ValidatorSet } from "../../../typechain-types";
import { ContractNames } from "../../contracts/names";

// validator set
async function validatorSetGetNodeStake(contracts: Contracts, nodeAddress: string) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.getNodeStake(nodeAddress)
  );
}

async function validatorSetGetValidators(contracts: Contracts) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.getValidators()
  );
}

async function validatorSetGetTopStakes(contracts: Contracts) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.getTopStakes()
  );
}

async function validatorSetGetQueuedStakes(contracts: Contracts) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.getQueuedStakes()
  );
}

async function validatorSetGetStakesByManager(contracts: Contracts, managerAddress: string) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.getStakesByManager(managerAddress)
  );
}
