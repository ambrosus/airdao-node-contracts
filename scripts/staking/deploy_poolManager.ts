import { ethers } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";

import { ContractNames } from "../../src";

import {
  PoolsManager__factory,
  Multisig__factory,
  RewardsBank__factory,
} from "../../typechain-types";
import {Roadmap2023MultisigSettings} from "../addresses";
export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();


  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.PoolManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.PoolManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  const poolsManager = await deploy<PoolsManager__factory>({
    contractName: ContractNames.PoolManager,
    artifactName: "PoolsManager",
    deployArgs: [rewardsBank.address],
    signer: deployer,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await poolsManager.transferOwnership(multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
