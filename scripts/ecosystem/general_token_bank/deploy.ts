import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { deployMultisig } from "../../utils/deployMultisig";
import { deploy } from "@airdao/deployments/deploying";

import { RewardsBank__factory } from "../../../typechain-types";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.Ecosystem_GeneralTokenBank_Multisig, deployer, "eco");

  const generalTokenBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_GeneralTokenBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  console.log("Grant multisig generalTokenBank admin role");
  await (await generalTokenBank.grantRole(await generalTokenBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  if (chainId != 16718) return;

  console.log("Revoke deployer generalTokenBank admin role");
  await (await generalTokenBank.revokeRole(await generalTokenBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

