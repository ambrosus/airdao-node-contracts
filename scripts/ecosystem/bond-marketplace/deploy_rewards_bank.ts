import { ethers, network } from "hardhat";
import { ContractNames } from "../../../src";
import { Multisig__factory, RewardsBank__factory } from "../../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {
  Alex,
  Alina,
  DimaTest96,
  Igor,
  Matthieu,
  Michael,
  Oleksii,
  OleksiiD,
  Seth,
  SharedDev,
  Sophie,
} from "../../addresses";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.Ecosystem_MasterMultisig, chainId).address;

  const multisigSettings: [string[], boolean[], number] =
    network.name == "main"
      ? [
        [Michael, Igor, Alina, Alex, Matthieu, Oleksii, Seth, Sophie, OleksiiD],
        [true, true, true, true, true, true, true, true, true],
        75,
      ]
      : [[SharedDev, DimaTest96], [true, true], 1];

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.Ecosystem_BondMarketplaceMultisig,
    artifactName: "Multisig",
    deployArgs: [...multisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_BondMarketplaceRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
