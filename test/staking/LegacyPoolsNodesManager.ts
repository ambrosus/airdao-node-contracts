import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import {
  Catalogue__factory, Context__factory,
  LegacyPool,
  LegacyPool__factory,
  LegacyPoolsNodes_Manager,
  RewardsBank__factory,
  TEST_ApolloDepositStore,
  TEST_ApolloDepositStore__factory,
  TEST_PoolEventsEmitter,
  TEST_PoolEventsEmitter__factory,
  TEST_PoolsStore,
  TEST_PoolsStore__factory,
  TEST_RolesEventEmitter,
  TEST_RolesEventEmitter__factory,
  TEST_ValidatorSet,
  Treasury__factory,
  Head__factory
} from "../../typechain-types";
import { AddressZero } from "@ethersproject/constants";
import { impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";

describe("PoolsNodes_Manager", function () {
  let validatorSet: TEST_ValidatorSet;
  let manager: LegacyPoolsNodes_Manager;
  let poolsStore: TEST_PoolsStore;
  let apolloDepositStore: TEST_ApolloDepositStore;
  let rolesEventEmitter: TEST_RolesEventEmitter;
  let poolEventsEmitter: TEST_PoolEventsEmitter;

  let owner: SignerWithAddress;
  let pool1: SignerWithAddress;
  let pool2: SignerWithAddress;
  let user: SignerWithAddress;
  let realPool: LegacyPool;

  async function deploy() {
    const [owner, pool1, pool2, user] = await ethers.getSigners();

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);

    const poolsStore = await new TEST_PoolsStore__factory(owner).deploy();
    const apolloDepositStore = await new TEST_ApolloDepositStore__factory(owner).deploy();
    const rolesEventEmitter = await new TEST_RolesEventEmitter__factory(owner).deploy();
    const poolEventsEmitter = await new TEST_PoolEventsEmitter__factory(owner).deploy();


    const PoolsNodes_ManagerFactory = await ethers.getContractFactory("LegacyPoolsNodes_Manager");
    const manager = (await upgrades.deployProxy(PoolsNodes_ManagerFactory, [
      validatorSet.address,
      rewardsBank.address,
      treasury.address,
      poolsStore.address,
      apolloDepositStore.address,
      rolesEventEmitter.address,
      poolEventsEmitter.address,
    ])) as LegacyPoolsNodes_Manager;

    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), manager.address);
    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), manager.address);


    await setBalance(rewardsBank.address, ethers.utils.parseEther("1000"));


    const catalogue = await new Catalogue__factory(owner).deploy(AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, AddressZero, manager.address);
    const context = await new Context__factory(owner).deploy([owner.address], catalogue.address, owner.address, "");
    const head = await new Head__factory(owner).deploy();
    await head.setContext(context.address);

    const realPool = await new LegacyPool__factory(owner).deploy("", 3, 100, 100, 100, owner.address, head.address);

    return {
      validatorSet, manager,
      poolsStore, apolloDepositStore, rolesEventEmitter, poolEventsEmitter,
      owner, pool1, pool2, user, realPool
    };
  }

  beforeEach(async function () {
    ({validatorSet, manager,
      poolsStore, apolloDepositStore, rolesEventEmitter, poolEventsEmitter,
      owner, pool1, pool2, user, realPool} = await deploy());
  });

  describe("onboard", function () {
    beforeEach(async function () {
      await manager.connect(owner).addPool(pool1.address);
    });

    it("should allow a staking pool to onboard a node with valid deposit", async function () {
      await manager.connect(pool1).onboard(user.address, 1, { value: ethers.utils.parseEther("10") });
      expect(await manager.getDeposit(user.address)).to.be.equal(ethers.utils.parseEther("10"));
    });

    it("should emit NodeOnboarded event when a node is onboarded", async function () {
      const transaction = manager.connect(pool1).onboard(user.address, 1, { value: ethers.utils.parseEther("10") });
      await expect(transaction)
        .to.emit(rolesEventEmitter, "NodeOnboarded")
        .withArgs(user.address, ethers.utils.parseEther("10"), "", 3);
    });

    it("should not allow a staking pool to onboard an already staking node", async function () {
      await manager.connect(pool1).onboard(user.address, 3, { value: ethers.utils.parseEther("10") });
      await expect(
        manager.connect(pool1).onboard(user.address, 3, { value: ethers.utils.parseEther("15") })
      ).to.be.revertedWith("Already staking");
    });

    it("should revert if call not from pool", async function () {
      await expect(
        manager.connect(owner).onboard(user.address, 1, { value: ethers.utils.parseEther("10") })
      ).to.be.revertedWith("The message sender is not pool");
    });

    it("should revert if contract paused", async function () {
      await manager.pause();
      await expect(
        manager.connect(pool1).onboard(user.address, 1, { value: ethers.utils.parseEther("10") })
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("retire", function () {
    beforeEach(async function () {
      await manager.addPool(pool1.address);
      await manager.connect(pool1).onboard(user.address, 3, { value: ethers.utils.parseEther("10") });
      expect(await manager.isPool(pool1.address)).to.equal(true);
    });

    it("should allow a staking pool to retire a staking node", async function () {
      const balanceBefore = await ethers.provider.getBalance(pool1.address);
      await manager.connect(pool1).retire(user.address, 3);
      const balanceAfter = await ethers.provider.getBalance(pool1.address);

      const amountTransferred = balanceAfter.sub(balanceBefore);
      const expectedAmount = ethers.utils.parseEther("10");

      expect(await manager.getDeposit(user.address)).to.be.equal(ethers.BigNumber.from("0"));
      expect(parseFloat(ethers.utils.formatEther(amountTransferred))).to.be.closeTo(
        parseFloat(ethers.utils.formatEther(expectedAmount)),
        0.01
      );
    });

    it("should emit NodeRetired event when a node is retired", async function () {
      const transaction = manager.connect(pool1).retire(user.address, 1);
      await expect(transaction)
        .to.emit(rolesEventEmitter, "NodeRetired")
        .withArgs(user.address, ethers.utils.parseEther("10"), 3);
    });

    it("should revert if the node is not staking", async function () {
      await manager.connect(pool1).retire(user.address, 3);
      await expect(manager.connect(pool1).retire(user.address, 3)).to.be.reverted;
    });

    it("should transfer the correct amount to the staking pool", async function () {
      const balanceBefore = await ethers.provider.getBalance(pool1.address);
      await manager.connect(pool1).retire(user.address, 3);
      const balanceAfter = await ethers.provider.getBalance(pool1.address);

      const amountTransferred = balanceAfter.sub(balanceBefore);
      const expectedAmount = ethers.utils.parseEther("10");
      expect(parseFloat(ethers.utils.formatEther(amountTransferred))).to.be.closeTo(
        parseFloat(ethers.utils.formatEther(expectedAmount)),
        0.01
      );
    });

    it("should revert if call not from pool", async function () {
      await expect(
        manager.connect(owner).retire(user.address, 1)
      ).to.be.revertedWith("The message sender is not pool");
    });


    it("should revert if contract paused", async function () {
      await manager.pause();
      await expect(
        manager.connect(pool1).retire(user.address, 1)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("poolStakeChanged", function () {
    beforeEach(async function () {
      await manager.addPool(pool1.address);
    });
    it("should emit PoolStakeChanged event with the correct parameters", async function () {
      const stake = 100;
      const tokens = 200;
      const transaction = manager.connect(pool1).poolStakeChanged(user.address, stake, tokens);

      await expect(transaction)
        .to.emit(poolEventsEmitter, "PoolStakeChanged")
        .withArgs(pool1.address, user.address, stake, tokens);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(manager.connect(owner).poolStakeChanged(user.address, 100, 200)).to.be.revertedWith(
        "The message sender is not pool"
      );
    });

    it("should revert if contract paused", async function () {
      await manager.pause();
      await expect(
        manager.connect(pool1).poolStakeChanged(user.address, 100, 200)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("poolReward", function () {
    beforeEach(async function () {
      await manager.addPool(pool1.address);
    });
    it("should emit PoolReward event with the correct parameters", async function () {
      const reward = 100;
      const tokenPrice = 200;
      const transaction = manager.connect(pool1).poolReward(reward, tokenPrice);

      await expect(transaction).to.emit(poolEventsEmitter, "PoolReward").withArgs(pool1.address, reward, tokenPrice);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(manager.connect(owner).poolReward(100, 200)).to.be.revertedWith("The message sender is not pool");
    });
  });

  describe("addNodeRequest", function () {
    beforeEach(async function () {
      await manager.addPool(pool1.address);
    });
    it("should emit AddNodeRequest event with the correct parameters", async function () {
      const stake = 100;
      const requestId = 1;
      const nodeId = 123;
      const transaction = manager.connect(pool1).addNodeRequest(stake, requestId, nodeId, 1);

      await expect(transaction).to.emit(poolEventsEmitter, "AddNodeRequest").withArgs(pool1.address, requestId, nodeId, stake, 1);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(manager.connect(owner).addNodeRequest(100, 1, 123, 1)).to.be.revertedWith(
        "The message sender is not pool"
      );
    });
  });

  describe("addNodeRequestResolved", function () {
    beforeEach(async function () {
      await manager.addPool(pool1.address);
    });
    it("should emit AddNodeRequestResolved event with the correct parameters", async function () {
      const requestId = 1;
      const status = 2;
      const transaction = manager.connect(pool1).addNodeRequestResolved(requestId, status);

      await expect(transaction)
        .to.emit(poolEventsEmitter, "AddNodeRequestResolved")
        .withArgs(pool1.address, requestId, status);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(manager.connect(owner).addNodeRequestResolved(1, 2)).to.be.revertedWith(
        "The message sender is not pool"
      );
    });
  });

  describe("nextId", function () {
    it("should increment the lastPoolId variable", async function () {
      const initialLastPoolId = await poolsStore.id();
      await manager.nextId();
      const newLastPoolId = await poolsStore.id();

      expect(newLastPoolId).to.equal(initialLastPoolId.add(1));
    });
  });

  describe("addPool", function () {
    it("should add a new pool and emit PoolAdded event", async function () {
      const [_, newPool] = await ethers.getSigners();
      const transaction = await manager.connect(owner).addPool(newPool.address);

      expect(await manager.isPool(newPool.address)).to.equal(true);
      expect(await manager.getPools()).to.be.lengthOf(1);
      expect(await manager.getPools()).to.include(newPool.address);

      await expect(transaction).to.emit(poolsStore, "PoolAdded").withArgs(newPool.address);
    });

    it("should revert if the pool address is 0x0", async function () {
      await expect(manager.connect(owner).addPool(AddressZero)).to.be.revertedWith("Pool must not be 0x0");
    });

    it("should revert if the pool is already registered", async function () {
      await manager.connect(owner).addPool(pool1.address);
      await expect(manager.connect(owner).addPool(pool1.address)).to.be.revertedWith("Pool already registered");
    });

    it("should only be callable by the contract owner", async function () {
      const [_, newPool] = await ethers.getSigners();
      await expect(manager.connect(newPool).addPool(newPool.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("removePool", function () {
    it("should remove a pool and emit PoolRemoved event", async function () {
      const [_, newPool] = await ethers.getSigners();

      await manager.connect(owner).addPool(newPool.address);

      expect(await manager.isPool(newPool.address)).to.equal(true);
      expect(await poolsStore.getPoolsCount()).to.equal(1);
      expect(await manager.getPools()).to.include(newPool.address);

      const transaction = await manager.connect(owner).removePool(newPool.address);

      expect(await manager.isPool(newPool.address)).to.equal(false);
      expect(await poolsStore.getPoolsCount()).to.equal(0);
      expect(await manager.getPools()).to.not.include(newPool.address);

      await expect(transaction).to.emit(poolsStore, "PoolRemoved").withArgs(newPool.address);
    });

    it("should revert if trying to remove a non-registered pool", async function () {
      const [_, nonRegisteredPool] = await ethers.getSigners();

      await expect(manager.connect(owner).removePool(nonRegisteredPool.address)).to.be.revertedWith(
        "Pool not registered"
      );
    });

    it("should revert if called by a non-owner address", async function () {
      await expect(manager.connect(pool1).removePool(pool1.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });


  describe("getDeposit", function () {
    beforeEach(async function () {
      await manager.addPool(pool1.address);
    });
    it("should return the correct deposit amount for a staking node", async function () {
      await manager.connect(pool1).onboard(user.address, 1, { value: ethers.utils.parseEther("10") });
      const depositAmount = await manager.getDeposit(user.address);
      expect(depositAmount).to.be.equal(ethers.utils.parseEther("10"));
    });

    it("should return 0 for a node that is not staking", async function () {
      const depositAmount = await manager.getDeposit(user.address);
      expect(depositAmount).to.be.equal(ethers.BigNumber.from("0"));
    });

    it("should return the updated deposit amount after a node's stake is changed", async function () {
      await manager.connect(pool1).onboard(user.address, 1,{ value: ethers.utils.parseEther("10") });
      await manager.connect(pool1).retire(user.address, 1);
      expect(await manager.getDeposit(user.address)).to.be.equal(ethers.BigNumber.from("0"));

      await manager.connect(pool1).onboard(user.address, 1, { value: ethers.utils.parseEther("15") });
      expect(await manager.getDeposit(user.address)).to.be.equal(ethers.utils.parseEther("15"));
    });
  });

  describe("getPools", function () {
    it("should return the correct array of pool addresses", async function () {
      await manager.addPool(pool1.address);
      await manager.addPool(pool2.address);

      const poolAddresses = await manager.getPools();

      expect(poolAddresses).to.have.lengthOf(2);
      expect(poolAddresses).to.include(pool1.address);
      expect(poolAddresses).to.include(pool2.address);
    });

    it("should return an empty array when no pools are added", async function () {
      expect(await manager.getPools()).to.have.lengthOf(0);
    });
  });

  describe("reward", function() {
    beforeEach(async function () {
      await impersonateAccount(realPool.address);
      await impersonateAccount(validatorSet.address);
      await setBalance(realPool.address, ethers.utils.parseEther("1000"));
      await setBalance(validatorSet.address, ethers.utils.parseEther("1000"));
    });

    it("should work", async function () {
      // add pool, register node
      await manager.connect(owner).addPool(realPool.address);
      await manager.connect(await ethers.getSigner(realPool.address)).onboard(user.address, 1, { value: ethers.utils.parseEther("10") });

      // call reward for this node
      await manager.connect(await ethers.getSigner(validatorSet.address)).reward(user.address, 100);
    });

    it("should revert if call not from validator set", async function() {
      await expect(manager.reward(user.address, 100)).to.be.revertedWith("Only validatorSet can call reward()");
    });
    it("should revert if can't find pool for node", async function() {
      // add pool, register node, remove pool
      await manager.connect(owner).addPool(realPool.address);
      await expect(manager.connect(await ethers.getSigner(validatorSet.address)).reward(user.address, 100)).to.be.revertedWith("Can't find pool for node");
    });
  });

  describe("report", function() {
    it("should work", async function () {
      await manager.report(user.address);
    });
  });

  describe("importOldStakes", function() {
    it("should work", async function () {
      await manager.importOldStakes([user.address], [pool1.address], [100]);
      expect(await manager.getDeposit(user.address)).to.be.equal(100);
    });
    it("should revert if invalid input", async function () {
      await expect(manager.importOldStakes([user.address], [pool1.address], [100, 200])).to.be.revertedWith("Invalid input");
    });
    it("should only be callable by the contract owner", async function () {
      await expect(manager.connect(pool1).importOldStakes([user.address], [pool1.address], [100, 200])).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });



  describe("pause / unpause", function() {
    it("should work", async function () {
      await manager.pause();
      expect(await manager.paused()).to.be.true;
      await manager.unpause();
      expect(await manager.paused()).to.be.false;
    });
    it("should only be callable by the contract owner", async function () {
      await expect(manager.connect(pool1).pause()).to.be.revertedWith("Ownable: caller is not the owner");
      await expect(manager.connect(pool1).unpause()).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });




});
