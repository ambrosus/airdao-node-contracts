import { ethers } from "hardhat";
import {
  ApolloDepositStore__factory,
  Catalogue,
  Catalogue__factory,
  Context__factory,
  Head,
  LegacyPoolsNodes_Manager__factory,
  Multisig__factory,
  StorageCatalogue,
  StorageCatalogue__factory,
} from "../typechain-types";
import { BigNumber, Signer } from "ethers";
import { loadDeployment } from "../src/utils/deployments";
import { ContractNames } from "../src";
import { deploy } from "../src/dev/deploy";

const HEAD = "0x0000000000000000000000000000000000000F10";
const VALIDATOR_SET = "0x0000000000000000000000000000000000000F00";

const configAbi = ["function APOLLO_DEPOSIT() view returns (uint)"];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>(
    ContractNames.LegacyPoolManagerMultisig,
    chainId,
    "Multisig",
    [[deployer.address], [true], 75, masterMultisig],
    deployer
  );

  const head: Head = await ethers.getContractAt("Head", HEAD);
  const oldContext = Context__factory.connect(await head.context(), deployer);
  const oldCatalogue = Catalogue__factory.connect(await oldContext.catalogue(), deployer);
  const oldStorageCatalogue = StorageCatalogue__factory.connect(await oldContext.storageCatalogue(), deployer);

  const minApolloDeposit = await new ethers.Contract(await oldCatalogue.config(), configAbi, deployer).APOLLO_DEPOSIT();

  const manager = await deploy<LegacyPoolsNodes_Manager__factory>(
    ContractNames.LegacyPoolManager,
    chainId,
    "LegacyPoolsNodes_Manager",
    [
      minApolloDeposit,
      validatorSet.address,
      await oldStorageCatalogue.poolsStore(),
      await oldStorageCatalogue.apolloDepositStore(),
      await oldStorageCatalogue.rolesEventEmitter(),
      await oldStorageCatalogue.poolEventsEmitter(),
    ],
    deployer,
    false
  );

  await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address);

  const oldStakes = await getOldStakes(await oldStorageCatalogue.apolloDepositStore());
  console.log("importing old stakes", oldStakes);
  await (await manager.importOldStakes(Object.keys(oldStakes), Object.values(oldStakes))).wait();
  console.log("imported old stakes");

  await (await manager.transferOwnership(multisig.address)).wait();
  console.log("transferred ownership to multisig", multisig.address);

  await deployNewContext(oldCatalogue, oldStorageCatalogue, manager.address, deployer);
}

async function getOldStakes(depositStoreAddr: string) {
  const [owner] = await ethers.getSigners();
  const depositStore = ApolloDepositStore__factory.connect(depositStoreAddr, owner.provider!);
  const validatorSet = new ethers.Contract(VALIDATOR_SET, ["function getValidators() view returns (address[])"], owner);

  const addresses = await validatorSet.getValidators();

  const stakes: { [addr: string]: BigNumber } = {};
  for (const addr of addresses) {
    if (!(await depositStore.isDepositing(addr))) continue;
    stakes[addr] = await depositStore.callStatic.releaseDeposit(addr, owner.address, {
      from: depositStore.address,
    });
  }

  return stakes;
}

async function deployNewContext(
  oldCatalogue: Catalogue,
  oldStorageCatalogue: StorageCatalogue,
  newManagerAddr: string,
  deployer: Signer
) {
  const catalogueArgs = [
    await oldCatalogue.kycWhitelist(),
    await oldCatalogue.roles(),
    await oldCatalogue.fees(),
    await oldCatalogue.time(),
    await oldCatalogue.challenges(),
    await oldCatalogue.payouts(),
    await oldCatalogue.shelteringTransfers(),
    await oldCatalogue.sheltering(),
    await oldCatalogue.uploads(),
    await oldCatalogue.config(),
    await oldCatalogue.validatorProxy(),
    newManagerAddr,
  ] as const;
  const catalogue = await new Catalogue__factory(deployer).deploy(...catalogueArgs);
  await catalogue.deployed();
  console.log("catalogue deployed to:", catalogue.address);

  const storageCatalogueArgs = [
    await oldStorageCatalogue.apolloDepositStore(),
    await oldStorageCatalogue.atlasStakeStore(),
    await oldStorageCatalogue.bundleStore(),
    await oldStorageCatalogue.challengesStore(),
    await oldStorageCatalogue.kycWhitelistStore(),
    await oldStorageCatalogue.payoutsStore(),
    await oldStorageCatalogue.rolesStore(),
    await oldStorageCatalogue.shelteringTransfersStore(),
    await oldStorageCatalogue.rolesEventEmitter(),
    await oldStorageCatalogue.transfersEventEmitter(),
    await oldStorageCatalogue.challengesEventEmitter(),
    await oldStorageCatalogue.rewardsEventEmitter(),
    await oldStorageCatalogue.poolsStore(),
    await oldStorageCatalogue.poolEventsEmitter(),
    await oldStorageCatalogue.nodeAddressesStore(),
    await oldStorageCatalogue.rolesPrivilagesStore(),
  ] as const;
  const storageCatalogue = await new StorageCatalogue__factory(deployer).deploy(...storageCatalogueArgs);
  await storageCatalogue.deployed();
  console.log("storageCatalogue deployed to:", storageCatalogue.address);

  const context = await new Context__factory(deployer).deploy(
    [...catalogueArgs, ...storageCatalogueArgs],
    catalogue.address,
    storageCatalogue.address,
    "0.1.0"
  );
  await context.deployed();
  console.log("context deployed to:", context.address);
  console.log(`Use "source .env && yarn task changeContext ${context.address}" in ambrosus-node-contracts repo`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
