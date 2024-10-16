import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { BaseNodes_Manager__factory, RewardsBank__factory, ValidatorSet, } from "../../typechain-types";
import { deployMultisig } from "../utils/deployMultisig";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const treasury = loadDeployment(ContractNames.Treasury, chainId);

  const multisig = await deployMultisig(ContractNames.BaseNodesManagerMultisig, deployer, "common");

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.BaseNodesManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  const manager = await deploy<BaseNodes_Manager__factory>({
    contractName: ContractNames.BaseNodesManager,
    artifactName: "BaseNodes_Manager",
    deployArgs: [validatorSet.address, rewardsBank.address, treasury.address],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), manager.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await manager.grantRole(await manager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
