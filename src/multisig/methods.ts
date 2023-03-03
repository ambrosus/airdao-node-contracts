import {Finance, MasterFinance, Multisig, ValidatorSet} from "../../typechain-types";
import {BigNumberish} from "ethers";
import {Contracts} from "../contracts/contracts";
import {ContractNames} from "../contracts/names";


// NON VIEW

export async function financeWithdraw(contracts: Contracts, financeContractName: ContractNames, addressTo: string, amount: BigNumberish) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  const multisigContract = contracts.getContractByName(financeContractName + "_Multisig" as ContractNames) as Multisig;

  const calldata = (await financeContract.populateTransaction.withdraw(addressTo, amount)).data!
  return await submitTransaction(multisigContract, financeContract.address, 0, calldata);
}


// coming soon...
async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumberish) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const multisigContract = contracts.getContractByName(ContractNames.ValidatorSetMultisig) as Multisig;

  const calldata = (await validatorSet.populateTransaction.changeTopStakesCount(newTop)).data!
  return await submitTransaction(multisigContract, validatorSet.address, 0, calldata);
}


// VIEW

export async function getFinanceBalance(contracts: Contracts, financeContractName: ContractNames) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  return financeContract.provider.getBalance(financeContract.address);
}

export async function getMasterFinanceBalances(contracts: Contracts) {
  const financeContract = contracts.getContractByName(ContractNames.FinanceMaster) as MasterFinance;
  const [addresses, balances] = await financeContract.getBalances();
  return addresses.map((a, i) => ({address: a, balance: balances[i]}));
}


// INTERNAL

export async function submitTransaction(multisig: Multisig, destination: string, value: BigNumberish, calldata: string) {
  try {
    await multisig.callStatic.checkBeforeSubmitTransaction(destination, value, calldata)
    throw new Error("checkBeforeSubmitTransaction doesn't respond with any error, but it should!");
  } catch (e: any) {
    const errorReason = (e.error || e).toString();
    if (errorReason !== "OK" && errorReason !== "Error: OK")
      throw new Error(errorReason);
  }

  return await multisig.submitTransaction(destination, value, calldata)
}
