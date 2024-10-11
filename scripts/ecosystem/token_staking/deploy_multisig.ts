import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { deployMultisig } from "../../utils/deployMultisig";

async function main() {
  const [deployer] = await ethers.getSigners();

  await deployMultisig(ContractNames.Ecosystem_LimitedTokenPoolsManagerMultisig, deployer, "eco");

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

