// import { impersonateAccount, loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
// import { ethers, upgrades } from "hardhat";
// import { expect } from "chai";
// import {
//   ApolloDepositStore__factory,
//   Catalogue__factory,
//   Context__factory,
//   Head,
//   LegacyPool,
//   LegacyPoolsNodes_Manager__factory,
//   PoolEventsEmitter__factory,
//   RolesEventEmitter__factory,
//   StorageCatalogue__factory,
//   TEST_ValidatorSet,
// } from "../../typechain-types";
// import { BigNumber } from "ethers";
//
// const HERA_POOL = "0x0E051C8C1cd519d918DB9b631Af303aeC85266BF";
// const HEAD = "0x0000000000000000000000000000000000000F10";
// const VALIDATOR_SET = "0x0000000000000000000000000000000000000F00";
//
// // check that already deployed hera pool is working with PoolsNodesManager Legacy Adapter
//
// if (!process.env.CI)
//   describe("Legacy Pool", function () {
//     async function deploy() {
//       const [owner] = await ethers.getSigners();
//       await setBalance(owner.address, ethers.utils.parseEther("100000000"));
//
//       const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
//       const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [
//         owner.address,
//         owner.address,
//         10,
//         2,
//       ])) as TEST_ValidatorSet;
//
//       const head: Head = await ethers.getContractAt("Head", HEAD);
//       const headOwnerAddr = await head.owner();
//       const headOwner = await ethers.getSigner(headOwnerAddr);
//       await impersonateAccount(headOwnerAddr);
//       await setBalance(headOwnerAddr, ethers.utils.parseEther("100000000"));
//
//       const oldContext = Context__factory.connect(await head.context(), owner);
//       const oldCatalogue = Catalogue__factory.connect(await oldContext.catalogue(), owner);
//       const oldStorageCatalogue = StorageCatalogue__factory.connect(await oldContext.storageCatalogue(), owner);
//       // const oldPoolsNodeManager = PoolsNodes_Manager__factory.connect(await oldCatalogue.poolsNodesManager(), owner);
//
//       const minApolloDeposit = new ethers.Contract(
//         await oldCatalogue.config(),
//         ["function APOLLO_DEPOSIT() view returns (uint)"],
//         owner
//       ).APOLLO_DEPOSIT();
//
//       const manager = await new LegacyPoolsNodes_Manager__factory(owner).deploy(
//         minApolloDeposit,
//         validatorSet.address,
//         await oldStorageCatalogue.poolsStore(),
//         await oldStorageCatalogue.apolloDepositStore(),
//         await oldStorageCatalogue.rolesEventEmitter(),
//         await oldStorageCatalogue.poolEventsEmitter()
//       );
//       await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address);
//
//       const oldStakes = await getOldStakes(await oldStorageCatalogue.apolloDepositStore());
//       await manager.importOldStakes(Object.keys(oldStakes), Object.values(oldStakes));
//
//       const catalogueArgs = [
//         await oldCatalogue.kycWhitelist(),
//         await oldCatalogue.roles(),
//         await oldCatalogue.fees(),
//         await oldCatalogue.time(),
//         await oldCatalogue.challenges(),
//         await oldCatalogue.payouts(),
//         await oldCatalogue.shelteringTransfers(),
//         await oldCatalogue.sheltering(),
//         await oldCatalogue.uploads(),
//         await oldCatalogue.config(),
//         await oldCatalogue.validatorProxy(),
//         manager.address,
//       ] as const;
//       const storageCatalogueArgs = [
//         await oldStorageCatalogue.apolloDepositStore(),
//         await oldStorageCatalogue.atlasStakeStore(),
//         await oldStorageCatalogue.bundleStore(),
//         await oldStorageCatalogue.challengesStore(),
//         await oldStorageCatalogue.kycWhitelistStore(),
//         await oldStorageCatalogue.payoutsStore(),
//         await oldStorageCatalogue.rolesStore(),
//         await oldStorageCatalogue.shelteringTransfersStore(),
//         await oldStorageCatalogue.rolesEventEmitter(),
//         await oldStorageCatalogue.transfersEventEmitter(),
//         await oldStorageCatalogue.challengesEventEmitter(),
//         await oldStorageCatalogue.rewardsEventEmitter(),
//         await oldStorageCatalogue.poolsStore(),
//         await oldStorageCatalogue.poolEventsEmitter(),
//         await oldStorageCatalogue.nodeAddressesStore(),
//         await oldStorageCatalogue.rolesPrivilagesStore(),
//       ] as const;
//
//       const catalogue = await new Catalogue__factory(owner).deploy(...catalogueArgs);
//       const storageCatalogue = await new StorageCatalogue__factory(owner).deploy(...storageCatalogueArgs);
//
//       const context = await new Context__factory(owner).deploy(
//         [...catalogueArgs, ...storageCatalogueArgs],
//         catalogue.address,
//         storageCatalogue.address,
//         "0.1.0"
//       );
//       await head.connect(headOwner).setContext(context.address);
//
//       const heraPool: LegacyPool = await ethers.getContractAt("LegacyPool", HERA_POOL);
//
//       const heraServiceAddr = ethers.utils.defaultAbiCoder.decode(
//         ["address"],
//         await heraPool.provider.getStorageAt(heraPool.address, 2)
//       )[0];
//       const heraService = await ethers.getSigner(heraServiceAddr);
//       await impersonateAccount(heraServiceAddr);
//       await setBalance(heraServiceAddr, ethers.utils.parseEther("100000000"));
//
//       const poolEventEmitter = PoolEventsEmitter__factory.connect(await oldStorageCatalogue.poolEventsEmitter(), owner);
//       const rolesEventEmitter = RolesEventEmitter__factory.connect(
//         await oldStorageCatalogue.rolesEventEmitter(),
//         owner
//       );
//
//       return { validatorSet, manager, owner, heraPool, heraService, poolEventEmitter, rolesEventEmitter };
//     }
//
//     it("stake", async function () {
//       const { heraPool, poolEventEmitter } = await loadFixture(deploy);
//
//       await expect(heraPool.stake({ value: heraPool.minStakeValue() })).to.emit(poolEventEmitter, "PoolStakeChanged");
//     });
//
//     it("stake + onboard request", async function () {
//       const { heraPool, poolEventEmitter } = await loadFixture(deploy);
//
//       await expect(heraPool.stake({ value: heraPool.nodeStake() }))
//         .to.emit(poolEventEmitter, "PoolStakeChanged")
//         .emit(poolEventEmitter, "AddNodeRequest");
//     });
//
//     it("onboard request + approve request", async function () {
//       const { validatorSet, heraPool, heraService, poolEventEmitter, rolesEventEmitter } = await loadFixture(deploy);
//
//       const receipt = await (await heraPool.stake({ value: heraPool.nodeStake() })).wait();
//       const requestEvent = poolEventEmitter.interface.decodeEventLog("AddNodeRequest", receipt.events![2].data);
//
//       const newNodeAddr = (await ethers.getSigners())[5].address;
//
//       await expect(heraPool.connect(heraService).addNode(requestEvent.id, newNodeAddr, requestEvent.nodeId))
//         .to.emit(poolEventEmitter, "AddNodeRequestResolved")
//         .emit(rolesEventEmitter, "NodeOnboarded");
//
//       expect((await validatorSet.getTopStakes()).includes(newNodeAddr));
//     });
//   });
//
// async function getOldStakes(depositStoreAddr: string) {
//   const [owner] = await ethers.getSigners();
//   const depositStore = ApolloDepositStore__factory.connect(depositStoreAddr, owner.provider!);
//   const validatorSet = new ethers.Contract(VALIDATOR_SET, ["function getValidators() view returns (address[])"], owner);
//
//   const addresses = await validatorSet.getValidators();
//
//   const stakes: { [addr: string]: BigNumber } = {};
//   for (const addr of addresses) {
//     if (!(await depositStore.isDepositing(addr))) continue;
//     stakes[addr] = await depositStore.callStatic.releaseDeposit(addr, owner.address, {
//       from: depositStore.address,
//     });
//   }
//
//   return stakes;
// }
