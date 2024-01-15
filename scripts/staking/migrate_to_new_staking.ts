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
import { BigNumber, Contract, PopulatedTransaction } from "ethers";
import { loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
import {Parallel} from "../parallel";
import {NodeOnboardedEvent} from "../../typechain-types/contracts/staking/pools/Legacy/RolesEventEmitter";
import {formatEther} from "ethers/lib/utils";
// import { wrapProviderToError } from "../../src/utils/AmbErrorProvider";

const HEAD = "0x0000000000000000000000000000000000000F10";
const VALIDATOR_SET = "0x0000000000000000000000000000000000000F00";

const validatorSetAbi = ["function getValidators() view returns (address[])"];
const multiplexerAbi = ["function addAdmin(address _admin)", "function setPaused(bool _paused)"];
const multisigAbi = ["function confirmTransaction(uint256 transactionId)",
  "function submitTransaction(address destination, uint256 value, bytes data) public returns (uint256 transactionId)",
  "event Submission(uint256 indexed transactionId)"];
const feesAbi = ["function isAdmin(address) view returns (bool)", "function paused() view returns (bool)"];

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  // wrapProviderToError(deployer.provider!);

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

  const multisig = new ethers.Contract(multisigAddress, multisigAbi);
  const multiplexer = new ethers.Contract(multiplexerAddress, multiplexerAbi);

  if (!(await fees.isAdmin(deployer.address))) {
    if (network.name === "main") throw new Error(`${deployer.address} is not a admin`);
    console.warn(`${deployer.address} is not a admin`);
    await submitMultisigTx(multisig, multiplexer, multiplexer.populateTransaction.addAdmin(deployer.address));
  }
  if (!(await fees.paused())) {
    if (network.name === "main") throw new Error("legacy contracts doesn't paused!");
    console.warn("legacy contracts doesn't paused!");
    await submitMultisigTx(multisig, multiplexer, multiplexer.populateTransaction.setPaused(true));
  }

  const oldStakes = await getOldStakes(
    await storageCatalogue.apolloDepositStore(),
    await storageCatalogue.poolsStore(),
    await storageCatalogue.rolesEventEmitter()
  );

  console.log("old stakes", oldStakes);
  // return;

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
  await (await baseNodesManager.revokeRole(defaultAdminRole, deployer.address)).wait();

  console.log("setup ownership for serverNodes");
  await (await serverNodesManager.revokeRole(defaultAdminRole, deployer.address)).wait();

  console.log("setup ownership for poolNodes");
  const poolNodesMultisig = loadDeployment(ContractNames.LegacyPoolManagerMultisig, chainId).address;
  await (await poolNodesManager.transferOwnership(poolNodesMultisig)).wait();

  console.log("setup ownership for validatorset");
  await (await validatorSet.revokeRole(defaultAdminRole, deployer.address)).wait();
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
    if (event.blockNumber > (serverNodesOnboardTime[event.args.nodeAddress] || 0))
      serverNodesOnboardTime[event.args.nodeAddress] = event.blockNumber;
  }
  for (const [address, block] of Object.entries(serverNodesOnboardTime)) {
    const { timestamp } = await rolesEventEmitter.provider.getBlock(block);
    serverNodesOnboardTime[address] = timestamp;
  }
  return serverNodesOnboardTime;
}

async function fetchEvents(fetchCall: (startBlock: number, endBlock: number | string) => Promise<any[]>) {
  const batchSize = 50_000;
  const lastBlock = await ethers.provider.getBlockNumber();

  const result: NodeOnboardedEvent[] = [];
  const parallel = new Parallel(10);

  for (let startBlock = 0; startBlock <= lastBlock; startBlock += batchSize) {
    parallel.addTask(async () => {
      const endBlock = Math.min(startBlock + batchSize - 1, lastBlock);
      result.push(...(await fetchCall(startBlock, endBlock)));
      console.log("fetched events", startBlock, endBlock);
    });
  }
  await parallel.wait();

  result.push(...(await fetchCall(lastBlock, "latest")));  // fetch events up to new last block

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


async function submitMultisigTx(multisig: Contract, targetContract: Contract, populateTransactionPromise: Promise<PopulatedTransaction>) {
  const [owner, multisig1, multisig2] = await ethers.getSigners();

  const calldata = (await populateTransactionPromise).data!;
  const receipt = await (await multisig.connect(multisig1).submitTransaction(targetContract.address, 0, calldata)).wait();

  const submissionEvent = receipt.events?.find((e: any) => e.event === "Submission");
  if (!submissionEvent || !submissionEvent.args) throw new Error("Submission event not found");
  const txId = submissionEvent.args[0];

  await (await multisig.connect(multisig2).confirmTransaction(txId)).wait();
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
