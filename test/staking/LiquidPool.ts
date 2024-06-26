import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  LiquidPool,
  RewardsBank__factory,
  Treasury__factory,
  StAMB__factory,
  RewardsBank,
  StAMB,
  TEST_ValidatorSet
} from "../../typechain-types";
import { expect } from "chai";

describe("LiquidPool", function () {
  let liquidPool: LiquidPool;
  let stAMB: StAMB;
  let rewardsBank: RewardsBank;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  async function deploy() {
    const [owner, addr1] = await ethers.getSigners();

    const validatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(validatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);
    const stAMB = await new StAMB__factory(owner).deploy("Staked Amber","StAMB");

    const interest = 100000; // 10%
    const nodeStake = ethers.utils.parseEther("5000000");
    const minStakeValue = 10;
    const maxNodeCount = 10;
    const addresses: string[] = [];
    const tiers: number[] = [];

    const liquidPoolFactory = await ethers.getContractFactory("LiquidPool");
    const liquidPool = (await upgrades.deployProxy(liquidPoolFactory, [
      validatorSet.address,
      rewardsBank.address,
      treasury.address,
      stAMB.address,
      interest,
      nodeStake,
      minStakeValue,
      maxNodeCount,
      addresses,
      tiers
    ])) as LiquidPool;

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), liquidPool.address)).wait();
    await (await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), liquidPool.address)).wait();
    await (await stAMB.grantRole(await stAMB.DEFAULT_ADMIN_ROLE(), liquidPool.address)).wait();

    return { liquidPool, stAMB, rewardsBank, owner, addr1 };

  }

  beforeEach(async function () {
    ({ liquidPool, stAMB, rewardsBank, owner, addr1 } = await loadFixture(deploy));
    liquidPool.activate();
  });

  describe("Stacking", function () {
    it("should allow stacking", async function () {
      await expect(liquidPool.stake({ value: 50 })).to.changeEtherBalance(owner, -50);
      expect(await liquidPool.totalStake()).to.be.equal(50);
      expect(await liquidPool.getStake()).to.be.equal(50);
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(50);

      await expect(liquidPool.stake({ value: 25 })).to.changeEtherBalance(owner, -25);
      expect(await liquidPool.totalStake()).to.be.equal(75);
      expect(await liquidPool.getStake()).to.be.equal(75);
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(75);
    });

    it("should reject stakes below minStakeValue", async function () {
      await expect(liquidPool.stake({ value: 0 })).to.be.revertedWith("Pool: stake value too low");
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await liquidPool.grantRole(await liquidPool.BACKEND_ROLE(), owner.address);
      await liquidPool.stake({ value: 5000 });
      const tx = {
        value: 5000000,
        to: rewardsBank.address
      };
      await owner.sendTransaction(tx);
    });

    it("should distribute rewards", async function () {
      await liquidPool.distributeRewards();
      expect(await stAMB.rewardOf(owner.address)).to.be.equal(500);
      expect(await stAMB.totalRewards()).to.be.equal(500);
    });
  });

  describe("Unstacking", function () {
    beforeEach(async function () {
      await liquidPool.stake({ value: 50 });
    });

    it("should allow unstaking", async function () {
      await liquidPool.unstake(25); 
      expect(await liquidPool.totalStake()).to.be.equal(25);
      expect(await liquidPool.getStake()).to.be.equal(25);
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(25);
    });

    it("should reject unstaking more then staked", async function () {
      await expect(liquidPool.unstake(100)).to.be.revertedWith("Sender has not enough tokens");
    });
  });

  describe("Access control", function () {
    it("should only allow admin to set interest", async function () {
      await liquidPool.connect(owner).setInterest(1000);
      expect(await liquidPool.interest()).to.be.equal(1000);

      //TODO: What error message should be here?
      await expect(liquidPool.connect(addr1).setInterest(1000)).to.be.revertedWith("AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
    });
  });
  
  it("report", async function () {
    // do nothing, for coverage
    await liquidPool.report(owner.address);
  });

});
