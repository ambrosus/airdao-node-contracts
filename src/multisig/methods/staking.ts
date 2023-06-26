import { Contracts } from "../../contracts/contracts";
import { BigNumberish } from "ethers";
import { ContractNames } from "../../contracts/names";
import { LegacyPoolsNodes_Manager, Multisig, ValidatorSet } from "../../../typechain-types";
import { submitTransaction } from "./internal";

// coming soon...
async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumberish) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const multisigContract = contracts.getContractByName(ContractNames.ValidatorSetMultisig) as Multisig;

  const calldata = (await validatorSet.populateTransaction.changeTopStakesCount(newTop)).data!;
  return await submitTransaction(multisigContract, validatorSet.address, 0, calldata);
}

// legacy pool manager

export async function legacyPoolManagerGetPools(contracts: Contracts): Promise<string[]> {
  const legacyPoolManager = contracts.getContractByName(ContractNames.LegacyPoolManager) as LegacyPoolsNodes_Manager;
  return await legacyPoolManager.getPools();
}

export async function legacyPoolManagerAddPool(contracts: Contracts, poolAddress: string) {
  const legacyPoolManager = contracts.getContractByName(ContractNames.LegacyPoolManager) as LegacyPoolsNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.LegacyPoolManagerMultisig) as Multisig;

  const calldata = (await legacyPoolManager.populateTransaction.addPool(poolAddress)).data!;
  return await submitTransaction(multisigContract, legacyPoolManager.address, 0, calldata);
}

export async function legacyPoolManagerRemovePool(contracts: Contracts, poolAddress: string) {
  const legacyPoolManager = contracts.getContractByName(ContractNames.LegacyPoolManager) as LegacyPoolsNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.LegacyPoolManagerMultisig) as Multisig;

  const calldata = (await legacyPoolManager.populateTransaction.removePool(poolAddress)).data!;
  return await submitTransaction(multisigContract, legacyPoolManager.address, 0, calldata);
}

export async function legacyPoolManagerChangeMinApolloDeposit(contracts: Contracts, minApolloDeposit: BigNumberish) {
  const legacyPoolManager = contracts.getContractByName(ContractNames.LegacyPoolManager) as LegacyPoolsNodes_Manager;
  const multisigContract = contracts.getContractByName(ContractNames.LegacyPoolManagerMultisig) as Multisig;

  const calldata = (await legacyPoolManager.populateTransaction.changeMinApolloDeposit(minApolloDeposit)).data!;
  return await submitTransaction(multisigContract, legacyPoolManager.address, 0, calldata);
}
