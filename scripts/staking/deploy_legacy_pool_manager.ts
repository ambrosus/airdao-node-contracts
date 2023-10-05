import { ethers } from "hardhat";
import {
  Catalogue__factory,
  Context__factory,
  Head,
  LegacyPoolsNodes_Manager__factory,
  Multisig__factory,
  RewardsBank__factory,
  StorageCatalogue__factory,
  ValidatorSet,
} from "../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";

const HEAD = "0x0000000000000000000000000000000000000F10";

const configAbi = ["function APOLLO_DEPOSIT() view returns (uint)"];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  const treasury = loadDeployment(ContractNames.Treasury, chainId);

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.LegacyPoolManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [[deployer.address], [true], 75, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.LegacyPoolManagerRewardsBank,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
  });

  const head: Head = await ethers.getContractAt("Head", HEAD);
  const oldContext = Context__factory.connect(await head.context(), deployer);
  const oldStorageCatalogue = StorageCatalogue__factory.connect(await oldContext.storageCatalogue(), deployer);

  const manager = await deploy<LegacyPoolsNodes_Manager__factory>({
    contractName: ContractNames.LegacyPoolManager,
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

  // await (await manager.transferOwnership(multisig.address)).wait();
  // console.log("transferred ownership to multisig", multisig.address);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
