import {Finance, Multisig, ValidatorSet} from "../../typechain-types";
import {BigNumber} from "ethers";
import {Contracts} from "../contracts/contracts";
import {ContractNames} from "../contracts/names";


async function financeWithdraw(contracts: Contracts, financeContractName: ContractNames, addressTo: string, amount: BigNumber) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  const multisigContract = contracts.getContractByName(financeContractName + "_Multisig") as Multisig;

  const calldata = (await financeContract.populateTransaction.withdraw(addressTo, amount)).data!
  return await multisigContract.submitTransaction(financeContract.address, 0, calldata)
}

// coming soon...
async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumber) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const multisigContract = contracts.getContractByName(ContractNames.ValidatorSetMultisig) as Multisig;

  const calldata = (await validatorSet.populateTransaction.changeTopStakesCount(newTop)).data!
  return await multisigContract.submitTransaction(validatorSet.address, 0, calldata)
}

