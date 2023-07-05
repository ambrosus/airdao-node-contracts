import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { deploy } from "../src/dev/deploy";
import { BaseNodes_Manager__factory, Multisig__factory } from "../typechain-types";
import { loadDeployment } from "../src/utils/deployments";

async function main() {
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
