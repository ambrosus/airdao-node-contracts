import { Contracts } from "../../contracts/contracts";
import { BigNumberish } from "ethers";
import { ContractNames } from "../../contracts/names";
import {
  BaseNodes_Manager,
  LegacyPoolsNodes_Manager,
  Multisig,
  ServerNodes_Manager,
  ValidatorSet,
} from "../../../typechain-types";
import { submitTransaction } from "./internal";

// coming soon...
async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumberish) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const multisigContract = contracts.getContractByName(ContractNames.ValidatorSetMultisig) as Multisig;

  const calldata = (await validatorSet.populateTransaction.changeTopStakesCount(newTop)).data!;
  return await submitTransaction(multisigContract, validatorSet.address, 0, calldata);
}

// legacy pool manager

type PoolManagersCN = ContractNames.LegacyPoolManager; // | ContractNames.PoolManager;

export async function poolManagerGetPools(contracts: Contracts, contractName: PoolManagersCN): Promise<string[]> {
  const poolManager = contracts.getContractByName(contractName) as LegacyPoolsNodes_Manager;
  return await poolManager.getPools();
}

export async function poolManagerAddPool(contracts: Contracts, contractName: PoolManagersCN, poolAddress: string) {
  const poolManager = contracts.getContractByName(contractName) as LegacyPoolsNodes_Manager;
  const multisigContract = contracts.getContractByName((contractName + "_Multisig") as ContractNames) as Multisig;

  const calldata = (await poolManager.populateTransaction.addPool(poolAddress)).data!;
  return await submitTransaction(multisigContract, poolManager.address, 0, calldata);
}

export async function poolManagerRemovePool(contracts: Contracts, contractName: PoolManagersCN, poolAddress: string) {
  const poolManager = contracts.getContractByName(contractName) as LegacyPoolsNodes_Manager;
  const multisigContract = contracts.getContractByName((contractName + "_Multisig") as ContractNames) as Multisig;

  const calldata = (await poolManager.populateTransaction.removePool(poolAddress)).data!;
  return await submitTransaction(multisigContract, poolManager.address, 0, calldata);
}

export async function poolManagerChangeMinApolloDeposit(
  contracts: Contracts,
  contractName: PoolManagersCN,
  minApolloDeposit: BigNumberish
) {
  const poolManager = contracts.getContractByName(contractName) as LegacyPoolsNodes_Manager;
  const multisigContract = contracts.getContractByName((contractName + "_Multisig") as ContractNames) as Multisig;

  const calldata = (await poolManager.populateTransaction.changeMinApolloDeposit(minApolloDeposit)).data!;
  return await submitTransaction(multisigContract, poolManager.address, 0, calldata);
}

export async function baseNodesManagerAddStake(contracts: Contracts, nodeAddress: string) {
  const baseNodesManager = contracts.getContractByName(ContractNames.BaseNodesManager) as BaseNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.BaseNodesManagerMultisig) as Multisig;

  const calldata = (await baseNodesManager.populateTransaction.addStake(nodeAddress)).data!;
  return await submitTransaction(multisigContract, baseNodesManager.address, 0, calldata);
}

export async function baseNodesManagerRemoveStake(
  contracts: Contracts,
  nodeAddress: string,
  amount: BigNumberish,
  sendTo: string
) {
  const baseNodesManager = contracts.getContractByName(ContractNames.BaseNodesManager) as BaseNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.BaseNodesManagerMultisig) as Multisig;

  const calldata = (await baseNodesManager.populateTransaction.removeStake(nodeAddress, amount, sendTo)).data!;
  return await submitTransaction(multisigContract, baseNodesManager.address, 0, calldata);
}

export async function serverNodesManagerNewStake(contracts: Contracts, nodeAddress: string) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.newStake(nodeAddress)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerAddStake(contracts: Contracts) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.addStake()).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerUnstake(contracts: Contracts, amount: BigNumberish) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.unstake(amount)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerSetRewardsAddress(
  contracts: Contracts,
  nodeAddress: string,
  rewardsAddress: string
) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.setRewardsAddress(nodeAddress, rewardsAddress)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerChangeNodeOwner(
  contracts: Contracts,
  nodeAddress: string,
  newOwnerAddress: string
) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.changeNodeOwner(nodeAddress, newOwnerAddress)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerRestake(contracts: Contracts) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.restake()).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}
