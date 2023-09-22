import { ethers, network } from "hardhat";
import {
  ApolloDepositStore__factory,
  BaseNodes_Manager,
  Catalogue__factory,
  Context__factory,
  Head__factory,
  LegacyPool__factory,
  LegacyPoolsNodes_Manager,
  PoolsStore,
  PoolsStore__factory,
  Roles__factory,
  RolesEventEmitter,
  RolesEventEmitter__factory,
  ServerNodes_Manager,
  StorageCatalogue__factory,
  ValidatorSet,
} from "../../typechain-types";
import { BigNumber } from "ethers";
import { loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
import { wrapProviderToError } from "../../src/utils/AmbErrorProvider";

const HEAD = "0x0000000000000000000000000000000000000F10";
const VALIDATOR_SET = "0x0000000000000000000000000000000000000F00";

const validatorSetAbi = ["function getValidators() view returns (address[])"];
const feesAbi = ["function isAdmin(address) view returns (bool)", "function paused() view returns (bool)"];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  wrapProviderToError(deployer.provider!);

  const validatorSet = loadDeployment(ContractNames.ValidatorSet, chainId, deployer) as ValidatorSet;
  const baseNodesManager = loadDeployment(ContractNames.BaseNodesManager, chainId, deployer) as BaseNodes_Manager;
  const poolNodesManager = loadDeployment(
    ContractNames.LegacyPoolManager,
    chainId,
    deployer
  ) as LegacyPoolsNodes_Manager;
  const serverNodesManager = loadDeployment(ContractNames.ServerNodesManager, chainId, deployer) as ServerNodes_Manager;

  const head = Head__factory.connect(HEAD, deployer);
  const context = Context__factory.connect(await head.context(), deployer);
  const catalogue = Catalogue__factory.connect(await context.catalogue(), deployer);
  const storageCatalogue = StorageCatalogue__factory.connect(await context.storageCatalogue(), deployer);
  const roles = Roles__factory.connect(await catalogue.roles(), deployer);
  const fees = new ethers.Contract(await catalogue.fees(), feesAbi, deployer);

  const multiplexerAddress = await head.owner();
  const multisigAddress = await Head__factory.connect(multiplexerAddress, deployer).owner();
  console.log("multiplexer", multiplexerAddress, ", multisig", multisigAddress);

  if (!(await fees.isAdmin(deployer.address))) throw `${deployer.address} is not a admin`;
  if (!(await fees.paused())) throw "legacy contracts doesn't paused!";

  const oldStakes = await getOldStakes(
    await storageCatalogue.apolloDepositStore(),
    await storageCatalogue.poolsStore(),
    await storageCatalogue.rolesEventEmitter()
  );

  console.log("old stakes", oldStakes);
  return;

  const {
    baseNodesAddresses,
    poolNodesAddresses,
    serverNodesAddresses,
    stakes,
    poolNodes2Pool,
    serverNodesOnboardTime,
  } = oldStakes;

  // transfer basenodes and servernodes deposits to deployer
  console.log("withdraw stakes from baseNodes", baseNodesAddresses);
  await (await roles.transferApollo(baseNodesAddresses, repeat(deployer.address, baseNodesAddresses.length))).wait();

  console.log("withdraw stakes from serverNodes", serverNodesAddresses);
  await (
    await roles.transferApollo(serverNodesAddresses, repeat(deployer.address, serverNodesAddresses.length))
  ).wait();

  // migrate base nodes
  for (const baseNode of baseNodesAddresses) {
    console.log("adding baseNode", baseNode);
    await (await baseNodesManager.addStake(baseNode, { value: stakes[baseNode] })).wait();
  }

  // migrate server nodes
  const serverNodesStakes = serverNodesAddresses.map((address) => stakes[address]);
  const serverNodesTimestamps = serverNodesAddresses.map((address) => serverNodesOnboardTime[address]);
  const stakeSum = serverNodesStakes.reduce((acc, val) => acc.add(val), BigNumber.from(0));
  console.log("importing serverNodes", serverNodesAddresses);
  await (
    await serverNodesManager.importOldStakes(serverNodesAddresses, serverNodesStakes, serverNodesTimestamps, {
      value: stakeSum,
    })
  ).wait();

  // migrate pools
  console.log("changing catalogue");
  await (await catalogue.change(await catalogue.poolsNodesManager(), poolNodesManager.address)).wait();
  console.log("changing context");
  await (await context.setTrustedAddress(poolNodesManager.address, true)).wait();

  console.log("importing poolNodes", poolNodesAddresses);
  if (poolNodesAddresses && poolNodesAddresses.length > 0) {
    const poolNodesStakes = poolNodesAddresses.map((address) => stakes[address]);
    const poolNodesPools = poolNodesAddresses.map((address) => poolNodes2Pool[address]);
    await (await poolNodesManager.importOldStakes(poolNodesAddresses, poolNodesPools, poolNodesStakes)).wait();
  }

  // finalize validatorset

  console.log("finalizing validator set");
  await (await validatorSet.finalizeChange()).wait();

  // setup ownerships
  const defaultAdminRole = await validatorSet.DEFAULT_ADMIN_ROLE();

  // todo uncomment lines below before prod
  console.log("setup ownership for baseNodes");
  // await (await baseNodesManager.revokeRole(defaultAdminRole, deployer.address)).wait();

  console.log("setup ownership for serverNodes");
  // await (await serverNodesManager.revokeRole(defaultAdminRole, deployer.address)).wait();

  console.log("setup ownership for poolNodes");
  const poolNodesMultisig = loadDeployment(ContractNames.LegacyPoolManagerMultisig, chainId).address;
  await (await poolNodesManager.transferOwnership(poolNodesMultisig)).wait();

  console.log("setup ownership for validatorset");
  // await (await validatorSet.revokeRole(defaultAdminRole, deployer.address)).wait();
}

async function getOldStakes(depositStoreAddr: string, poolsStoreAddr: string, rolesEventEmitterAddr: string) {
  const [owner] = await ethers.getSigners();
  const validatorSet = new ethers.Contract(VALIDATOR_SET, validatorSetAbi, owner);
  const depositStore = ApolloDepositStore__factory.connect(depositStoreAddr, owner.provider!);
  const poolsStore = PoolsStore__factory.connect(poolsStoreAddr, owner);
  const rolesEventEmitter = RolesEventEmitter__factory.connect(rolesEventEmitterAddr, owner);

  const validatorSetAddresses = await validatorSet.getValidators();

  const baseNodesAddresses = await getBaseNodes(validatorSetAddresses);
  const poolNodes2Pool = await getPoolNodesAddresses(poolsStore);
  const poolNodesAddresses = Object.keys(poolNodes2Pool);
  const serverNodesAddresses: string[] = [];

  const stakes: { [node: string]: BigNumber } = {};

  // get stake AMOUNT from deposit store for each address
  for (const address of validatorSetAddresses) {
    if (!(await depositStore.isDepositing(address))) throw new Error(`${address} is not depositing`);

    if (!poolNodesAddresses.includes(address) && !baseNodesAddresses.includes(address))
      serverNodesAddresses.push(address);

    stakes[address] = await depositStore.callStatic.releaseDeposit(address, owner.address, {
      from: depositStore.address,
    });
  }

  // get onboard time for server nodes
  const serverNodesOnboardTime = await getOnboardTimeForServerNodes(rolesEventEmitter, serverNodesAddresses);

  return {
    baseNodesAddresses,
    poolNodesAddresses,
    serverNodesAddresses,
    stakes,
    poolNodes2Pool,
    serverNodesOnboardTime,
  };
}

async function getOnboardTimeForServerNodes(rolesEventEmitter: RolesEventEmitter, serverNodesAddresses: string[]) {
  const serverNodesOnboardTime: { [node: string]: number } = {};
  const events = await fetchEvents((start, end) =>
    rolesEventEmitter.queryFilter(rolesEventEmitter.filters.NodeOnboarded(), start, end)
  );
  for (const event of events) {
    if (!serverNodesAddresses.includes(event.args.nodeAddress)) continue;
    serverNodesOnboardTime[event.args.nodeAddress] = event.blockNumber;
  }
  for (const [address, block] of Object.entries(serverNodesOnboardTime)) {
    const { timestamp } = await rolesEventEmitter.provider.getBlock(block);
    serverNodesOnboardTime[address] = timestamp;
  }
  return serverNodesOnboardTime;
}

async function fetchEvents(fetchCall: (startBlock: number, endBlock: number) => Promise<any[]>) {
  const batchSize = 200_000;
  const toBlock = await ethers.provider.getBlockNumber();

  const result = [];
  for (let startBlock = 0; startBlock <= toBlock; startBlock += batchSize) {
    const endBlock = Math.min(startBlock + batchSize - 1, toBlock);
    result.push(...(await fetchCall(startBlock, endBlock)));
  }
  return result;
}

async function getBaseNodes(validators: string[]) {
  const url = {
    dev: "https://chainspec.ambrosus-dev.io/",
    test: "https://chainspec.ambrosus-test.io/",
    main: "https://chainspec.ambrosus.io/",
  }[network.name];
  if (url == undefined) throw new Error(`Unknown network ${network.name}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Can't fetch ${url}`);
  const json = await res.json();
  const baseNodes = (Object.entries(json.accounts) as [string, any][])
    .filter(([addr, val]) => validators.includes(addr) && val.balance)
    .map(([addr]) => addr);

  return baseNodes;
}

async function getPoolNodesAddresses(poolsStore: PoolsStore) {
  const node2poll: { [node: string]: string } = {};

  const poolsCount = await poolsStore.getPoolsCount();
  if (poolsCount.eq(0)) return node2poll;
  const pools = await poolsStore.getPools(0, poolsCount);

  for (const poolAddress of pools) {
    const pool = LegacyPool__factory.connect(poolAddress, poolsStore.provider);
    const nodesCount = await pool.getNodesCount();
    if (nodesCount.eq(0)) continue;

    console.log("get nodes");
    const nodes = await pool.getNodes(0, nodesCount);

    for (const node of nodes) node2poll[node] = poolAddress;
  }
  return node2poll;
}

function repeat<T>(item: T, times: number): T[] {
  return Array(times).fill(item);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
