import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {
  LiquidPool__factory,
  Multisig__factory,
  RewardsBank__factory,
  StakingTiers__factory,
  NodeManager__factory,
  ValidatorSet,
} from "../../typechain-types";
import { Roadmap2023MultisigSettings } from "../addresses";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const treasury = loadDeployment(ContractNames.Treasury, chainId);

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.LiquidPoolMultisig,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.LiquidPoolRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  // OPTIONAL: Add the tiers data
  //TODO: Get the tiers data 
  const tiers: number[] = []; // list of percentages of the bond reward for each address
  const addresses: string[] = []; // list of addresses 
  // the tiers list length must be equal to the address list length

  const stakingTiers = await deploy<StakingTiers__factory>({
    contractName: ContractNames.StakingTiers,
    artifactName: "StakingTiers",
    deployArgs: [addresses, tiers],
    signer: deployer,
  });

  const nodeStake = 5000000;
  const maxNodesCount = 10;

  const nodeManager = await deploy<NodeManager__factory>({
    contractName: ContractNames.NodeManager,
    artifactName: "NodeManager",
    deployArgs: [validatorSet.address, rewardsBank.address, treasury.address, nodeStake, maxNodesCount],
    signer: deployer,
  });

  const interest = 100000;
  const interestRate = 24 * 60 * 60; // 24 hours
  const minStakeValue = 10000;
  const bondAddress = "";
  const lockPeriod = 30 * 24 * 60 * 60; // 30 days

  const liquidPool = await deploy<LiquidPool__factory>({
    contractName: ContractNames.LiquidPool,
    artifactName: "Pool",
    deployArgs: [
      nodeManager.address,
      rewardsBank.address,
      stakingTiers.address,
      interest,
      interestRate,
      nodeStake,
      bondAddress,
      lockPeriod,
    ],
    signer: deployer,
  });
  
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), liquidPool.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await liquidPool.grantRole(await liquidPool.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), liquidPool.address)).wait();
  await (await stakingTiers.grantRole(await stakingTiers.DEFAULT_ADMIN_ROLE(), liquidPool.address)).wait();
  await (await nodeManager.grantRole(await nodeManager.DEFAULT_ADMIN_ROLE(), liquidPool.address)).wait();
  await (await nodeManager.grantRole(await nodeManager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
}


if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
