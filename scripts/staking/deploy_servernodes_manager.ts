import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import {
  LockKeeper__factory,
  Multisig__factory,
  RewardsBank__factory,
  ServerNodes_Manager__factory,
  ValidatorSet,
} from "../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {Roadmap2023MultisigSettings} from "../addresses";
import { MultisigVersions } from "../../src/contracts/names";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
    chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  }

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(
    ContractNames.ValidatorSet +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId,
    deployer
  ) as ValidatorSet;
  const masterMultisig = loadDeployment(
    ContractNames.MasterMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  ).address;
  const airBond = loadDeployment(
    ContractNames.AirBond +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  );
  const treasury = loadDeployment(
    ContractNames.Treasury +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  );

  const multisig = await deploy<Multisig__factory>({
    contractName:
      ContractNames.ServerNodesManagerMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const lockKeeper = await deploy<LockKeeper__factory>({
    contractName:
      ContractNames.LockKeeper +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "LockKeeper",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
    isUpgradeableProxy: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName:
      ContractNames.ServerNodesManagerRewardsBank +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  const onboardingDelay = 0;
  const unstakeLockTime = 0;
  const minStakeAmount = ethers.utils.parseEther("1000000"); // 1M AMB

  const manager = await deploy<ServerNodes_Manager__factory>({
    contractName:
      ContractNames.ServerNodesManager +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "ServerNodes_Manager",
    deployArgs: [
      validatorSet.address,
      lockKeeper.address,
      rewardsBank.address,
      airBond.address,
      treasury.address,
      onboardingDelay,
      unstakeLockTime,
      minStakeAmount,
    ],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), manager.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await manager.grantRole(await manager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address)).wait();
  await (await validatorSet.addBlockListener(manager.address)).wait();
  await (await validatorSet.addBlockListener(lockKeeper.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
