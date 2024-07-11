import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  TokenPool,
  RewardsBank__factory,
  AirBond__factory,
  TokenPool__factory,
} from "../../../typechain-types";

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
    const rewardTokenPrice = 2;
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

    it("Should set interest and min stake value", async function () {
      const newInterest = 300000; // 30%
      await tokenPool.setInterest(newInterest);
      expect(await tokenPool.interest()).to.equal(newInterest);

      const newMinStakeValue = 20;
      await tokenPool.setMinStakeValue(newMinStakeValue);
      expect(await tokenPool.minStakeValue()).to.equal(newMinStakeValue);
    });
  });

  describe("Staking and Unstaking", function () {
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
      const shares = tokenPool.getShare(owner.address);
      await tokenPool.unstake(shares);
      expect(await tokenPool.totalStake()).to.equal(0);
      expect(await tokenPool.getStake(owner.address)).to.equal(0);
    });

    it("Should not allow unstaking more than staked", async function () {
      const stake = 1000;
      await tokenPool.stake(stake);
      const shares = await tokenPool.getShare(owner.address);
      await expect(tokenPool.unstake(shares.mul(2))).to.be.revertedWith("Not enough share");
    });
  });
});

