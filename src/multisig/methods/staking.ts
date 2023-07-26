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

export async function serverNodesManagerChangeMinStakeAmount(contracts: Contracts, newMinStakeAmount: BigNumberish) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.changeMinStakeAmount(newMinStakeAmount)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerChangeUnstakeLockTime(contracts: Contracts, unstakeLockTime: BigNumberish) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.changeUnstakeLockTime(unstakeLockTime)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerWithdrawAmb(contracts: Contracts, addressTo: string, amount: BigNumberish) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.withdrawAmb(addressTo, amount)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerWithdrawBonds(contracts: Contracts, addressTo: string, amount: BigNumberish) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.withdrawBonds(addressTo, amount)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerImportOldStakes(
  contracts: Contracts,
  addresses: string[],
  amounts: BigNumberish[],
  timestamps: BigNumberish[]
) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.importOldStakes(addresses, amounts, timestamps)).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerPause(contracts: Contracts) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.pause()).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}

export async function serverNodesManagerUnpause(contracts: Contracts) {
  const serverNodesManager = contracts.getContractByName(ContractNames.ServerNodesManager) as ServerNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.ServerNodesManagerMultisig) as Multisig;

  const calldata = (await serverNodesManager.populateTransaction.unpause()).data!;
  return await submitTransaction(multisigContract, serverNodesManager.address, 0, calldata);
}
