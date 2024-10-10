import { ethers, upgrades } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";

import { ContractNames } from "../../../src";

import {
  LimitedTokenPoolsManager__factory,
  RewardsBank__factory,
  LockKeeper__factory
} from "../../../typechain-types";

import { wrapProviderToError } from "../../../src/utils/AmbErrorProvider";
import { deployMultisig } from "../../utils/deployMultisig";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  const multisig = await deployMultisig(ContractNames.Ecosystem_LimitedTokenPoolsManagerMultisig, deployer, "eco");

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_LimitedTokenPoolsManagerRewardsBank,
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

  console.log("deploying LimitedTokenPool Beacon");
  const limitedTokenPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
  const limitedTokenPoolBeacon = await upgrades.deployBeacon(limitedTokenPoolFactory);
  await limitedTokenPoolBeacon.deployed();
  console.log("LimitedTokenPool Beacon deployed to:", limitedTokenPoolBeacon.address);

  console.log("deploying TokenPoolsManager");
  const poolsManager = await deploy<LimitedTokenPoolsManager__factory>({
    contractName: ContractNames.Ecosystem_LimitedTokenPoolsManager,
    artifactName: "LimitedTokenPoolsManager",
    deployArgs: [rewardsBank.address, lockKeeper.address, limitedTokenPoolBeacon.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  console.log("Grant poolsManager rewardsBank admin roles");
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();

  console.log("Grant multisig rewardsBank admin role");
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  console.log("Grant multisig poolsManager admin role");
  await (await poolsManager.grantRole(await poolsManager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  // on prod - multisig only
  if (chainId != 16718) {
    console.log("Add block listeners");
    await (await validatorSet.addBlockListener(poolsManager.address)).wait();
  } else {
    console.log("Add block listeners calldata");
    const calldata2 = await validatorSet.populateTransaction.addBlockListener(poolsManager.address);
    const multisigTx2 = await multisig.populateTransaction.submitTransaction(validatorSet.address, 0, calldata2.data!);
    console.log(multisigTx2);
  }

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
