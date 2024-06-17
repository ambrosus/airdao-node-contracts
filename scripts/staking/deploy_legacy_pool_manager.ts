import {ethers} from "hardhat";
import {
  Context__factory,
  Head,
  LegacyPoolsNodes_Manager__factory,
  Multisig__factory,
  RewardsBank__factory,
  StorageCatalogue__factory,
  ValidatorSet,
} from "../../typechain-types";
import {deploy, loadDeployment} from "@airdao/deployments/deploying";
import {ContractNames} from "../../src";
import {Roadmap2023MultisigSettings} from "../addresses";
import { MultisigVersions } from "../../src/contracts/names";

const HEAD = "0x0000000000000000000000000000000000000F10";

async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  //  if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
  //    chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  //  }

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(
    ContractNames.ValidatorSet +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId,
    deployer
  ) as ValidatorSet;
  const masterMultisig = loadDeployment(
    ContractNames.MasterMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  ).address;
  const treasury = loadDeployment(
    ContractNames.Treasury +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    chainId
  );

  const multisig = await deploy<Multisig__factory>({
    contractName:
      ContractNames.LegacyPoolManagerMultisig +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName:
      ContractNames.LegacyPoolManagerRewardsBank +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  const head: Head = await ethers.getContractAt("Head", HEAD);
  const oldContext = Context__factory.connect(await head.context(), deployer);
  const oldStorageCatalogue = StorageCatalogue__factory.connect(await oldContext.storageCatalogue(), deployer);

  const manager = await deploy<LegacyPoolsNodes_Manager__factory>({
    contractName:
      ContractNames.LegacyPoolManager +
      (process.env.MULTISIGS && process.env.MULTISIGS !== MultisigVersions.common ? `_${process.env.MULTISIGS}` : ""),
    networkId: chainId,
    artifactName: "LegacyPoolsNodes_Manager",
    deployArgs: [
      validatorSet.address,
      rewardsBank.address,
      treasury.address,
      await oldStorageCatalogue.poolsStore(),
      await oldStorageCatalogue.apolloDepositStore(),
      await oldStorageCatalogue.rolesEventEmitter(),
      await oldStorageCatalogue.poolEventsEmitter(),
    ],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), manager.address)).wait();
  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address)).wait();

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
