import {Finance, Multisig} from "../../typechain-types";
import {BigNumber} from "ethers";

async function financeWithdraw(multisig: Multisig, finance: Finance, addressTo: string, amount: BigNumber) {
  const calldata = (await finance.populateTransaction.withdraw(addressTo, amount)).data!
  return await multisig.submitTransaction(finance.address, 0, calldata)
}

