import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {
  BaseNodes_Manager__factory,
  Multisig__factory,
  RewardsBank__factory,
  ValidatorSet,
} from "../../typechain-types";
import {Roadmap2023MultisigSettings} from "../addresses";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
   if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
     chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
   }

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const treasury = loadDeployment(ContractNames.Treasury, chainId);

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.BaseNodesManagerMultisig,
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.BaseNodesManagerRewardsBank,
    networkId: chainId,
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
