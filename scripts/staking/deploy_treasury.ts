import { ethers } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
import { Multisig__factory, Treasury__factory } from "../../typechain-types";

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.TreasuryMultisig,
    artifactName: "Multisig",
    deployArgs: [[deployer.address], [true], 75, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await deploy<Treasury__factory>({
    contractName: ContractNames.Treasury,
    artifactName: "Treasury",
    signer: deployer,
    deployArgs: [
      multisig.address,
      0.1 * 10000, // 10% fee
    ],
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
