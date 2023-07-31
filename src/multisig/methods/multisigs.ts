import { Contracts } from "../../contracts/contracts";
import { ContractNames, slavesMultisigsNames } from "../../contracts/names";
import { MasterMultisig } from "../../../typechain-types";
import { submitTransaction } from "./internal";

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
