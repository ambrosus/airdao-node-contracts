import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { upgrade } from "@airdao/deployments/deploying";
import { wrapProviderToError } from "../src/utils/AmbErrorProvider";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

  //await upgrade({
  //  contractName: ContractNames.Ecosystem_LiquidNodesManager,
  //  networkId: chainId,
  //  signer: deployer,
  //});

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
