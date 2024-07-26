import { ethers, upgrades, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  TokenPool,
  RewardsBank__factory,
  AirBond__factory,
} from "../../../typechain-types";

import TokenPoolJson from "../../../artifacts/contracts/staking/token/TokenPool.sol/TokenPool.json";

import { expect } from "chai";

describe("TokenPool", function () {
  let owner: SignerWithAddress;
  let tokenPool: TokenPool;
  let rewardsBank: RewardsBank;
  let token: AirBond;

  async function deploy() {
    const [owner] = await ethers.getSigners();
    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const token = await new AirBond__factory(owner).deploy(owner.address);
    const tokenPoolFactory = await ethers.getContractFactory("TokenPool");

    const name = "Test";
    const interest = 100000; // 10%
    const interestRate = 24 * 60 * 60; // 1 day
    const minStakeValue = 10;
    const rewardTokenPrice = 1;
    const tokenPool = (await upgrades.deployProxy(tokenPoolFactory, [
      name, token.address, rewardsBank.address, interest,
      interestRate, minStakeValue, token.address, rewardTokenPrice
    ])) as TokenPool;

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), tokenPool.address)).wait();
    await (await token.grantRole(await token.MINTER_ROLE(), owner.address)).wait();

    await token.mint(owner.address, 100000000000);

    return { owner, tokenPool, rewardsBank, token };
  }

  beforeEach(async function () {
    ({ owner, tokenPool, rewardsBank, token } = await loadFixture(deploy));
  });

  describe("Owner Methods", function () {
    it("Should activate and deactivate the pool", async function () {
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
      expect(await tokenPool.totalStake()).to.equal(stake);
      expect(await tokenPool.getStake(owner.address)).to.equal(stake);
    });

    it("Should not allow staking below minimum stake value", async function () {
      await expect(tokenPool.stake(1)).to.be.revertedWith("Amount is less than minStakeValue");
    });

    it("Should allow unstaking", async function () {
      const stake = 1000;
      await tokenPool.stake(stake);
      await tokenPool.unstake(stake);
      expect(await tokenPool.totalStake()).to.equal(0);
      expect(await tokenPool.getStake(owner.address)).to.equal(0);
    });

    it("Should not allow unstaking more than staked", async function () {
      const stake = 1000;
      await tokenPool.stake(stake);
      await expect(tokenPool.unstake(stake * 2)).to.be.revertedWith("Not enough stake");
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      await token.mint(owner.address, 100000000000);
      await token.approve(tokenPool.address, 1000000);
      await token.transfer(rewardsBank.address, 10000);
    });

    it("Should allow claiming rewards", async function () {
      const stake = 1000;
      await tokenPool.stake(stake);

      const rewardBefore = await tokenPool.getReward(owner.address);
      console.log("rewardBefore", rewardBefore.toString());

      // Wait for 1 day
      const futureTime = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
      await network.provider.send("evm_mine"); // Mine a block to apply the new timestamp

      const expectedReward = 100;
      const rewards = await tokenPool.getReward(owner.address);
      console.log("reward", rewards.toString());
      expect (rewards).to.equal(expectedReward);

      const balanceBefore = await token.balanceOf(owner.address);
      await tokenPool.claim();
      const balanceAfter = await token.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(100);
    });
  });
});

