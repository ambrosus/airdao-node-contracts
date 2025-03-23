import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { wrapProviderToError } from "../../../src/utils/AmbErrorProvider";
import { deployMultisig } from "../../utils/deployMultisig";

export async function main() {

  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

  const multisig = await deployMultisig(ContractNames.Ecosystem_LiquidPoolMultisig, deployer, "eco");
  console.log(`Multisig deployed at ${multisig.address}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
