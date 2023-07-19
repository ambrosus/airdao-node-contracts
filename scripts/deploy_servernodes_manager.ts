import { ethers } from "hardhat";
import { ContractNames } from "../src";
// @ts-ignore
import { loadDeployment } from "deployments/dist/deployments.js";
import { LockKeeper__factory, Multisig__factory, ServerNodes_Manager__factory } from "../typechain-types";
// @ts-ignore
import { deploy } from "deployments/dist/deploy.js";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const airBond = loadDeployment(ContractNames.AirBond, chainId);

  const lockKeeper = await deploy<LockKeeper__factory>(
    ContractNames.LockKeeper,
    chainId,
    "LockKeeper",
    [],
    deployer,
    true
  );

  const multisig = await deploy<Multisig__factory>(
    ContractNames.ServerNodesManagerMultisig,
    chainId,
    "Multisig",
    [[deployer.address], [true], 75, masterMultisig],
    deployer
  );

  const onboardingDelay = 15 * 24 * 60 * 60; // 15d
  const unstakeLockTime = 15 * 24 * 60 * 60; // 15d
  const minStakeAmount = ethers.utils.parseEther("1000"); // 1000 AMB

  const manager = await deploy<ServerNodes_Manager__factory>(
    ContractNames.ServerNodesManager,
    chainId,
    "ServerNodes_Manager",
    [
      validatorSet.address,
      lockKeeper.address,
      airBond.address,
      multisig.address,
      onboardingDelay,
      unstakeLockTime,
      minStakeAmount,
    ],
    deployer,
    false
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
