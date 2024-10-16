import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {
  LiquidNodesManager__factory,
  LiquidPool__factory,
  LockKeeper__factory,
  RewardsBank__factory,
  StakingTiers__factory,
  StAMB__factory,
  Treasury__factory,
  ValidatorSet,
} from "../../../typechain-types";
import { wrapProviderToError } from "../../../src/utils/AmbErrorProvider";

import { parse } from "csv-parse/sync";
import fs from "fs";
import { deployMultisig } from "../../utils/deployMultisig";

interface AccountData {
  address: string;
  balance: bigint;
  lastZeroBalanceTimestamp: number;
}

export async function main() {
  const {chainId} = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

  console.log();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const airBond = loadDeployment(ContractNames.AirBond, chainId);

  const multisig = await deployMultisig(ContractNames.Ecosystem_LiquidPoolMultisig, deployer, "eco");

  // block rewards will be withdrawn from this contract
  const nodesRewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_LiquidNodesManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  // block rewards will be transferred to this contract (except fees)
  const nodesRewardsTreasury = await deploy<Treasury__factory>({
    contractName: ContractNames.Ecosystem_LiquidNodesManagerTreasury,
    artifactName: "Treasury",
    signer: deployer,
    deployArgs: [multisig.address, 0],
    loadIfAlreadyDeployed: true,
  });

  // fees from block rewards will be transferred to this contract
  const nodesRewardsTreasuryFees = await deploy<Treasury__factory>({
    contractName: ContractNames.Ecosystem_LiquidNodesManagerTreasuryFees,
    artifactName: "Treasury",
    signer: deployer,
    deployArgs: [
      multisig.address,
      0.10 * 10000, // 10% fee
    ],
    loadIfAlreadyDeployed: true,
  });


  // staking rewards and interest will be withdrawn from this contract
  const poolRewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_LiquidPoolRewardsBank,
    artifactName: "RewardsBank",
    signer: deployer,
    deployArgs: [],
    loadIfAlreadyDeployed: true,
  });


  const stAmb = await deploy<StAMB__factory>({
    contractName: ContractNames.Ecosystem_LiquidPoolStAMB,
    artifactName: "StAMB",
    signer: deployer,
    deployArgs: [],
    loadIfAlreadyDeployed: true,
  });


  const stakingTiers = await deploy<StakingTiers__factory>({
    contractName: ContractNames.Ecosystem_LiquidPoolStakingTiers,
    artifactName: "StakingTiers",
    deployArgs: [stAmb.address],
    signer: deployer,
    isUpgradeableProxy: true,
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

  const nodeStake = ethers.utils.parseEther("1000");
  const maxNodesCount = 3;

  const nodeManager = await deploy<LiquidNodesManager__factory>({
    contractName: ContractNames.Ecosystem_LiquidNodesManager,
    artifactName: "LiquidNodesManager",
    deployArgs: [
      validatorSet.address,
      nodesRewardsBank.address,
      nodesRewardsTreasury.address,
      nodesRewardsTreasuryFees.address,
      nodeStake,
      maxNodesCount
    ],
    signer: deployer,
    isUpgradeableProxy: true,
    loadIfAlreadyDeployed: true,
  });


  const interest = 5707; // 5% per year
  const interestRate = 60 * 60; // one hour
  const minStakeValue = ethers.utils.parseEther("100");
  const unstakeLockTime = 2 * 60 * 60; // 2 hours
  const penalty = 0.1 * 1_000_000_000; // 10%

  const liquidPool = await deploy<LiquidPool__factory>({
    contractName: ContractNames.Ecosystem_LiquidPool,
    artifactName: "LiquidPool",
    deployArgs: [
      nodeManager.address,
      poolRewardsBank.address,
      stakingTiers.address,
      lockKeeper.address,
      airBond.address,
      stAmb.address,
      interest,
      interestRate,
      minStakeValue,
      unstakeLockTime,
      penalty
    ],
    signer: deployer,
    isUpgradeableProxy: true,
    loadIfAlreadyDeployed: true,
  });

  console.log("Setup stAmb");
  await (await stAmb.setLiquidPool(liquidPool.address)).wait();
  await (await stAmb.grantRole(await stAmb.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  console.log("Setup nodeManager");
  await (await nodeManager.grantRole(await nodeManager.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await nodeManager.grantRole(await nodeManager.POOL_ROLE(), liquidPool.address)).wait();

  console.log("Setup nodesRewardsBank");
  await (await nodesRewardsBank.grantRole(await nodesRewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await nodesRewardsBank.grantRole(await nodesRewardsBank.DEFAULT_ADMIN_ROLE(), nodeManager.address)).wait();

  console.log("Setup poolRewardsBank");
  await (await poolRewardsBank.grantRole(await poolRewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await poolRewardsBank.grantRole(await poolRewardsBank.DEFAULT_ADMIN_ROLE(), liquidPool.address)).wait();

  console.log("Setup liquidPool");
  await (await liquidPool.grantRole(await liquidPool.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  console.log("Setup stakingTiers");
  await (await stakingTiers.grantRole(await stakingTiers.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  // on prod - multisig only
  if (chainId != 16718) {
    console.log("Register nodeManager as staking manager");
    await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), nodeManager.address)).wait();
    console.log("Add block listeners");
    await (await validatorSet.addBlockListener(liquidPool.address)).wait();
  } else {
    console.log("Register nodeManager as staking manager calldata");
    const calldata = await validatorSet.populateTransaction.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), nodeManager.address);
    const multisigTx = await multisig.populateTransaction.submitTransaction(validatorSet.address, 0, calldata.data!);
    console.log(multisigTx);
    console.log("Add block listeners calldata");
    const calldata2 = await validatorSet.populateTransaction.addBlockListener(liquidPool.address);
    const multisigTx2 = await multisig.populateTransaction.submitTransaction(validatorSet.address, 0, calldata2.data!);
    console.log(multisigTx2);
  }

  if (chainId != 16718) return;  // continue only on prod

  console.log("Setup bonuses");
  const bonuses = getBonuses();
  console.log("Setting first batch");
  await (await stakingTiers.setBonusBatch(Array.from(bonuses[0].keys()), Array.from(bonuses[0].values()))).wait();
  console.log("Setting second batch");
  await (await stakingTiers.setBonusBatch(Array.from(bonuses[1].keys()), Array.from(bonuses[1].values()))).wait();
  console.log("Bonuses set");

  //grant backend role 
  console.log("Grant backend role");
  const backendAddress = process.env.LIQUID_STAKING_BACKEND_ADDRESS || "";
  await (await nodeManager.grantRole(await nodeManager.BACKEND_ROLE(), backendAddress)).wait();
  console.log("Backend role granted");

  console.log("Revoke admin roles");
  await (await nodesRewardsBank.revokeRole(await nodesRewardsBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  await (await poolRewardsBank.revokeRole(await poolRewardsBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  await (await nodeManager.revokeRole(await nodeManager.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  await (await liquidPool.revokeRole(await liquidPool.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  await (await stakingTiers.revokeRole(await stakingTiers.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

}

function getBonuses(): [Map<string, number>, Map<string, number>] {
  const filePath = "./scripts/ecosystem/liquid_staking/staking_holders.csv";
  const bonusMap1 = new Map<string, number>();
  const bonusMap2 = new Map<string, number>();
  const currentTime = Math.floor(Date.now() / 1000);
  const thereeYearsInSeconds = 3 * 365 * 24 * 60 * 60;

  const csvData = fs.readFileSync(filePath, "utf8");

  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  }) as AccountData[];

  for (const record of records) {
    const stakingTime = currentTime - record.lastZeroBalanceTimestamp;
    const bonus = Math.floor((stakingTime * 75) / thereeYearsInSeconds);
    if (bonusMap1.size < 1200) { 
      bonusMap1.set(record.address, bonus);
    } else {
      bonusMap2.set(record.address, bonus);
    }
  }

  return [bonusMap1, bonusMap2];
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
