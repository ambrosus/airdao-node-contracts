import { Contracts } from "../../contracts/contracts";
import { ValidatorSet } from "../../../typechain-types";
import { ContractNames } from "../../contracts/names";

// validator set
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
