import { ethers } from "hardhat";
import {
  Catalogue__factory,
  Context__factory,
  Head,
  LegacyPoolsNodes_Manager__factory,
  Multisig__factory,
  StorageCatalogue__factory,
} from "../../typechain-types";
import { deploy, loadDeployment } from "deployments";
import { ContractNames } from "../../src";

const HEAD = "0x0000000000000000000000000000000000000F10";

const configAbi = ["function APOLLO_DEPOSIT() view returns (uint)"];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.LegacyPoolManagerMultisig,
    artifactName: "Multisig",
    deployArgs: [[deployer.address], [true], 75, masterMultisig],
    signer: deployer,
  });

  const head: Head = await ethers.getContractAt("Head", HEAD);
  const oldContext = Context__factory.connect(await head.context(), deployer);
  const oldCatalogue = Catalogue__factory.connect(await oldContext.catalogue(), deployer);
  const oldStorageCatalogue = StorageCatalogue__factory.connect(await oldContext.storageCatalogue(), deployer);

  const minApolloDeposit = await new ethers.Contract(await oldCatalogue.config(), configAbi, deployer).APOLLO_DEPOSIT();

  const manager = await deploy<LegacyPoolsNodes_Manager__factory>({
    contractName: ContractNames.LegacyPoolManager,
    artifactName: "LegacyPoolsNodes_Manager",
    deployArgs: [
      minApolloDeposit,
      validatorSet.address,
      await oldStorageCatalogue.poolsStore(),
      await oldStorageCatalogue.apolloDepositStore(),
      await oldStorageCatalogue.rolesEventEmitter(),
      await oldStorageCatalogue.poolEventsEmitter(),
    ],
    signer: deployer,
  });

  await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address);

  // await (await manager.transferOwnership(multisig.address)).wait();
  // console.log("transferred ownership to multisig", multisig.address);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
