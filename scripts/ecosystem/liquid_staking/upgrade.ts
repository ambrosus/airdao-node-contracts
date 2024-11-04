import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { upgrade } from "@airdao/deployments/deploying";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  console.log("Chain ID: ", chainId);
  const [deployer] = await ethers.getSigners();

  await upgrade({
    contractName: ContractNames.Ecosystem_LiquidPool,
    networkId: chainId,
    signer: deployer,
  });

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

