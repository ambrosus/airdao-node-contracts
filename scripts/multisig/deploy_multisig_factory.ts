import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy } from "@airdao/deployments/deploying";
import { MultisigFactory__factory } from "../../typechain-types";

export async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying MultisigFactory...");
  const factory = await deploy<MultisigFactory__factory>({
    contractName: ContractNames.MultisigFactory,
    artifactName: "MultisigFactory",
    deployArgs: [],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  // Initialize the factory
  await factory.initialize();
  
  console.log("MultisigFactory deployed and initialized");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
