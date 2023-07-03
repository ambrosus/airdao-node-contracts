import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { deploy } from "../src/dev/deploy";
import { Multisig__factory, ValidatorSet__factory } from "../typechain-types";
import { chainIDToName, loadDeployment } from "../src/utils/deployments";

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const networkName = chainIDToName[chainId];

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, networkName).address;

  const multisig = await deploy<Multisig__factory>(
    ContractNames.ValidatorSetMultisig,
    networkName,
    "Multisig",
    [[deployer.address], [true], 75, masterMultisig],
    deployer
  );

  // todo
  const validatorSet = await deploy<ValidatorSet__factory>(
    ContractNames.ValidatorSet,
    networkName,
    "ValidatorSet",
    [deployer.address, deployer.address, 1, 200],
    deployer,
    false,
    true
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
