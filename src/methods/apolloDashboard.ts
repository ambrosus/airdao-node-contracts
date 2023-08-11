import { Contracts } from "../contracts/contracts";
import { BigNumberish } from "ethers";
import { LockKeeper, ServerNodes_Manager } from "../../typechain-types";
import { ContractNames } from "../contracts/names";
import { validatorSetGetNodeStake } from "./consensus";

export async function getApolloInfo(contracts: Contracts, nodeAddress: string) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const stake = await serverNodes.stakes(nodeAddress);
  if (stake.stake.isZero()) return undefined;

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
  amount: BigNumberish
) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.newStake(nodeAddress, rewardAddress, { value: amount });
}

export function serverNodesAddStake(contracts: Contracts, nodeAddress: string, amount: BigNumberish) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.addStake(nodeAddress, { value: amount });
}

export function serverNodesUnstake(contracts: Contracts, nodeAddress: string, amount: BigNumberish) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.unstake(nodeAddress, amount);
}

export function serverNodesRestake(contracts: Contracts, nodeAddress: string) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return serverNodes.restake(nodeAddress);
}

export async function serverNodesGetStake(contracts: Contracts, nodeAddress: string) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return await serverNodes.stakes(nodeAddress);
}

export async function serverNodesGetNodesByOwner(contracts: Contracts, ownerAddress: string) {
  const serverNodes = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  return await serverNodes.getUserStakesList(ownerAddress);
}

async function lockKeeperGetLock(contracts: Contracts, lockId: BigNumberish) {
  const lockKeeper = contracts.getContractByName(ContractNames.LockKeeper) as LockKeeper;
  return await lockKeeper.getLock(lockId);
}
