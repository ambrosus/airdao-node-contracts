// NON VIEW

import { Contracts } from "../../contracts/contracts";
import { ContractNames, slavesMultisigsNames } from "../../contracts/names";
import { BigNumberish } from "ethers";
import { Finance, MasterFinance, MasterMultisig, Multisig } from "../../../typechain-types";
import { submitTransaction } from "./internal";

export async function financeWithdraw(
  contracts: Contracts,
  financeContractName: ContractNames,
  addressTo: string,
  amount: BigNumberish
) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  const multisigContract = contracts.getContractByName(
    (financeContractName + "_Multisig") as ContractNames
  ) as Multisig;

  const calldata = (await financeContract.populateTransaction.withdraw(addressTo, amount)).data!;
  return await submitTransaction(multisigContract, financeContract.address, 0, calldata);
}

export async function changeMultisigOwners(contracts: Contracts, newOwner: string, multisigAddresses?: string[]) {
  if (!multisigAddresses)
    multisigAddresses = slavesMultisigsNames
      .map((n) => contracts.getContractByNameSafe(n)?.address)
      .filter((el) => el !== undefined) as string[];

  const masterMultisig = contracts.getContractByName(ContractNames.MasterMultisig) as MasterMultisig;

  if (multisigAddresses.includes(masterMultisig.address))
    throw Error("You probably don't want to change the owner of the master multisig");

  const calldata = (await masterMultisig.populateTransaction.changeOwners(multisigAddresses, newOwner)).data!;
  return await submitTransaction(masterMultisig, masterMultisig.address, 0, calldata);
}

// VIEW

export async function getFinanceBalance(contracts: Contracts, financeContractName: ContractNames) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  return financeContract.provider.getBalance(financeContract.address);
}

export async function getMasterFinanceBalances(contracts: Contracts) {
  const financeContract = contracts.getContractByName(ContractNames.FinanceMaster) as MasterFinance;
  const [addresses, balances] = await financeContract.getBalances();
  return addresses.map((a, i) => ({ address: a, balance: balances[i] }));
}
