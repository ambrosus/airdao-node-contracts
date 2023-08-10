import { Contracts } from "../../contracts/contracts";
import { ValidatorSet } from "../../../typechain-types";
import { ContractNames } from "../../contracts/names";
import { submitTransaction2 } from "./internal";
import { BigNumberish } from "ethers";

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
  const manager = contracts.getContractByName(contractName);
  return await _getStakesWithBalances(contracts, async () => {
    return await validatorSetGetStakesByManager(contracts, manager.address);
  });
}

export async function validatorSetGetTopStakesBalances(contracts: Contracts) {
  return await _getStakesWithBalances(contracts, async () => {
    return await validatorSetGetTopStakes(contracts);
  });
}

export async function validatorSetGetQueuedStakesBalances(contracts: Contracts) {
  return await _getStakesWithBalances(contracts, async () => {
    return await validatorSetGetQueuedStakes(contracts);
  });
}

export async function validatorSetGetValidatorsBalances(contracts: Contracts) {
  return await _getStakesWithBalances(contracts, async () => {
    return await validatorSetGetValidators(contracts);
  });
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

export async function validatorSetChangeTopStakesCount(contracts: Contracts, newTopStakesCount: BigNumberish) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.changeTopStakesCount(newTopStakesCount)
  );
}
export async function validatorSetSetReward(contracts: Contracts, baseReward: BigNumberish) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.setReward(baseReward)
  );
}

async function _getStakesWithBalances(contracts: Contracts, stakeGetter: (contracts: Contracts) => Promise<string[]>) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const stakes = await stakeGetter(contracts);

  return await Promise.all(
    stakes.map(async (stakeAddress) => ({
      address: stakeAddress,
      stake: await validatorSet.getNodeStake(stakeAddress),
    }))
  );
}
