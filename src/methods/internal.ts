import { Multisig } from "../../typechain-types";
import { BaseContract, BigNumberish, PopulatedTransaction } from "ethers";
import { MULTISIGS } from "../contracts/names";
import { Contracts } from "../contracts/contracts";

export async function submitTransaction(
  multisig: Multisig,
  destination: string,
  value: BigNumberish,
  calldata: string
) {
  try {
    await multisig.callStatic.checkBeforeSubmitTransaction(destination, value, calldata, { value });
    throw new Error("checkBeforeSubmitTransaction doesn't respond with any error, but it should!");
  } catch (e: any) {
    const errorReason = (e.error || e).toString();
    if (errorReason !== "OK" && errorReason !== "Error: OK") throw errorReason;
  }

  return await multisig.submitTransaction(destination, value, calldata, { value });
}

export async function submitTransaction2<T extends BaseContract>(
  contracts: Contracts,
  contractName: keyof typeof MULTISIGS,
  value: BigNumberish,
  calldataTx: (contract: T["populateTransaction"]) => Promise<PopulatedTransaction>
) {
  const contract = contracts.getContractByName(contractName) as T;
  const multisig = contracts.getContractByName(MULTISIGS[contractName]) as Multisig;
  const calldata = (await calldataTx(contract.populateTransaction)).data!;
  return await submitTransaction(multisig, contract.address, value, calldata);
}
