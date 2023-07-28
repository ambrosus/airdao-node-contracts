import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { LockKeeper__factory, Multisig__factory, ServerNodes_Manager__factory } from "../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const airBond = loadDeployment(ContractNames.AirBond, chainId);

  const lockKeeper = await deploy<LockKeeper__factory>({
    contractName: ContractNames.LockKeeper,
    artifactName: "LockKeeper",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });
  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.ServerNodesManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [[deployer.address], [true], 75, masterMultisig],
    signer: deployer,
  });
  const onboardingDelay = 15 * 24 * 60 * 60; // 15d
  const unstakeLockTime = 15 * 24 * 60 * 60; // 15d
  const minStakeAmount = ethers.utils.parseEther("1000"); // 1000 AMB

  const manager = await deploy<ServerNodes_Manager__factory>({
    contractName: ContractNames.ServerNodesManager,
    artifactName: "ServerNodes_Manager",
    deployArgs: [
      validatorSet.address,
      lockKeeper.address,
      airBond.address,
      onboardingDelay,
      unstakeLockTime,
      minStakeAmount,
    ],
    signer: deployer,
    isUpgradeableProxy: true,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
