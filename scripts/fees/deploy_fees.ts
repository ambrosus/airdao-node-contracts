import {deploy, loadDeployment} from "@airdao/deployments/deploying";
import {ethers} from "hardhat";
import {Fees__factory, Finance__factory, Multisig__factory} from "../../typechain-types";
import {ContractNames} from "../../src";
import {Roadmap2023MultisigSettings} from "../addresses";
import { MultisigVersions } from "../../src/contracts/names";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  // if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
  //   chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  // }

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(
    ContractNames.MasterMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  ).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.FeesMultisig+ (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const treasure = await deploy<Finance__factory>({
    contractName: ContractNames.FeesTreasure + (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Finance",
    deployArgs: [multisig.address],
    signer: deployer,
  });

  const gasPrice = 10;
  const payAddress = treasure.address;
  const feePercent = 300000;

  const fees = await deploy<Fees__factory>({
    contractName: ContractNames.Fees + (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Fees",
    deployArgs: [gasPrice, payAddress, feePercent],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await (await fees.grantRole(await fees.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
