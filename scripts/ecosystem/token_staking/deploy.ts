import { ethers, upgrades } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";

import { ContractNames } from "../../../src";

import {
  TokenPoolsManager__factory,
  Multisig__factory,
  RewardsBank__factory,
  LockKeeper__factory
} from "../../../typechain-types";

import { deployMultisig } from "../../utils/deployMultisig";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.Ecosystem_TokenPoolsManagerMultisig, deployer);

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_TokenPoolsManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const lockKeeper = await deploy<LockKeeper__factory>({
    contractName: ContractNames.LockKeeper,
    artifactName: "LockKeeper",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
    isUpgradeableProxy: true,
  });


    
  const tokenPoolFactory = await ethers.getContractFactory("TokenPool");
  const tokenPoolBeacon = await upgrades.deployBeacon(tokenPoolFactory);

  const poolsManager = await deploy<TokenPoolsManager__factory>({
    contractName: ContractNames.Ecosystem_TokenPoolsManager,
    artifactName: "TokenPoolsManager",
    deployArgs: [rewardsBank.address, lockKeeper.address, tokenPoolBeacon.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await poolsManager.grantRole(await poolsManager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  if (chainId != 16718) return;  // continue only on prod

  console.log("Reworking roles from deployer");
  await (await rewardsBank.revokeRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  await (await poolsManager.revokeRole(await poolsManager.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
