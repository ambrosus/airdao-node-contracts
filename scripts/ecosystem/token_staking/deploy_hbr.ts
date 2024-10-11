import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { HBRToken__factory } from "../../../typechain-types";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  if (chainId == 16718) {
    return;
  }

  const token = await deploy<HBRToken__factory>({
    contractName: ContractNames.Ecosystem_HBRToken,
    artifactName: "HBRToken",
    deployArgs: [deployer.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  console.log("Transfering ownership of HBR token to multisig...");
  const multisig = loadDeployment(ContractNames.Ecosystem_LimitedTokenPoolsManagerMultisig, chainId, deployer);
  await token.transferOwnership(multisig.address);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
