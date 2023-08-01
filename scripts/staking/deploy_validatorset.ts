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
  });

  // todo
  const validatorSet = await deploy<ValidatorSet__factory>({
    contractName: ContractNames.ValidatorSet,
    artifactName: "ValidatorSet",
    deployArgs: [deployer.address, 1, 200],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await validatorSet.grantRole(await validatorSet.DEFAULT_ADMIN_ROLE(), multisig.address);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
