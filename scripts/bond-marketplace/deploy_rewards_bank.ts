import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { Multisig__factory, RewardsBank__factory } from "../../typechain-types";
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
} from "../addresses";
import { MultisigVersions } from "../../src/contracts/names";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  // if (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common) {
  //   chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  // }
  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(
    ContractNames.MasterMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  ).address;

  const multisigSettings: [string[], boolean[], number] =
    network.name == "main"
      ? [
        [Michael, Igor, Alina, Alex, Matthieu, Oleksii, Seth, Sophie, OleksiiD],
        [true, true, true, true, true, true, true, true, true],
        75,
      ]
      : [[SharedDev, DimaTest96], [true, true], 1];

  const multisig = await deploy<Multisig__factory>({
    contractName:
      ContractNames.BondMarketplaceMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...multisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName:
      ContractNames.BondMarketplaceRewardsBank +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
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
