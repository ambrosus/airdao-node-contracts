import {  BigNumberish } from "ethers";
import { Contracts } from "../contracts/contracts";
import { ContractNames } from "../contracts/names";
import { Fees } from "../../typechain-types";

export async function feesSetGasPrice(contracts: Contracts, price: BigNumberish) {
  const fees = contracts.getContractByName(ContractNames.Fees) as Fees;
  return fees.setGasPrice(price);
}

export async function feesGetGasPrice(contracts: Contracts) {
  const fees = contracts.getContractByName(ContractNames.Fees) as Fees;
  return fees.getGasPrice();
}

export async function feesSetFeesParams(contracts: Contracts, payAddress: string, percent: BigNumberish) {
  const fees = contracts.getContractByName(ContractNames.Fees) as Fees;
  return fees.setFeesParams(payAddress, percent);
}

export async function feesGetFeesParams(contracts: Contracts) {
  const fees = contracts.getContractByName(ContractNames.Fees) as Fees;
  return fees.getFeesParams();
}
