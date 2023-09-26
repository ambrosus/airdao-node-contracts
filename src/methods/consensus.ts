import { Contracts } from "../contracts/contracts";
import { ValidatorSet } from "../../typechain-types";
import { ContractNames } from "../contracts/names";
import { submitTransaction2 } from "./internal";
import { BigNumberish, ethers } from "ethers";

// view methods
export async function validatorSetGetNodeStake(contracts: Contracts, nodeAddress: string) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.getNodeStake(nodeAddress);
}

export async function validatorSetGetNodeStakeData(contracts: Contracts, nodeAddress: string) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  return validatorSet.stakes(nodeAddress);
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
  return validatorSet.getBlockListeners();
}

export async function validatorSetGetRewardSettings(contracts: Contracts) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const [isEnabled, ...settings] = await validatorSet.getRewardSettings();
  const [lowerPercent, upperPercent, lowerReward, upperReward] = settings.map((e) => +e / 10000);
  return { isEnabled: +isEnabled != 0, lowerPercent, upperPercent, lowerReward, upperReward };
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

export async function validatorSetSetRewardSettings(
  contracts: Contracts,
  isEnabled: boolean,
  lowerPercent: number,
  upperPercent: number,
  lowerReward: number,
  upperReward: number
) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.setRewardSettings([
      +isEnabled,
      lowerPercent * 10000,
      upperPercent * 10000,
      lowerReward * 10000,
      upperReward * 10000,
    ])
  );
}
