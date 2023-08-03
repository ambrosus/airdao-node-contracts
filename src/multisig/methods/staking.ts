import { Contracts } from "../../contracts/contracts";
import { BigNumberish } from "ethers";
import { ContractNames } from "../../contracts/names";
import {
  BaseNodes_Manager,
  PoolsNodes_Manager,
  RewardsBank,
  ServerNodes_Manager,
  ValidatorSet,
} from "../../../typechain-types";
import { submitTransaction2 } from "./internal";

// validator set

async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumberish) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.changeTopStakesCount(newTop)
  );
}

// pool manager

type PoolManagersCN = ContractNames.LegacyPoolManager; // | ContractNames.PoolManager;

export async function poolManagerGetPools(contracts: Contracts, contractName: PoolManagersCN): Promise<string[]> {
  const poolManager = contracts.getContractByName(contractName) as PoolsNodes_Manager;
  return await poolManager.getPools();
}

export async function poolManagerAddPool(contracts: Contracts, contractName: PoolManagersCN, poolAddress: string) {
  return await submitTransaction2<PoolsNodes_Manager>(contracts, contractName, 0, (poolManager) =>
    poolManager.addPool(poolAddress)
  );
}

export async function poolManagerRemovePool(contracts: Contracts, contractName: PoolManagersCN, poolAddress: string) {
  return await submitTransaction2<PoolsNodes_Manager>(contracts, contractName, 0, (poolManager) =>
    poolManager.removePool(poolAddress)
  );
}

export async function poolManagerChangeMinApolloDeposit(
  contracts: Contracts,
  contractName: PoolManagersCN,
  minApolloDeposit: BigNumberish
) {
  return await submitTransaction2<PoolsNodes_Manager>(contracts, contractName, 0, (poolManager) =>
    poolManager.changeMinApolloDeposit(minApolloDeposit)
  );
}

// base nodes manager

export async function baseNodesManagerAddStake(contracts: Contracts, nodeAddress: string, amount: BigNumberish) {
  return await submitTransaction2<BaseNodes_Manager>(
    contracts,
    ContractNames.BaseNodesManager,
    amount,
    (baseNodesManager) => baseNodesManager.addStake(nodeAddress)
  );
}

export async function baseNodesManagerRemoveStake(
  contracts: Contracts,
  nodeAddress: string,
  amount: BigNumberish,
  sendTo: string
) {
  return await submitTransaction2<BaseNodes_Manager>(contracts, ContractNames.BaseNodesManager, 0, (baseNodesManager) =>
    baseNodesManager.removeStake(nodeAddress, amount, sendTo)
  );
}

// server nodes manager

export async function serverNodesManagerChangeMinStakeAmount(contracts: Contracts, newMinStakeAmount: BigNumberish) {
  return await submitTransaction2<ServerNodes_Manager>(
    contracts,
    ContractNames.ServerNodesManager,
    0,
    (serverNodesManager) => serverNodesManager.changeMinStakeAmount(newMinStakeAmount)
  );
}

export async function serverNodesManagerChangeUnstakeLockTime(contracts: Contracts, unstakeLockTime: BigNumberish) {
  return await submitTransaction2<ServerNodes_Manager>(
    contracts,
    ContractNames.ServerNodesManager,
    0,
    (serverNodesManager) => serverNodesManager.changeUnstakeLockTime(unstakeLockTime)
  );
}

export async function rewardsBanksManagerWithdrawAmb(
  contracts: Contracts,
  contractName: ContractNames.BaseNodesManager | ContractNames.ServerNodesManager,
  addressTo: string,
  amount: BigNumberish
) {
  return await submitTransaction2<RewardsBank>(contracts, contractName, 0, (rewardsBank) =>
    rewardsBank.withdrawAmb(addressTo, amount)
  );
}

export async function rewardsBanksManagerWithdrawBonds(
  contracts: Contracts,
  contractName: ContractNames.BaseNodesManager | ContractNames.ServerNodesManager,
  addressTo: string,
  amount: BigNumberish
) {
  return await submitTransaction2<RewardsBank>(contracts, contractName, 0, (rewardsBank) =>
    rewardsBank.withdrawBonds(addressTo, amount)
  );
}

// common

export async function changePauseState(
  contracts: Contracts,
  contractName: ContractNames.LegacyPoolManager | ContractNames.ServerNodesManager,
  pause: boolean
) {
  return await submitTransaction2(contracts, contractName, 0, (contract) =>
    pause ? contract.pause() : contract.unpause()
  );
}

export async function getPauseState(contracts: Contracts, contractName: ContractNames) {
  const contract = contracts.getContractByName(contractName);
  return await contract.paused();
}
