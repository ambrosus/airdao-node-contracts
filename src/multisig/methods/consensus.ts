import { Contracts } from "../../contracts/contracts";
import { ValidatorSet } from "../../../typechain-types";
import { ContractNames } from "../../contracts/names";
import { submitTransaction2 } from "./internal";

// view methods
export async function validatorSetGetNodeStake(contracts: Contracts, nodeAddress: string) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getNodeStake(nodeAddress);
}

export async function validatorSetGetValidators(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getValidators();
}

export async function validatorSetGetTopStakes(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getTopStakes();
}

export async function validatorSetGetQueuedStakes(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getQueuedStakes();
}

export async function validatorSetGetStakesByManager(contracts: Contracts, managerAddress: string) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getStakesByManager(managerAddress);
}

export async function validatorSetGetBlockListeners(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.listeners();
}

export async function validatorSetGetStakesBalancesByManager(contracts: Contracts, contractName: ContractNames) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const manager = contracts.getContractByName(contractName);
  const stakes = await validatorSetGetStakesByManager(contracts, manager.address);
  return await Promise.all(
    stakes.map((stakeAddress) => ({ address: stakeAddress, stake: validatorSet.getNodeStake(stakeAddress) }))
  );
}

// admin methods

export async function validatorSetAddBlockListener(contracts: Contracts, listener: string) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.addBlockListener(listener)
  );
}

export async function validatorSetRemoveBlockListener(contracts: Contracts, listener: string) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.removeBlockListener(listener)
  );
}
