import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ethers } from "hardhat";
import { EcosystemMultisigSettings } from "../../addresses";
import { ContractNames } from "../../../src";
import { Multisig__factory, RewardsBank__factory } from "../../../typechain-types";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.Ecosystem_MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.Ecosystem_AstradexMultisig,
    artifactName: "Multisig",
    deployArgs: [...EcosystemMultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
