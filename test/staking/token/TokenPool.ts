import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  TokenPool,
  RewardsBank__factory,
  AirBond__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

const D1 = 24 * 60 * 60;
const BILLION = 1000000000;

import { expect } from "chai";
describe("TokenPool", function () {
  let owner: SignerWithAddress;
  let tokenPool: TokenPool;
  let rewardsBank: RewardsBank;
  let lockKeeper: LockKeeper;
  let token: AirBond;

  async function deploy() {
    const [owner] = await ethers.getSigners();
    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const token = await new AirBond__factory(owner).deploy(owner.address);
    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const tokenPoolFactory = await ethers.getContractFactory("TokenPool");

    const mainConfig: TokenPool.MainConfigStruct = {
      token: token.address,
      name: "Test",
      rewardToken: token.address,
    };

    const limitsConfig: TokenPool.LimitsConfigStruct = {
      minStakeValue: 10,
      fastUnstakePenalty: 0.10 * BILLION, // 10%
      interest: 0.10 * BILLION, // 10%
      interestRate: D1, // 1 day
      lockPeriod: D1, // 1 day
      rewardTokenPrice: 1,
    };
    
    const tokenPool = (await upgrades.deployProxy(tokenPoolFactory, [rewardsBank.address, lockKeeper.address, mainConfig, limitsConfig])) as TokenPool;

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), tokenPool.address)).wait();
    await (await token.grantRole(await token.MINTER_ROLE(), owner.address)).wait();

    await token.mint(owner.address, 100000000000);

    return { owner, tokenPool, rewardsBank, lockKeeper, token };
  }

  beforeEach(async function () {
    ({ owner, tokenPool, rewardsBank, lockKeeper, token } = await loadFixture(deploy));
  });

  describe("Owner Methods", function () {
    it("Should deactivate and activate the pool", async function () {
      await tokenPool.deactivate();
      expect(await tokenPool.active()).to.equal(false);

      await tokenPool.activate();
      expect(await tokenPool.active()).to.equal(true);
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      await token.approve(tokenPool.address, 1000000);
    });

    it("Should allow staking", async function () {
      const stake = 1000;
      await tokenPool.stake(stake);
      const info = await tokenPool.info();
      expect(info.totalStake).to.equal(stake);
      expect(await tokenPool.getStake(owner.address)).to.equal(stake);
    });

    it("Should not allow staking when pool is deactivated", async function () {
      await tokenPool.deactivate();
      await expect(tokenPool.stake(1000)).to.be.revertedWith("Pool is not active");
    });

    it("Should not allow staking below minimum stake value", async function () {
      await expect(tokenPool.stake(1)).to.be.revertedWith("Pool: stake value is too low");
    });

  });

  describe("Unstaking", function () {
    const stake = 1000;

    beforeEach(async function () {
      await token.approve(tokenPool.address, 1000000000);
      await tokenPool.stake(stake);
    });

    it("Should allow unstaking with rewards", async function () {
      await time.increase(D1);
      await tokenPool.onBlock();

      await expect(await tokenPool.unstake(stake)).to.emit(lockKeeper, "Locked");
      const info = await tokenPool.info();
      expect(info.totalStake).to.equal(0);
      expect(await tokenPool.getStake(owner.address)).to.equal(0);
    });

    it("Should allow fast unstaking with rewards", async function () {
      await time.increase(D1);
      await tokenPool.onBlock();

      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);
    });

    it("Should allow unstaking without rewards", async function () {
      await expect(tokenPool.unstake(stake)).to.emit(lockKeeper, "Locked");
    });

    it("Should allow fast unstaking without rewards", async function () {
      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);
    });

    it("Should not allow unstaking more than staked", async function () {
      await expect(tokenPool.unstake(stake * 2)).to.be.revertedWith("Not enough stake");
    });

    it("Should not allow fast unstaking more than staked", async function () {
      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);

    });

    it("Should allow unstaking when pool is deactivated", async function () {
      await tokenPool.deactivate();
      await expect(tokenPool.unstake(stake)).to.emit(lockKeeper, "Locked");
    });

    it("Should allow fast unstaking when pool is deactivated", async function () {
      await tokenPool.deactivate();
      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await token.mint(owner.address, 100000000000);
      await token.approve(tokenPool.address, 1000000);
      await token.transfer(rewardsBank.address, 10000);
    });

    it("Should allow claiming rewards", async function () {
      await tokenPool.stake(1000);

      // Wait for 1 day
      await time.increase(D1);
      await tokenPool.onBlock();

      const expectedReward = 100;
      const rewards = await tokenPool.getUserRewards(owner.address);
      expect (rewards).to.equal(expectedReward);

      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.claim();
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(100);
    });

    it("Should allow claiming rewards when pool is deactivated", async function () {
      await tokenPool.stake(1000);

      // Wait for 1 day
      await time.increase(D1);
      await tokenPool.onBlock();

      await tokenPool.deactivate();

      const expectedReward = 100;
      const rewards = await tokenPool.getUserRewards(owner.address);
      expect (rewards).to.equal(expectedReward);

      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.claim();
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(100);
    });
  });

  //TODO: Initialize for coverage
  //TODO: Sets for coverage???
});

