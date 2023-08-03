import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { PoolsNodes_Manager, RewardsEmitter__factory, TEST_ValidatorSet } from "../../../typechain-types";
import { AddressZero } from "@ethersproject/constants";

describe("PoolsNodes_Manager", function () {
  let validatorSet: TEST_ValidatorSet;
  let poolsNodes: PoolsNodes_Manager;
  let owner: SignerWithAddress;
  let pool1: SignerWithAddress;
  let pool2: SignerWithAddress;
  let user: SignerWithAddress;

  async function deploy() {
    const [owner, pool1, pool2, user] = await ethers.getSigners();

    const rewardsEmitter = await new RewardsEmitter__factory(owner).deploy();

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [
      owner.address,
      rewardsEmitter.address,
      10,
      2,
    ])) as TEST_ValidatorSet;

    const PoolsNodes_ManagerFactory = await ethers.getContractFactory("PoolsNodes_Manager");
    const poolsNodes = await PoolsNodes_ManagerFactory.deploy(ethers.utils.parseEther("10"), validatorSet.address, 1);

    await rewardsEmitter.grantRole(await rewardsEmitter.EMITTER_ROLE(), validatorSet.address);
    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), poolsNodes.address);

    return { validatorSet, poolsNodes, owner, pool1, pool2, user };
  }

  beforeEach(async function () {
    ({ validatorSet, poolsNodes, owner, pool1, pool2, user } = await deploy());
  });

  describe("onboard", function () {
    beforeEach(async function () {
      await poolsNodes.connect(owner).addPool(pool1.address);
    });
    it("should allow a staking pool to onboard a node with valid deposit", async function () {
      await poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("10") });
      expect(await poolsNodes.getDeposit(user.address)).to.be.equal(ethers.utils.parseEther("10"));
    });

    it("should emit NodeOnboarded event when a node is onboarded", async function () {
      const transaction = poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("10") });
      await expect(transaction)
        .to.emit(poolsNodes, "NodeOnboarded")
        .withArgs(user.address, ethers.utils.parseEther("10"));
    });

    it("should not allow a staking pool to onboard a node with invalid deposit", async function () {
      await expect(
        poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("5") })
      ).to.be.revertedWith("Invalid deposit value");
    });

    it("should not allow a staking pool to onboard an already staking node", async function () {
      await poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("10") });
      await expect(
        poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("15") })
      ).to.be.revertedWith("Already staking");
    });
  });

  describe("retire", function () {
    beforeEach(async function () {
      await poolsNodes.addPool(pool1.address);
      await poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("10") });
    });

    it("should allow a staking pool to retire a staking node", async function () {
      const balanceBefore = await ethers.provider.getBalance(pool1.address);
      await poolsNodes.connect(pool1).retire(user.address);
      const balanceAfter = await ethers.provider.getBalance(pool1.address);

      const amountTransferred = balanceAfter.sub(balanceBefore);
      const expectedAmount = ethers.utils.parseEther("10");

      expect(await poolsNodes.getDeposit(user.address)).to.be.equal(ethers.BigNumber.from("0"));
      expect(parseFloat(ethers.utils.formatEther(amountTransferred))).to.be.closeTo(
        parseFloat(ethers.utils.formatEther(expectedAmount)),
        0.01
      );
    });

    it("should emit NodeRetired event when a node is retired", async function () {
      const transaction = poolsNodes.connect(pool1).retire(user.address);
      await expect(transaction)
        .to.emit(poolsNodes, "NodeRetired")
        .withArgs(user.address, ethers.utils.parseEther("10"));
    });

    it("should revert if the node is not staking", async function () {
      await poolsNodes.connect(pool1).retire(user.address);
      await expect(poolsNodes.connect(pool1).retire(user.address)).to.be.revertedWith("No such node");
    });

    it("should transfer the correct amount to the staking pool", async function () {
      const balanceBefore = await ethers.provider.getBalance(pool1.address);
      await poolsNodes.connect(pool1).retire(user.address);
      const balanceAfter = await ethers.provider.getBalance(pool1.address);

      const amountTransferred = balanceAfter.sub(balanceBefore);
      const expectedAmount = ethers.utils.parseEther("10");
      expect(parseFloat(ethers.utils.formatEther(amountTransferred))).to.be.closeTo(
        parseFloat(ethers.utils.formatEther(expectedAmount)),
        0.01
      );
    });
  });

  describe("poolStakeChanged", function () {
    beforeEach(async function () {
      await poolsNodes.addPool(pool1.address);
    });
    it("should emit PoolStakeChanged event with the correct parameters", async function () {
      const stake = 100;
      const tokens = 200;
      const transaction = poolsNodes.connect(pool1).poolStakeChanged(user.address, stake, tokens);

      await expect(transaction)
        .to.emit(poolsNodes, "PoolStakeChanged")
        .withArgs(pool1.address, user.address, stake, tokens);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(poolsNodes.connect(owner).poolStakeChanged(user.address, 100, 200)).to.be.revertedWith(
        "The message sender is not pool"
      );
    });
  });

  describe("poolReward", function () {
    beforeEach(async function () {
      await poolsNodes.addPool(pool1.address);
    });
    it("should emit PoolReward event with the correct parameters", async function () {
      const reward = 100;
      const tokenPrice = 200;
      const transaction = poolsNodes.connect(pool1).poolReward(reward, tokenPrice);

      await expect(transaction).to.emit(poolsNodes, "PoolReward").withArgs(pool1.address, reward, tokenPrice);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(poolsNodes.connect(owner).poolReward(100, 200)).to.be.revertedWith("The message sender is not pool");
    });
  });

  describe("addNodeRequest", function () {
    beforeEach(async function () {
      await poolsNodes.addPool(pool1.address);
    });
    it("should emit AddNodeRequest event with the correct parameters", async function () {
      const stake = 100;
      const requestId = 1;
      const nodeId = 123;
      const transaction = poolsNodes.connect(pool1).addNodeRequest(stake, requestId, nodeId);

      await expect(transaction).to.emit(poolsNodes, "AddNodeRequest").withArgs(pool1.address, requestId, nodeId, stake);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(poolsNodes.connect(owner).addNodeRequest(100, 1, 123)).to.be.revertedWith(
        "The message sender is not pool"
      );
    });
  });

  describe("addNodeRequestResolved", function () {
    beforeEach(async function () {
      await poolsNodes.addPool(pool1.address);
    });
    it("should emit AddNodeRequestResolved event with the correct parameters", async function () {
      const requestId = 1;
      const status = 2;
      const transaction = poolsNodes.connect(pool1).addNodeRequestResolved(requestId, status);

      await expect(transaction)
        .to.emit(poolsNodes, "AddNodeRequestResolved")
        .withArgs(pool1.address, requestId, status);
    });

    it("should revert if called by a non-staking pool", async function () {
      await expect(poolsNodes.connect(owner).addNodeRequestResolved(1, 2)).to.be.revertedWith(
        "The message sender is not pool"
      );
    });
  });

  describe("nextId", function () {
    it("should increment the lastPoolId variable", async function () {
      const initialLastPoolId = await poolsNodes.lastPoolId();
      await poolsNodes.nextId();
      const newLastPoolId = await poolsNodes.lastPoolId();

      expect(newLastPoolId).to.equal(initialLastPoolId.add(1));
    });
  });

  describe("addPool", function () {
    it("should add a new pool and emit PoolAdded event", async function () {
      const [_, newPool] = await ethers.getSigners();
      const transaction = await poolsNodes.connect(owner).addPool(newPool.address);

      expect(await poolsNodes.isPool(newPool.address)).to.equal(true);
      expect(await poolsNodes.getPoolsCount()).to.equal(1);
      expect(await poolsNodes.getPools()).to.include(newPool.address);

      await expect(transaction).to.emit(poolsNodes, "PoolAdded").withArgs(newPool.address);
    });

    it("should revert if the pool address is 0x0", async function () {
      await expect(poolsNodes.connect(owner).addPool(AddressZero)).to.be.revertedWith("Pool must not be 0x0");
    });

    it("should revert if the pool is already registered", async function () {
      await poolsNodes.connect(owner).addPool(pool1.address);
      await expect(poolsNodes.connect(owner).addPool(pool1.address)).to.be.revertedWith("Pool already registered");
    });

    it("should only be callable by the contract owner", async function () {
      const [_, newPool] = await ethers.getSigners();
      await expect(poolsNodes.connect(newPool).addPool(newPool.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("removePool", function () {
    it("should remove a pool and emit PoolRemoved event", async function () {
      const [_, newPool] = await ethers.getSigners();

      await poolsNodes.connect(owner).addPool(newPool.address);

      expect(await poolsNodes.isPool(newPool.address)).to.equal(true);
      expect(await poolsNodes.getPoolsCount()).to.equal(1);
      expect(await poolsNodes.getPools()).to.include(newPool.address);

      const transaction = await poolsNodes.connect(owner).removePool(newPool.address);

      expect(await poolsNodes.isPool(newPool.address)).to.equal(false);
      expect(await poolsNodes.getPoolsCount()).to.equal(0);
      expect(await poolsNodes.getPools()).to.not.include(newPool.address);

      await expect(transaction).to.emit(poolsNodes, "PoolRemoved").withArgs(newPool.address);
    });

    it("should revert if trying to remove a non-registered pool", async function () {
      const [_, nonRegisteredPool] = await ethers.getSigners();

      await expect(poolsNodes.connect(owner).removePool(nonRegisteredPool.address)).to.be.revertedWith(
        "Pool not registered"
      );
    });

    it("should revert if called by a non-owner address", async function () {
      await expect(poolsNodes.connect(pool1).removePool(pool1.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("changeMinApolloDeposit", function () {
    it("should change the minimum deposit when called by the owner", async function () {
      const newMinDeposit = ethers.utils.parseEther("5");

      expect(await poolsNodes.minApolloDeposit()).to.equal(ethers.utils.parseEther("10"));

      await poolsNodes.connect(owner).changeMinApolloDeposit(newMinDeposit);

      expect(await poolsNodes.minApolloDeposit()).to.equal(newMinDeposit);
    });

    it("should reject changing the minimum deposit from an account that is not the owner", async function () {
      expect(await poolsNodes.minApolloDeposit()).to.equal(ethers.utils.parseEther("10"));
      await expect(poolsNodes.connect(pool1).changeMinApolloDeposit(ethers.utils.parseEther("5"))).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
      expect(await poolsNodes.minApolloDeposit()).to.equal(ethers.utils.parseEther("10"));
    });
  });

  describe("getDeposit", function () {
    beforeEach(async function () {
      await poolsNodes.addPool(pool1.address);
    });
    it("should return the correct deposit amount for a staking node", async function () {
      await poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("10") });
      const depositAmount = await poolsNodes.getDeposit(user.address);
      expect(depositAmount).to.be.equal(ethers.utils.parseEther("10"));
    });

    it("should return 0 for a node that is not staking", async function () {
      const depositAmount = await poolsNodes.getDeposit(user.address);
      expect(depositAmount).to.be.equal(ethers.BigNumber.from("0"));
    });

    it("should return the updated deposit amount after a node's stake is changed", async function () {
      await poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("10") });
      await poolsNodes.connect(pool1).retire(user.address);
      expect(await poolsNodes.getDeposit(user.address)).to.be.equal(ethers.BigNumber.from("0"));

      await poolsNodes.connect(pool1).onboard(user.address, { value: ethers.utils.parseEther("15") });
      expect(await poolsNodes.getDeposit(user.address)).to.be.equal(ethers.utils.parseEther("15"));
    });
  });

  describe("getPoolsCount", function () {
    it("should return the correct number of pools", async function () {
      await poolsNodes.addPool(pool1.address);
      await poolsNodes.addPool(pool2.address);
      const poolCount = await poolsNodes.getPoolsCount();
      expect(poolCount).to.equal(2);
    });

    it("should return 0 when no pools are added", async function () {
      expect(await poolsNodes.getPoolsCount()).to.equal(0);
    });
  });

  describe("getPools", function () {
    it("should return the correct array of pool addresses", async function () {
      await poolsNodes.addPool(pool1.address);
      await poolsNodes.addPool(pool2.address);

      const poolAddresses = await poolsNodes.getPools();

      expect(poolAddresses).to.have.lengthOf(2);
      expect(poolAddresses).to.include(pool1.address);
      expect(poolAddresses).to.include(pool2.address);
    });

    it("should return an empty array when no pools are added", async function () {
      expect(await poolsNodes.getPools()).to.have.lengthOf(0);
    });
  });
});
