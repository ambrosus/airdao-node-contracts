import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy, loadDeployment } from "deployments";
import { BaseNodes_Manager__factory, Multisig__factory } from "../../typechain-types";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>(
    ContractNames.BaseNodesManagerMultisig,
    chainId,
    "Multisig",
    [[deployer.address], [true], 75, masterMultisig],
    deployer
  );

  const manager = await deploy<BaseNodes_Manager__factory>(
    ContractNames.BaseNodesManager,
    chainId,
    "BaseNodes_Manager",
    [multisig.address, validatorSet.address],
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
