import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { deploy } from "../src/dev/deploy";
import { BaseNodes_Manager__factory, Multisig__factory } from "../typechain-types";
import { chainIDToName, loadDeployment } from "../src/utils/deployments";

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const networkName = chainIDToName[chainId];

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, networkName, deployer);
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, networkName).address;

  const multisig = await deploy<Multisig__factory>(
    ContractNames.BaseNodesManagerMultisig,
    networkName,
    "Multisig",
    [[deployer.address], [true], 75, masterMultisig],
    deployer
  );

  const manager = await deploy<BaseNodes_Manager__factory>(
    ContractNames.BaseNodesManager,
    networkName,
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
