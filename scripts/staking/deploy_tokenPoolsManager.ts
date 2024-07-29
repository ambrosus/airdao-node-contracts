import { ethers, upgrades } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";

import { ContractNames } from "../../src";

import {
  TokenPoolsManager__factory,
  Multisig__factory,
  RewardsBank__factory,
  TokenPoolBeacon__factory,
  TokenPool__factory,
} from "../../typechain-types";
import {Roadmap2023MultisigSettings} from "../addresses";
export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();


  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.TokenPoolsManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.TokenPoolsManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });
    
  const tokenPoolFactory = await ethers.getContractFactory("TokenPool");
  const tokenPoolBeacon = await upgrades.deployBeacon(tokenPoolFactory);

  const poolsManager = await deploy<TokenPoolsManager__factory>({
    contractName: ContractNames.TokenPoolsManager,
    artifactName: "TokenPoolsManager",
    deployArgs: [rewardsBank.address, tokenPoolBeacon.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await poolsManager.grantRole(await poolsManager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
