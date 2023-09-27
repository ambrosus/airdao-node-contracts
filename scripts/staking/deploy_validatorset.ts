import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { Multisig__factory, ValidatorSet__factory } from "../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.ValidatorSetMultisig,
    artifactName: "Multisig",
    deployArgs: [[deployer.address], [true], 75, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  // todo
  // todo get block rewards from legacy fee contract
  const validatorSet = await deploy<ValidatorSet__factory>({
    contractName: ContractNames.ValidatorSet,
    artifactName: "ValidatorSet",
    deployArgs: [deployer.address, 1, 200],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  const elasticRewardsSetterAddress = "0xb0857e3203f9e392c83f746da9a6a2ddeb6b69af"; //TODO change it for mainnet

  await (await validatorSet.grantRole(await validatorSet.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.REWARD_ORACLE_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.REWARD_ORACLE_ROLE(), elasticRewardsSetterAddress)).wait();
  //384cbfc4a2218ab4a5ba81e6888073ad97f98f7f7a4ff52f3c6c0eb5407fee6b
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
