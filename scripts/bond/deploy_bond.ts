import { ethers } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
import { Multisig__factory, Finance__factory } from "../../typechain-types";
import { Roadmap2023MultisigSettings } from "../addresses";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.BondMarketplaceMultisig,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await deploy<Finance__factory>({
    contractName: ContractNames.BondMarketplaceTreasury,
    artifactName: "Finance",
    signer: deployer,
    deployArgs: [multisig.address],
    loadIfAlreadyDeployed: true,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
