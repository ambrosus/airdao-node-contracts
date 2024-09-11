import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  SingleSidePool,
  RewardsBank__factory,
  AirBond__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

const D1 = 24 * 60 * 60;

import { expect } from "chai";
describe("SingleSidePool", function () {
  let owner: SignerWithAddress;
  let singleSidePool: SingleSidePool;
  let rewardsBank: RewardsBank;
  let lockKeeper: LockKeeper;
  let token: AirBond;

  async function deploy() {
    const [owner] = await ethers.getSigners();
    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const token = await new AirBond__factory(owner).deploy(owner.address);
    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const singleSidePoolFactory = await ethers.getContractFactory("SingleSidePool");

    const singleSidePoolParams: SingleSidePool.ConfigStruct = {
      token: token.address,
      rewardsBank: rewardsBank.address,
      lockKeeper: lockKeeper.address,
      name: "Test",
      minStakeValue: 10,
      fastUnstakePenalty: 100000, // 10%
      interest: 100000, // 10%
      interestRate: D1, // 1 day
      lockPeriod: D1, // 1 day
      rewardToken: token.address,
      rewardTokenPrice: 1,
    };
    
    const singleSidePool = (await upgrades.deployProxy(singleSidePoolFactory, [singleSidePoolParams])) as SingleSidePool;

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), singleSidePool.address)).wait();
    await (await token.grantRole(await token.MINTER_ROLE(), owner.address)).wait();

    await token.mint(owner.address, 100000000000);

    return { owner, singleSidePool, rewardsBank, lockKeeper, token };
  }

  beforeEach(async function () {
    ({ owner, singleSidePool, rewardsBank, lockKeeper, token } = await loadFixture(deploy));
  });

  describe("Owner Methods", function () {
    it("Should deactivate and activate the pool", async function () {
      await singleSidePool.deactivate();
      expect(await singleSidePool.active()).to.equal(false);

      await singleSidePool.activate();
      expect(await singleSidePool.active()).to.equal(true);
    });
  });

  describe("Staking", function () {
    beforeEach(async function () {
      await token.approve(singleSidePool.address, 1000000);
    });

    it("Should allow staking", async function () {
      const stake = 1000;
      await singleSidePool.stake(stake);
      const info = await singleSidePool.info();
      expect(info.totalStake).to.equal(stake);
      expect(await singleSidePool.getStake(owner.address)).to.equal(stake);
    });

    it("Should not allow staking when pool is deactivated", async function () {
      await singleSidePool.deactivate();
      await expect(singleSidePool.stake(1000)).to.be.revertedWith("Pool is not active");
    });

    it("Should not allow staking below minimum stake value", async function () {
      await expect(singleSidePool.stake(1)).to.be.revertedWith("Pool: stake value is too low");
    });

  });

  describe("Unstaking", function () {
    const stake = 1000;

    beforeEach(async function () {
      await token.approve(singleSidePool.address, 1000000000);
      await singleSidePool.stake(stake);
    });

    it("Should allow unstaking with rewards", async function () {
      await time.increase(D1);
      await singleSidePool.onBlock();

      await expect(await singleSidePool.unstake(stake)).to.emit(lockKeeper, "Locked");
      const info = await singleSidePool.info();
      expect(info.totalStake).to.equal(0);
      expect(await singleSidePool.getStake(owner.address)).to.equal(0);
    });

    it("Should allow fast unstaking with rewards", async function () {
      await time.increase(D1);
      await singleSidePool.onBlock();

      const balanceBefore = await token.balanceOf(owner.address);
      await singleSidePool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);
    });

    it("Should allow unstaking without rewards", async function () {
      await expect(singleSidePool.unstake(stake)).to.emit(lockKeeper, "Locked");
    });

    it("Should allow fast unstaking without rewards", async function () {
      const balanceBefore = await token.balanceOf(owner.address);
      await singleSidePool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);
    });

    it("Should not allow unstaking more than staked", async function () {
      await expect(singleSidePool.unstake(stake * 2)).to.be.revertedWith("Not enough stake");
    });

    it("Should not allow fast unstaking more than staked", async function () {
      const balanceBefore = await token.balanceOf(owner.address);
      await singleSidePool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);

    });

    it("Should allow unstaking when pool is deactivated", async function () {
      await singleSidePool.deactivate();
      await expect(singleSidePool.unstake(stake)).to.emit(lockKeeper, "Locked");
    });

    it("Should allow fast unstaking when pool is deactivated", async function () {
      await singleSidePool.deactivate();
      const balanceBefore = await token.balanceOf(owner.address);
      await singleSidePool.unstakeFast(stake);
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake * 0.9);
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await token.mint(owner.address, 100000000000);
      await token.approve(singleSidePool.address, 1000000);
      await token.transfer(rewardsBank.address, 10000);
    });

    it("Should allow claiming rewards", async function () {
      await singleSidePool.stake(1000);

      // Wait for 1 day
      await time.increase(D1);
      await singleSidePool.onBlock();

      const expectedReward = 100;
      const rewards = await singleSidePool.getUserRewards(owner.address);
      expect (rewards).to.equal(expectedReward);

      const balanceBefore = await token.balanceOf(owner.address);
      await singleSidePool.claim();
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(100);
    });

    it("Should allow claiming rewards when pool is deactivated", async function () {
      await singleSidePool.stake(1000);

      // Wait for 1 day
      await time.increase(D1);
      await singleSidePool.onBlock();

      await singleSidePool.deactivate();

      const expectedReward = 100;
      const rewards = await singleSidePool.getUserRewards(owner.address);
      expect (rewards).to.equal(expectedReward);

      const balanceBefore = await token.balanceOf(owner.address);
      await singleSidePool.claim();
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(100);
    });
  });

  //TODO: Initialize for coverage
  //TODO: Sets for coverage???
});

