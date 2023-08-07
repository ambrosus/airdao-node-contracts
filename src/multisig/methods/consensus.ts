import { Contracts } from "../../contracts/contracts";
import { ValidatorSet } from "../../../typechain-types";
import { ContractNames } from "../../contracts/names";
import { submitTransaction2 } from "./internal";

// view methods
async function validatorSetGetNodeStake(contracts: Contracts, nodeAddress: string) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getNodeStake(nodeAddress);
}

async function validatorSetGetValidators(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getValidators();
}

async function validatorSetGetTopStakes(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getTopStakes();
}

async function validatorSetGetQueuedStakes(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getQueuedStakes();
}

async function validatorSetGetStakesByManager(contracts: Contracts, managerAddress: string) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getStakesByManager(managerAddress);
}

// admin methods

async function validatorSetAddBlockListener(contracts: Contracts, listener: string) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.addBlockListener(listener)
  );
}

async function validatorSetRemoveBlockListener(contracts: Contracts, listener: string) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.removeBlockListener(listener)
  );
}
