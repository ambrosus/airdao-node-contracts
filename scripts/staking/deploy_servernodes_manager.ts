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

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const airBond = loadDeployment(ContractNames.AirBond, chainId);
  const treasury = loadDeployment(ContractNames.Treasury, chainId);

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.ServerNodesManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
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

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.ServerNodesManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  const onboardingDelay = 0;
  const unstakeLockTime = 0;
  const minStakeAmount = ethers.utils.parseEther("1000000"); // 1M AMB

  const manager = await deploy<ServerNodes_Manager__factory>({
    contractName: ContractNames.ServerNodesManager,
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
