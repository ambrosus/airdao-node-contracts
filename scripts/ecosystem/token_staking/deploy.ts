import { ethers, upgrades } from "hardhat";
import { deploy } from "@airdao/deployments/deploying";

import { ContractNames } from "../../../src";

import {
  TokenPoolsManager__factory,
  RewardsBank__factory,
  LockKeeper__factory
} from "../../../typechain-types";

import { wrapProviderToError } from "../../../src/utils/AmbErrorProvider";
import { deployMultisig } from "../../utils/deployMultisig";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

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
    
  console.log("deploying TokenPool Beacon");

  const tokenPoolFactory = await ethers.getContractFactory("TokenPool");
  const tokenPoolBeacon = await upgrades.deployBeacon(tokenPoolFactory);
  console.log("TokenPool Beacon deployed to:", tokenPoolBeacon.address);

  console.log("deploying LimitedTokenPool Beacon");
  const limitedTokenPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
  const limitedTokenPoolBeacon = await upgrades.deployBeacon(limitedTokenPoolFactory);
  console.log("LimitedTokenPool Beacon deployed to:", limitedTokenPoolBeacon.address);

  console.log("deploying TokenPoolsManager");
  const poolsManager = await deploy<TokenPoolsManager__factory>({
    contractName: ContractNames.Ecosystem_TokenPoolsManager,
    artifactName: "TokenPoolsManager",
    deployArgs: [rewardsBank.address, lockKeeper.address, tokenPoolBeacon.address, limitedTokenPoolBeacon.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  console.log("Grant poolsManager rewardsBank admin roles");
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();

  console.log("Grant multisig rewardsBank admin role");
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  console.log("Grant multisig poolsManager admin role");
  await (await poolsManager.grantRole(await poolsManager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  if (chainId != 16718) return;  // continue only on prod

  console.log("Revoking roles from deployer");

  console.log("Revoke rewardsBank admin role from deployer");
  await (await rewardsBank.revokeRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

  console.log("Revoke poolsManager admin role from deployer");
  await (await poolsManager.revokeRole(await poolsManager.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
