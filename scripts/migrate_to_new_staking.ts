import { ethers, network } from "hardhat";
import {
  ApolloDepositStore__factory,
  Catalogue,
  Catalogue__factory,
  Context__factory,
  Head,
  LegacyPool__factory,
  PoolsStore__factory,
  RolesEventEmitter__factory,
  StorageCatalogue,
  StorageCatalogue__factory,
} from "../typechain-types";
import { BigNumber, Signer } from "ethers";
// @ts-ignore
import { loadDeployment } from "deployments/dist/deployments.js";
// @ts-ignore
import { deploy } from "deployments/dist/deploy.js";

const HEAD = "0x0000000000000000000000000000000000000F10";
const VALIDATOR_SET = "0x0000000000000000000000000000000000000F00";

const validatorSetAbi = ["function getValidators() view returns (address[])"];

interface NodeInfo {
  address: string;
  stake: BigNumber;
  onboardBlock?: number | string;
  onboardTimestamp?: number;
}

async function main() {
  // const { chainId } = await ethers.provider.getNetwork();
  //
  const [deployer] = await ethers.getSigners();
  //
  // const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer);
  // const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;
  // const manager = loadDeployment(ContractNames.LegacyPoolManager, chainId).address;
  //
  const head: Head = await ethers.getContractAt("Head", HEAD);
  const oldContext = Context__factory.connect(await head.context(), deployer);
  const oldCatalogue = Catalogue__factory.connect(await oldContext.catalogue(), deployer);
  const oldStorageCatalogue = StorageCatalogue__factory.connect(await oldContext.storageCatalogue(), deployer);

  const oldStakes = await getOldStakes(
    await oldStorageCatalogue.apolloDepositStore(),
    await oldStorageCatalogue.poolsStore(),
    await oldStorageCatalogue.rolesEventEmitter()
  );

  // console.log("importing old stakes", oldStakes);
  // await (await manager.importOldStakes(Object.keys(oldStakes), Object.values(oldStakes))).wait();
  // console.log("imported old stakes");
  //
  // await deployNewContext(oldCatalogue, oldStorageCatalogue, manager.address, deployer);
}

async function getOldStakes(depositStoreAddr: string, poolsStoreAddr: string, rolesEventEmitterAddr: string) {
  const baseNodesAddresses = await getBaseNodes();

  const [owner] = await ethers.getSigners();
  const validatorSet = new ethers.Contract(VALIDATOR_SET, validatorSetAbi, owner);
  const depositStore = ApolloDepositStore__factory.connect(depositStoreAddr, owner.provider!);
  const poolsStore = PoolsStore__factory.connect(poolsStoreAddr, owner);
  const rolesEventEmitter = RolesEventEmitter__factory.connect(rolesEventEmitterAddr, owner);

  // get nodes that running in pools
  const pools = await poolsStore.getPools(0, await poolsStore.getPoolsCount());
  const poolAddresses = [];
  for (const poolAddress of pools) {
    const pool = LegacyPool__factory.connect(poolAddress, owner);
    const nodesCount = await pool.getNodesCount();
    if (nodesCount.eq(0)) continue;
    const nodes = await pool.getNodes(0, nodesCount);
    poolAddresses.push(...nodes);
  }

  // fetch addresses and their stakes from validator set
  const serverNodes: Record<string, NodeInfo> = {};
  const poolNodes: Record<string, NodeInfo> = {};
  const baseNodes: Record<string, NodeInfo> = {};

  const validatorSetAddresses = await validatorSet.getValidators();

  // get stake AMOUNT from deposit store for each address
  for (const address of validatorSetAddresses) {
    if (!(await depositStore.isDepositing(address))) continue;

    const stake = await depositStore.callStatic.releaseDeposit(address, owner.address, {
      from: depositStore.address,
    });
    const stakeInfo = { address, stake };

    if (poolAddresses.includes(address)) poolNodes[address] = stakeInfo;
    else if (baseNodesAddresses.includes(address)) baseNodes[address] = stakeInfo;
    else serverNodes[address] = stakeInfo;
  }

  // get onboard time for server nodes
  const batchSize = 200_000;
  const toBlock = await ethers.provider.getBlockNumber();

  for (let startBlock = 0; startBlock <= toBlock; startBlock += batchSize) {
    const endBlock = Math.min(startBlock + batchSize - 1, toBlock);

    const events = await rolesEventEmitter.queryFilter(rolesEventEmitter.filters.NodeOnboarded(), startBlock, endBlock);

    for (const event of events) {
      if (!serverNodes[event.args.nodeAddress]) continue;
      serverNodes[event.args.nodeAddress].onboardBlock = event.blockNumber;
    }
  }
  for (const serverNodeInfo of Object.values(serverNodes)) {
    const { timestamp } = await owner.provider!.getBlock(serverNodeInfo.onboardBlock!);
    serverNodeInfo.onboardTimestamp = timestamp;
  }

  console.log(poolNodes);
  console.log(baseNodes);
  console.log(serverNodes);

  return { poolNodes, baseNodes, serverNodes };
}

async function getBaseNodes() {
  const { chainId } = await ethers.provider.getNetwork();

  if (network.name == "dev")
    return [
      "0xdecA85befcC43ed1891758E37c35053aFF935AC1",
      "0x427933454115d6D55E8e24821d430F944d3eD936",
      "0x87a3d2CcacDe32f366Bd01bcbeB202643cD38A4E",
    ];
  if (network.name == "test")
    return [
      "0x311B7E7d0795c9697c6ED20B962f844E1e1F08ba",
      "0x5a16b69a09013C077A70fc62a3705Dbf1b60c2B0",
      "0x91a48ebAfb1C6bc89000B0F63850BeF1258A082B",
      "0x042cab4fe91f0fb00936a2b9B262A1f9cf88aAd2",
      "0x62291e77Dc079897751e26a9F6b3BC4630D7454c",
      "0xA373F89F90ecEf9f430719Ed83eD49722b98FD09",
      "0x51213F81319E42f6296C29BEeA1245C5F78f2dEf",
      "0xDE3939BEe9A4B0aB8272bDd06d6B6E7E917FB514",
      "0x52aB486A5067cd8e2705DbC90Ed72D6dA549D0EB",
    ];
  if (network.name == "local")
    return [
      "0x162BA761Fc75f5873197A340F9e7fb926bA7517D",
      "0x129C0057AF3f91d4fa729AEA7910b46F7cE3d081",
      "0x73574449cbEd6213F5340e806E9Dec36f05A25ec",
      "0x742c823aC6963f43E3Fa218be3B8aBb4b786BdBe",
      "0x9b1822da3F6450832DD92713f49C075b2538F057",
      "0x9f8B33a65A61F3382904611020EdC17E64745622",
      // todo
    ];
  throw new Error(`Unknown network ${chainId}`);
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

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
