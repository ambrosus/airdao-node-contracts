import { ethers } from "hardhat";
import { deploy } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
import { Treasury__factory } from "../../typechain-types";
import { deployMultisig } from "../utils/deployMultisig";

export async function main() {
  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.TreasuryMultisig, deployer, "common");


  await deploy<Treasury__factory>({
    contractName: ContractNames.Treasury,
    artifactName: "Treasury",
    signer: deployer,
    deployArgs: [
      multisig.address,
      0 // turn off for now
      // 0.1 * 10000, // 10% fee
    ],
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
