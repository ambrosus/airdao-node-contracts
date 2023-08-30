import { Contracts } from "../contracts/contracts";
import { BigNumberish, ethers } from "ethers";
import { ContractNames } from "../contracts/names";
import {
  AirBond,
  BaseNodes_Manager,
  PoolsNodes_Manager,
  RewardsBank,
  ServerNodes_Manager,
  ValidatorSet,
} from "../../typechain-types";
import { submitTransaction2 } from "./internal";

// validator set

async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumberish) {
  return await submitTransaction2<ValidatorSet>(contracts, ContractNames.ValidatorSet, 0, (validatorSet) =>
    validatorSet.changeTopStakesCount(newTop)
  );
}

// pool manager

type PoolManagersCN = ContractNames.LegacyPoolManager; // | ContractNames.PoolManager;

export async function poolManagerGetPools(contracts: Contracts, contractName: PoolManagersCN) {
  const addresses = await poolManagerGetPoolsAddresses(contracts, contractName);
  return await Promise.all(
    addresses.map(async (poolAddress) => ({
      address: poolAddress,
      name: await getPoolName(contracts, poolAddress),
    }))
  );
}

export async function poolManagerGetPoolsAddresses(
  contracts: Contracts,
  contractName: PoolManagersCN
): Promise<string[]> {
  const poolManager = contracts.getContractByName(contractName) as PoolsNodes_Manager;
  return await poolManager.getPools();
}

export async function poolManagerAddPool(contracts: Contracts, contractName: PoolManagersCN, poolAddress: string) {
  return await submitTransaction2<PoolsNodes_Manager>(contracts, contractName, 0, async (poolManager) => {
    if ((await getPoolName(contracts, poolAddress)) == null) throw new Error("Provided address probably is not a pool");
    return poolManager.addPool(poolAddress);
  });
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

export function serverNodesGetMinStake(contracts: Contracts) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.minStakeAmount();
}

export function serverNodesGetOnboardingDelay(contracts: Contracts) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.onboardingDelay();
}

export function serverNodesGetUnstakeLockTime(contracts: Contracts) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.unstakeLockTime();
}

export async function serverNodesManagerChangeMinStakeAmount(contracts: Contracts, newMinStakeAmount: BigNumberish) {
  return await submitTransaction2<ServerNodes_Manager>(
    contracts,
    ContractNames.ServerNodesManager,
    0,
    (serverNodesManager) => serverNodesManager.changeMinStakeAmount(newMinStakeAmount)
  );
}

export async function serverNodesManagerChangeOnboardingDelay(contracts: Contracts, newOnboardingDelay: BigNumberish) {
  return await submitTransaction2<ServerNodes_Manager>(
    contracts,
    ContractNames.ServerNodesManager,
    0,
    (serverNodesManager) => serverNodesManager.changeOnboardingDelay(newOnboardingDelay)
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

export async function serverNodesManagerGetNodesList(contracts: Contracts) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return await serverNodes.getStakesList();
}

// rewards bank

type rewardsBankContactNames =
  | ContractNames.BaseNodesManagerRewardsBank
  | ContractNames.LegacyPoolManagerRewardsBank
  | ContractNames.ServerNodesManagerRewardsBank;

export async function rewardsBanksWithdrawAmb(
  contracts: Contracts,
  contractName: rewardsBankContactNames,
  addressTo: string,
  amount: BigNumberish
) {
  return await submitTransaction2<RewardsBank>(contracts, contractName, 0, (rewardsBank) =>
    rewardsBank.withdrawAmb(addressTo, amount)
  );
}

export async function rewardsBanksWithdrawBonds(
  contracts: Contracts,
  contractName: rewardsBankContactNames,
  addressTo: string,
  amount: BigNumberish
) {
  const airBond = contracts.getContractByName(ContractNames.AirBond);
  return await submitTransaction2<RewardsBank>(contracts, contractName, 0, (rewardsBank) =>
    rewardsBank.withdrawErc20(airBond.address, addressTo, amount)
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

export async function getAmbBalance(contracts: Contracts, contractName: ContractNames) {
  const contract = contracts.getContractByName(contractName);
  return await contract.provider.getBalance(contract.address);
}

export async function getBondsBalance(contracts: Contracts, contractName: ContractNames) {
  const contract = contracts.getContractByName(contractName);
  const airBond = contracts.getContractByName(ContractNames.AirBond) as AirBond;
  return await airBond.balanceOf(contract.address);
}

async function getPoolName(contracts: Contracts, poolAddress: string) {
  const provider = contracts.getContractByName(ContractNames.LegacyPoolManager).provider;
  const abi = ["function name() view returns (string)"];
  const poolContract = new ethers.Contract(poolAddress, abi, provider);
  return poolContract.name().catch(() => null);
}
