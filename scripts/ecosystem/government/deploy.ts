import { ethers, network } from "hardhat";
import { ContractNames } from "../../../src";
import { Multisig__factory } from "../../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { DimaTest96, EcosystemMultisigSettings, SharedDev, } from "../../addresses";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.Ecosystem_MasterMultisig, chainId).address;

  const multisigSettings: [string[], boolean[], number] =
    network.name == "main"
      ? EcosystemMultisigSettings as ([string[], boolean[], number])
      : [[SharedDev, DimaTest96], [true, true], 1];

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.Ecosystem_GovernmentMultisig,
    artifactName: "Multisig",
    deployArgs: [...multisigSettings, masterMultisig],
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
