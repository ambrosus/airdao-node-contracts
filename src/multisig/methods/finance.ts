// NON VIEW

import { Contracts } from "../../contracts/contracts";
import { ContractNames } from "../../contracts/names";
import { BigNumberish } from "ethers";
import { Finance, MasterFinance } from "../../../typechain-types";
import { submitTransaction2 } from "./internal";

type FinanceContractNames =
  | ContractNames.FinanceMaster
  | ContractNames.FinanceRewards
  | ContractNames.FinanceInvestors
  | ContractNames.FinanceTeam
  | ContractNames.FinanceEcosystem;

export async function financeWithdraw(
  contracts: Contracts,
  financeContractName: FinanceContractNames,
  addressTo: string,
  amount: BigNumberish
) {
  return await submitTransaction2<Finance>(contracts, financeContractName, 0, (financeContract) =>
    financeContract.withdraw(addressTo, amount)
  );
}

// VIEW

export async function getFinanceBalance(contracts: Contracts, financeContractName: FinanceContractNames) {
  const financeContract = contracts.getContractByName(financeContractName) as Finance;
  return financeContract.provider.getBalance(financeContract.address);
}

export async function getMasterFinanceBalances(contracts: Contracts) {
  const financeContract = contracts.getContractByName(ContractNames.FinanceMaster) as MasterFinance;
  const [addresses, balances] = await financeContract.getBalances();
  return addresses.map((a, i) => ({ address: a, balance: balances[i] }));
}
