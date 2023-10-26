import { Contracts } from "../contracts/contracts";
import { BigNumberish } from "ethers";
import { LockKeeper, ServerNodes_Manager } from "../../typechain-types";
import { ContractNames } from "../contracts/names";
import { validatorSetGetNodeStake } from "./consensus";

export async function getApolloInfo(contracts: Contracts, nodeAddress: string) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const stake = await serverNodes.stakes(nodeAddress);

  const withdrawLockId = await serverNodes.lockedWithdraws(nodeAddress);
  const withdrawLock_ = await lockKeeperGetLock(contracts, withdrawLockId);
  const withdrawLock = withdrawLock_.totalClaims.isZero()
    ? undefined
    : {
        receiver: withdrawLock_.receiver,
        amount: withdrawLock_.intervalAmount,
        unlockTime: withdrawLock_.firstUnlockTime,
      };

  const isOnboarded = !(await validatorSetGetNodeStake(contracts, nodeAddress)).isZero();

  return { apollo: stake, withdrawLock, isOnboarded };
}

export function serverNodesNewStake(
  contracts: Contracts,
  nodeAddress: string,
  rewardAddress: string,
  amount: BigNumberish,
  options: object = {},
) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.newStake(nodeAddress, rewardAddress, { value: amount, ...options });
}

export function serverNodesAddStake(contracts: Contracts, nodeAddress: string, amount: BigNumberish, options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.addStake(nodeAddress, { value: amount, ...options });
}

export function serverNodesUnstake(contracts: Contracts, nodeAddress: string, amount: BigNumberish,  options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.unstake(nodeAddress, amount, options);
}

export function serverNodesRestake(contracts: Contracts, nodeAddress: string,  options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.restake(nodeAddress, options);
}

export function serverNodesGetStake(contracts: Contracts, nodeAddress: string,  options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.stakes(nodeAddress, options);
}

export function serverNodesGetNodesByOwner(contracts: Contracts, ownerAddress: string,  options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.getUserStakesList(ownerAddress, options);
}

export function serverNodesChangeNodeOwner(contracts: Contracts, nodeAddress: string, newOwner: string,  options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.changeNodeOwner(nodeAddress, newOwner, options);
}

export function serverNodesSetRewardsAddress(contracts: Contracts, nodeAddress: string, newRewardReceiver: string,  options?: object) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.setRewardsAddress(nodeAddress, newRewardReceiver, options);
}

async function lockKeeperGetLock(contracts: Contracts, lockId: BigNumberish) {
  const lockKeeper = contracts.getContractByName(ContractNames.LockKeeper) as LockKeeper;
  return await lockKeeper.getLock(lockId);
}
