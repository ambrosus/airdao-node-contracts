import { ethers } from "hardhat";
import path from "path";
import fs from "fs";

import { main as deployMultisig } from "./deploy_multisig";
import { main as deployValidatorset } from "./deploy_validatorset";
import { ContractNames } from "../src";
import { BaseNodes_Manager, BaseNodes_Manager__factory, ValidatorSet } from "../typechain-types";
// @ts-ignore
import { deploy } from "deployments/dist/deploy.js";
// @ts-ignore
import { loadDeployment } from "deployments/dist/deployments.js";

const TRANSITION_ADDRESS = "0x9e4D66bdF08FF38A75C619A345007Ca5eb9A2e05";
const TRANSITION_BLOCK = 15;

async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  if (chainId != 0x1488) throw new Error("This script should be run on local network");

  const [v1, v2, v3] = await ethers.getSigners();
  // v1 = await AmbErrorProviderWrapSigner(v1);

  const startBlock = await ethers.provider.getBlockNumber();
  if (startBlock >= TRANSITION_BLOCK - 1)
    throw new Error(`This script should be run before transition block (${TRANSITION_BLOCK}}`);
  console.log("Start block:", startBlock);

  ethers.provider.on("block", async (blockNumber) => {
    const block = await ethers.provider.getBlock(blockNumber);
    console.log("Block:", blockNumber, "validator", block.miner);
  });

  // clear deployments
  const deploymentPath = path.resolve(__dirname, `../deployments/${chainId}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify({}, null, 2));

  const ozUpgradeCachePath = path.resolve(__dirname, `../.openzeppelin/unknown-${chainId}.json`);
  fs.rmSync(ozUpgradeCachePath, { force: true });

  // deploy new contracts

  await deployMultisig();
  await deployValidatorset();

  //

  const validatorSet = (await loadDeployment(ContractNames.ValidatorSet, chainId, v1)) as ValidatorSet;
  if (validatorSet.address != TRANSITION_ADDRESS)
    throw new Error(
      "ValidatorSet address is not the same as in the chain.json file. Are deployer addresses the same? Are nonce the same?"
    );

  // setup manager

  const baseNodesManager = await deploy<BaseNodes_Manager__factory>(
    ContractNames.BaseNodesManager,
    chainId,
    "BaseNodes_Manager",
    [v1.address, validatorSet.address],
    v1,
    false
  );
  await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), baseNodesManager.address)).wait();

  // add validators
  console.log("Adding validators");
  await (await baseNodesManager.addStake(v1.address, { value: ethers.utils.parseEther("100") })).wait();
  console.log("1/3");
  await (await baseNodesManager.addStake(v2.address, { value: ethers.utils.parseEther("100") })).wait();
  console.log("2/3");
  const { blockNumber } = await (
    await baseNodesManager.addStake(v3.address, { value: ethers.utils.parseEther("100") })
  ).wait();
  console.log("3/3");

  // finalize validators and wait for transition block
  console.log("unfinalized validators", await validatorSet.getTopStakes());
  await (await validatorSet.connect(v1).finalizeChange()).wait();
  console.log("finalized validators", await validatorSet.getValidators());

  console.log("Finish initialisation at block", blockNumber, ". Waiting for transition block", TRANSITION_BLOCK);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
