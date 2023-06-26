// INTERNAL

import { Multisig } from "../../../typechain-types";
import { BigNumberish } from "ethers";

export async function submitTransaction(
  multisig: Multisig,
  destination: string,
  value: BigNumberish,
  calldata: string
) {
  try {
    await multisig.callStatic.checkBeforeSubmitTransaction(destination, value, calldata);
    throw new Error("checkBeforeSubmitTransaction doesn't respond with any error, but it should!");
  } catch (e: any) {
    const errorReason = (e.error || e).toString();
    if (errorReason !== "OK" && errorReason !== "Error: OK") throw new Error(errorReason);
  }

  return await multisig.submitTransaction(destination, value, calldata);
}
