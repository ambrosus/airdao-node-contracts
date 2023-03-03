import {Finance, MasterFinance, Multisig, ValidatorSet} from "../../typechain-types";
import {BigNumber} from "ethers";
import {Contracts} from "../contracts/contracts";
import {ContractNames} from "../contracts/names";


export async function financeWithdraw(contracts: Contracts, financeContractName: ContractNames, addressTo: string, amount: BigNumber) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  const multisigContract = contracts.getContractByName(financeContractName + "_Multisig" as ContractNames) as Multisig;

  const calldata = (await financeContract.populateTransaction.withdraw(addressTo, amount)).data!
  return await multisigContract.submitTransaction(financeContract.address, 0, calldata)
}

export async function getFinanceBalance(contracts: Contracts, financeContractName: ContractNames) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  return financeContract.provider.getBalance(financeContract.address);
}

export async function getMasterFinanceBalances(contracts: Contracts) {
  const financeContract = contracts.getContractByName(ContractNames.FinanceMaster) as MasterFinance;
  const [addresses, balances] = await financeContract.getBalances();
  return addresses.map((a, i) => ({address: a, balance: balances[i]}));
}


// coming soon...
async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumber) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const multisigContract = contracts.getContractByName(ContractNames.ValidatorSetMultisig) as Multisig;

  const calldata = (await validatorSet.populateTransaction.changeTopStakesCount(newTop)).data!
  return await multisigContract.submitTransaction(validatorSet.address, 0, calldata)
}

