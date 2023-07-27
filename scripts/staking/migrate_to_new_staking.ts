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
  RolesEventEmitter__factory,
  ServerNodes_Manager,
  StorageCatalogue__factory,
  ValidatorSet,
} from "../../typechain-types";
import { BigNumber } from "ethers";
import { loadDeployment } from "deployments";
import { ContractNames } from "../../src";

const HEAD = "0x0000000000000000000000000000000000000F10";
const VALIDATOR_SET = "0x0000000000000000000000000000000000000F00";

const validatorSetAbi = ["function getValidators() view returns (address[])"];
const feesAbi = ["function isAdmin(address) view returns (bool)", "function paused() view returns (bool)"];

interface NodeInfo {
  address: string;
  stake: BigNumber;
  onboardBlock?: number | string;
  onboardTimestamp?: number;
}

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

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

  const { address: baseNodeAddresses } = unzipNodeInfos(oldStakes.baseNodes);
  const { address: poolNodesAddresses, stake: poolNodesStakes } = unzipNodeInfos(oldStakes.poolNodes);
  const {
    address: serverNodesAddresses,
    stake: serverNodesStakes,
    onboardTimestamp: serverNodesTimestamps,
  } = unzipNodeInfos(oldStakes.serverNodes);

  // register stake managers in validator set
  console.log("Granting STAKING_MANAGER_ROLE");
  const stakingManagerRole = await validatorSet.STAKING_MANAGER_ROLE();
  await (await validatorSet.grantRole(stakingManagerRole, baseNodesManager.address)).wait();
  await (await validatorSet.grantRole(stakingManagerRole, serverNodesManager.address)).wait();
  await (await validatorSet.grantRole(stakingManagerRole, poolNodesManager.address)).wait();

  // transfer basenodes and servernodes deposits to deployer
  console.log("withdraw stakes from baseNodes", baseNodeAddresses);
  await (await roles.transferApollo(baseNodeAddresses, repeat(deployer.address, baseNodeAddresses.length))).wait();

  console.log("withdraw stakes from serverNodes", serverNodesAddresses);
  await (
    await roles.transferApollo(serverNodesAddresses, repeat(deployer.address, serverNodesAddresses.length))
  ).wait();

  // migrate base nodes
  for (const baseNode of oldStakes.baseNodes) {
    console.log("adding baseNode", baseNode.address);
    await (await baseNodesManager.addStake(baseNode.address, { value: baseNode.stake })).wait();
  }

  // migrate server nodes
  const stakeSum = serverNodesStakes.reduce((acc, val) => acc.add(val), BigNumber.from(0));
  const serverNodesTimestamps_ = serverNodesTimestamps as number[];
  console.log("importing serverNodes", serverNodesAddresses);
  await (
    await serverNodesManager.importOldStakes(serverNodesAddresses, serverNodesStakes, serverNodesTimestamps_, {
      value: stakeSum,
    })
  ).wait();

  // migrate pools
  console.log("changing catalogue");
  await (await catalogue.change(await catalogue.poolsNodesManager(), poolNodesManager.address)).wait();
  console.log("changing context");
  await (await context.setTrustedAddress(poolNodesManager.address, true)).wait();

  console.log("importing poolNodes", poolNodesAddresses);
  await (await poolNodesManager.importOldStakes(poolNodesAddresses, poolNodesStakes)).wait();

  // finalize validatorset

  console.log("finalizing validator set");
  await (await validatorSet.finalizeChange()).wait();

  // setup ownerships
  const defaultAdminRole = await validatorSet.DEFAULT_ADMIN_ROLE();

  console.log("setup ownership for baseNodes");
  const baseNodesMultisig = loadDeployment(ContractNames.BaseNodesManagerMultisig, chainId).address;
  await (await baseNodesManager.grantRole(defaultAdminRole, baseNodesMultisig)).wait();
  await (await baseNodesManager.revokeRole(defaultAdminRole, deployer.address)).wait();

  console.log("setup ownership for serverNodes");
  const serverNodesMultisig = loadDeployment(ContractNames.ServerNodesManagerMultisig, chainId).address;
  await (await serverNodesManager.grantRole(defaultAdminRole, serverNodesMultisig)).wait();
  await (await serverNodesManager.revokeRole(defaultAdminRole, deployer.address)).wait();

  console.log("setup ownership for poolNodes");
  const poolNodesMultisig = loadDeployment(ContractNames.LegacyPoolManagerMultisig, chainId).address;
  await (await poolNodesManager.transferOwnership(poolNodesMultisig)).wait();

  console.log("setup ownership for validatorset");
  const validatorSetMultisig = loadDeployment(ContractNames.ValidatorSetMultisig, chainId).address;
  await (await validatorSet.grantRole(defaultAdminRole, validatorSetMultisig)).wait();
  await (await validatorSet.revokeRole(defaultAdminRole, deployer.address)).wait();
}

async function getOldStakes(depositStoreAddr: string, poolsStoreAddr: string, rolesEventEmitterAddr: string) {
  const [owner] = await ethers.getSigners();
  const validatorSet = new ethers.Contract(VALIDATOR_SET, validatorSetAbi, owner);
  const depositStore = ApolloDepositStore__factory.connect(depositStoreAddr, owner.provider!);
  const poolsStore = PoolsStore__factory.connect(poolsStoreAddr, owner);
  const rolesEventEmitter = RolesEventEmitter__factory.connect(rolesEventEmitterAddr, owner);

  const baseNodesAddresses = await getBaseNodes();
  const poolNodesAddresses = await getPoolNodesAddresses(poolsStore);

  // fetch addresses and their stakes from validator set
  const serverNodes: Record<string, NodeInfo> = {};
  const poolNodes: Record<string, NodeInfo> = {};
  const baseNodes: Record<string, NodeInfo> = {};

  const validatorSetAddresses = await validatorSet.getValidators();

  // get stake AMOUNT from deposit store for each address
  for (const address of validatorSetAddresses) {
    if (!(await depositStore.isDepositing(address))) throw new Error(`${address} is not depositing`);

    const stake = await depositStore.callStatic.releaseDeposit(address, owner.address, {
      from: depositStore.address,
    });
    const stakeInfo = { address, stake };

    if (poolNodesAddresses.includes(address)) poolNodes[address] = stakeInfo;
    else if (baseNodesAddresses.includes(address)) baseNodes[address] = stakeInfo;
    else serverNodes[address] = stakeInfo;
  }

  // get onboard time for server nodes

  const events = await fetchEvents((start, end) =>
    rolesEventEmitter.queryFilter(rolesEventEmitter.filters.NodeOnboarded(), start, end)
  );
  for (const event of events) {
    if (!serverNodes[event.args.nodeAddress]) continue;
    serverNodes[event.args.nodeAddress].onboardBlock = event.blockNumber;
  }
  for (const serverNodeInfo of Object.values(serverNodes)) {
    const { timestamp } = await owner.provider!.getBlock(serverNodeInfo.onboardBlock!);
    serverNodeInfo.onboardTimestamp = timestamp;
  }

  return {
    poolNodes: Object.values(poolNodes),
    baseNodes: Object.values(baseNodes),
    serverNodes: Object.values(serverNodes),
  };
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

async function getBaseNodes() {
  const baseNodes = {
    dev: [
      "0xdecA85befcC43ed1891758E37c35053aFF935AC1",
      "0x427933454115d6D55E8e24821d430F944d3eD936",
      "0x87a3d2CcacDe32f366Bd01bcbeB202643cD38A4E",
    ],
    test: [
      "0x311B7E7d0795c9697c6ED20B962f844E1e1F08ba",
      "0x5a16b69a09013C077A70fc62a3705Dbf1b60c2B0",
      "0x91a48ebAfb1C6bc89000B0F63850BeF1258A082B",
      "0x042cab4fe91f0fb00936a2b9B262A1f9cf88aAd2",
      "0x62291e77Dc079897751e26a9F6b3BC4630D7454c",
      "0xA373F89F90ecEf9f430719Ed83eD49722b98FD09",
      "0x51213F81319E42f6296C29BEeA1245C5F78f2dEf",
      "0xDE3939BEe9A4B0aB8272bDd06d6B6E7E917FB514",
      "0x52aB486A5067cd8e2705DbC90Ed72D6dA549D0EB",
    ],
    main: [
      "0x162BA761Fc75f5873197A340F9e7fb926bA7517D",
      "0x129C0057AF3f91d4fa729AEA7910b46F7cE3d081",
      "0x73574449cbEd6213F5340e806E9Dec36f05A25ec",
      "0x742c823aC6963f43E3Fa218be3B8aBb4b786BdBe",
      "0x9b1822da3F6450832DD92713f49C075b2538F057",
      "0x9f8B33a65A61F3382904611020EdC17E64745622",
      // todo
    ],
  }[network.name];
  if (baseNodes == undefined) throw new Error(`Unknown network ${network.name}`);
  return baseNodes;
}

async function getPoolNodesAddresses(poolsStore: PoolsStore) {
  const pools = await poolsStore.getPools(0, await poolsStore.getPoolsCount());
  const poolNodes = [];
  for (const poolAddress of pools) {
    const pool = LegacyPool__factory.connect(poolAddress, poolsStore.provider);
    const nodesCount = await pool.getNodesCount();
    if (nodesCount.eq(0)) continue;

    const nodes = await pool.getNodes(0, nodesCount);
    poolNodes.push(...nodes);
  }
  return poolNodes;
}

function unzipNodeInfos<T extends NodeInfo>(nodes: T[]): { [K in keyof T]: T[K][] } {
  const result: { [K in keyof T]: T[K][] } = {} as { [K in keyof T]: T[K][] };

  for (const node of nodes)
    for (const key in node) {
      if (!result[key]) result[key] = [];
      result[key].push(node[key]);
    }
  return result;
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
