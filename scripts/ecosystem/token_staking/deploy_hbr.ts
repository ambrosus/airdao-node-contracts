import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { deploy } from "@airdao/deployments/deploying";
import { HBRToken__factory } from "../../../typechain-types";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  if (chainId == 16718) {
    return;
  }

  const airBond = await deploy<HBRToken__factory>({
    contractName: ContractNames.Ecosystem_HBRToken,
    artifactName: "HBRToken",
    deployArgs: [deployer.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await (await airBond.grantRole(await airBond.DEFAULT_ADMIN_ROLE(), deployer.address)).wait(); // 
  await (await airBond.grantRole(await airBond.MINTER_ROLE(), deployer.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
