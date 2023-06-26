import { Contracts } from "../../contracts/contracts";
import { BigNumberish } from "ethers";
import { ContractNames } from "../../contracts/names";
import { Multisig, ValidatorSet } from "../../../typechain-types";
import { submitTransaction } from "./internal";

// coming soon...
async function validatorSetChangeTopCount(contracts: Contracts, newTop: BigNumberish) {
  const validatorSet = contracts.getContractByName(ContractNames.ValidatorSet) as ValidatorSet;
  const multisigContract = contracts.getContractByName(ContractNames.ValidatorSetMultisig) as Multisig;

  const calldata = (await validatorSet.populateTransaction.changeTopStakesCount(newTop)).data!;
  return await submitTransaction(multisigContract, validatorSet.address, 0, calldata);
}
