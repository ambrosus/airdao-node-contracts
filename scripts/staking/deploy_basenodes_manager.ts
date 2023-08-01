import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {
  BaseNodes_Manager__factory,
  Multisig__factory,
  RewardsBank__factory,
  ValidatorSet,
} from "../../typechain-types";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const airBond = loadDeployment(ContractNames.AirBond, chainId);

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.BaseNodesManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [[deployer.address], [true], 75, masterMultisig],
    signer: deployer,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.BaseNodesManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [airBond.address],
    signer: deployer,
  });

  const manager = await deploy<BaseNodes_Manager__factory>({
    contractName: ContractNames.BaseNodesManager,
    artifactName: "BaseNodes_Manager",
    deployArgs: [validatorSet.address, rewardsBank.address],
    signer: deployer,
  });

  await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), manager.address);
  await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address);
  await manager.grantRole(await manager.DEFAULT_ADMIN_ROLE(), multisig.address);
  await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
