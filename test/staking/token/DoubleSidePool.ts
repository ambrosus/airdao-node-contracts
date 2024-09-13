import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  DoubleSidePool,
  RewardsBank__factory,
  AirBond__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

const D1 = 24 * 60 * 60;
const BILLION = 1_000_000_000;

import { expect } from "chai";

describe("DoubleSidePool", function () {
  let owner: SignerWithAddress;
  let doubleSidePool: DoubleSidePool;
  let rewardsBank: RewardsBank;
  let lockKeeper: LockKeeper;
  let mainToken: AirBond;
  let dependantToken: AirBond;

  async function deploy() {
    const [owner] = await ethers.getSigners();
    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const mainToken = await new AirBond__factory(owner).deploy(owner.address);
    const dependantToken = await new AirBond__factory(owner).deploy(owner.address);
    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const doubleSidePoolFactory = await ethers.getContractFactory("DoubleSidePool");

    const mainSideConfig: DoubleSidePool.MainSideConfigStruct = {
      token: mainToken.address,
      rewardToken: mainToken.address,
      rewardTokenPrice: 1, // 1:1 ratio
      minStakeValue: 10,
      unstakeLockPeriod: D1, // 1 day
      fastUnstakePenalty: 0.10 * BILLION, // 10%
      lockPeriod: D1, // 1 day
      interest: 0.10 * BILLION, // 10%
      interestRate: D1, // 1 day
    };

    const doubleSidePool = (await upgrades.deployProxy(doubleSidePoolFactory, [
      rewardsBank.address,
      lockKeeper.address,
      "Test Double Side Pool",
      mainSideConfig
    ])) as DoubleSidePool;

    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), doubleSidePool.address);
    await mainToken.grantRole(await mainToken.MINTER_ROLE(), owner.address);
    await dependantToken.grantRole(await dependantToken.MINTER_ROLE(), owner.address);

    await mainToken.mint(owner.address, ethers.utils.parseEther("1000000"));
    await dependantToken.mint(owner.address, ethers.utils.parseEther("1000000"));

    return { owner, doubleSidePool, rewardsBank, lockKeeper, mainToken, dependantToken };
  }

  beforeEach(async function () {
    ({ owner, doubleSidePool, rewardsBank, lockKeeper, mainToken, dependantToken } = await loadFixture(deploy));
  });

  describe("Initialization", function () {
    it("Should initialize with correct main side config", async function () {
      const config = await doubleSidePool.mainSideConfig();
      expect(config.token).to.equal(mainToken.address);
      expect(config.rewardToken).to.equal(mainToken.address);
      expect(config.rewardTokenPrice).to.equal(1);
      expect(config.minStakeValue).to.equal(10);
      expect(config.unstakeLockPeriod).to.equal(D1);
      expect(config.fastUnstakePenalty).to.equal(0.10 * BILLION);
      expect(config.lockPeriod).to.equal(D1);
      expect(config.interest).to.equal(0.10 * BILLION);
      expect(config.interestRate).to.equal(D1);
    });

    it("Should not have a dependant side initially", async function () {
      expect(await doubleSidePool.hasSecondSide()).to.be.false;
    });
  });

  describe("Owner Methods", function () {
    it("Should deactivate and activate the pool", async function () {
      await doubleSidePool.deactivate();
      expect(await doubleSidePool.active()).to.be.false;

      await doubleSidePool.activate();
      expect(await doubleSidePool.active()).to.be.true;
    });

    it("Should add a dependant side", async function () {
      const dependantSideConfig: DoubleSidePool.DependantSideConfigStruct = {
        token: dependantToken.address,
        rewardToken: dependantToken.address,
        rewardTokenPrice: BILLION,
        minStakeValue: 5,
        unstakeLockPeriod: D1,
        fastUnstakePenalty: 0.05 * BILLION,
        lockPeriod: D1,
        interest: 0.15 * BILLION,
        interestRate: D1,
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLockPeriod: D1,
        stakeLimitsMultiplier: 2 * BILLION,
      };

      await doubleSidePool.addDependantSide(dependantSideConfig);
      expect(await doubleSidePool.hasSecondSide()).to.be.true;

      const config = await doubleSidePool.dependantSideConfig();
      expect(config.token).to.equal(dependantToken.address);
      expect(config.rewardToken).to.equal(dependantToken.address);
      expect(config.rewardTokenPrice).to.equal(BILLION);
      expect(config.minStakeValue).to.equal(5);
      expect(config.unstakeLockPeriod).to.equal(D1);
      expect(config.fastUnstakePenalty).to.equal(0.05 * BILLION);
      expect(config.lockPeriod).to.equal(D1);
      expect(config.interest).to.equal(0.15 * BILLION);
      expect(config.interestRate).to.equal(D1);
      expect(config.maxTotalStakeValue).to.equal(ethers.utils.parseEther("1000000"));
      expect(config.maxStakePerUserValue).to.equal(ethers.utils.parseEther("100000"));
      expect(config.stakeLockPeriod).to.equal(D1);
      expect(config.stakeLimitsMultiplier).to.equal(2 * BILLION);
    });
  });

  describe("Main Side Staking", function () {
    beforeEach(async function () {
      await mainToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
    });

    it("Should allow staking on the main side", async function () {
      const stake = ethers.utils.parseEther("1000");
      await doubleSidePool.stake(false, stake);
      const info = await doubleSidePool.mainSideInfo();
      expect(info.totalStake).to.equal(stake);
      const staker = await doubleSidePool.getMainSideStaker(owner.address);
      expect(staker.stake).to.equal(stake);
    });

    it("Should not allow staking when pool is deactivated", async function () {
      await doubleSidePool.deactivate();
      await expect(doubleSidePool.stake(false, 1000)).to.be.revertedWith("Pool is not active");
    });

    it("Should not allow staking below minimum stake value", async function () {
      await expect(doubleSidePool.stake(false, 1)).to.be.revertedWith("Pool: stake value is too low");
    });
  });

  describe("Main Side Unstaking", function () {
    const stake = ethers.utils.parseEther("1000");

    beforeEach(async function () {
      await mainToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
      await doubleSidePool.stake(false, stake);
    });

    it("Should allow unstaking with rewards", async function () {
      await time.increase(D1);
      await doubleSidePool.onBlock();

      await expect(doubleSidePool.unstake(false, stake)).to.emit(lockKeeper, "Locked");
      const info = await doubleSidePool.mainSideInfo();
      expect(info.totalStake).to.equal(0);
      const staker = await doubleSidePool.getMainSideStaker(owner.address);
      expect(staker.stake).to.equal(0);
    });

    it("Should allow fast unstaking with rewards", async function () {
      await time.increase(D1);
      await doubleSidePool.onBlock();

      const balanceBefore = await mainToken.balanceOf(owner.address);
      await doubleSidePool.unstakeFast(false, stake);
      const balanceAfter = await mainToken.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(stake.mul(90).div(100)); // 90% due to 10% penalty
    });

    it("Should not allow unstaking more than staked", async function () {
      await expect(doubleSidePool.unstake(false, stake.mul(2))).to.be.revertedWith("Not enough stake");
    });

    it("Should allow unstaking when pool is deactivated", async function () {
      await doubleSidePool.deactivate();
      await expect(doubleSidePool.unstake(false, stake)).to.emit(lockKeeper, "Locked");
    });
  });

  describe("Main Side Rewards", function () {
    beforeEach(async function () {
      await mainToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
      await mainToken.transfer(rewardsBank.address, ethers.utils.parseEther("10000"));
    });

    it("Should allow claiming rewards", async function () {
      await doubleSidePool.stake(false, 1000);

      await time.increase(D1);
      await doubleSidePool.onBlock();

      const expectedReward = 100; // 10% interest
      const rewards = await doubleSidePool.getUserMainSideRewards(owner.address);
      console.log("Main side rewards: ", rewards.toString());
      expect(rewards).to.equal(expectedReward);

      const balanceBefore = await mainToken.balanceOf(owner.address);
      await doubleSidePool.claim(false);
      const balanceAfter = await mainToken.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReward);
    });

    it("Should allow claiming rewards when pool is deactivated", async function () {
      await doubleSidePool.stake(false, 1000);

      await time.increase(D1);
      await doubleSidePool.onBlock();

      await doubleSidePool.deactivate();

      const expectedReward = 100; // 10% interest
      const rewards = await doubleSidePool.getUserMainSideRewards(owner.address);
      expect(rewards).to.equal(expectedReward);

      const balanceBefore = await mainToken.balanceOf(owner.address);
      await doubleSidePool.claim(false);
      const balanceAfter = await mainToken.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReward);
    });
  });

  describe("Dependant Side", function () {
    beforeEach(async function () {
      const dependantSideConfig: DoubleSidePool.DependantSideConfigStruct = {
        token: dependantToken.address,
        rewardToken: dependantToken.address,
        rewardTokenPrice: 1,
        minStakeValue: 10,
        unstakeLockPeriod: D1,
        fastUnstakePenalty: 0.05 * BILLION,
        lockPeriod: D1,
        interest: 0.15 * BILLION,
        interestRate: D1,
        maxTotalStakeValue: BILLION * 1000,
        maxStakePerUserValue: BILLION,
        stakeLockPeriod: D1 * 30,
        stakeLimitsMultiplier: 2,
      };

      await doubleSidePool.addDependantSide(dependantSideConfig);
      await dependantToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
      await mainToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
      await mainToken.transfer(rewardsBank.address, ethers.utils.parseEther("10000"));
      await dependantToken.transfer(rewardsBank.address, ethers.utils.parseEther("10000"));
    });

    it("Should allow staking on the dependant side", async function () {
      const mainStake = 100000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = 100;
      await doubleSidePool.stake(true, dependantStake);

      const info = await doubleSidePool.dependantSideInfo();
      expect(info.totalStake).to.equal(dependantStake);
      const staker = await doubleSidePool.getDependantSideStaker(owner.address);
      expect(staker.stake).to.equal(dependantStake);
    });

    it("Should not allow staking on dependant side beyond the limit", async function () {
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = ethers.utils.parseEther("2001"); // Exceeds 2x main stake
      await expect(doubleSidePool.stake(true, dependantStake)).to.be.revertedWith("Pool: user max stake value exceeded");
    });

    it("Should allow unstaking from the dependant side", async function () {
      await doubleSidePool.setStakeLockPeriod(0);
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = 100;
      await doubleSidePool.stake(true, dependantStake);

      await time.increase(D1);
      await doubleSidePool.onBlock();

      await expect(doubleSidePool.unstake(true, dependantStake)).to.emit(lockKeeper, "Locked");
      const info = await doubleSidePool.dependantSideInfo();
      expect(info.totalStake).to.equal(0);
      const staker = await doubleSidePool.getDependantSideStaker(owner.address);
      expect(staker.stake).to.equal(0);
    });

    it("Should allow claiming rewards from the dependant side", async function () {
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = 100;
      await doubleSidePool.stake(true, dependantStake);

      await time.increase(D1);
      await doubleSidePool.onBlock();

      const expectedReward = 15; // 15% interest
      const rewards = await doubleSidePool.getUserDependantSideRewards(owner.address);
      expect(rewards).to.equal(expectedReward);

      const balanceBefore = await dependantToken.balanceOf(owner.address);
      await doubleSidePool.claim(true);
      const balanceAfter = await dependantToken.balanceOf(owner.address);
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReward);
    });

    it("Should not allow staking on dependant side when total stake limit is reached", async function () {
      await doubleSidePool.setMaxTotalStakeValue(1000);
      const mainStake = 100000; // Set a high main stake to avoid individual limit
      await doubleSidePool.stake(false, mainStake);

      const maxStake = 1000;
      await doubleSidePool.stake(true, maxStake);

      await expect(doubleSidePool.stake(true, 10)).to.be.revertedWith("Pool: max stake value exceeded");
    });

    it("Should not allow unstaking from dependant side before stake lock period", async function () {
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = 100;
      await doubleSidePool.stake(true, dependantStake);

      await expect(doubleSidePool.unstake(true, dependantStake)).to.be.revertedWith("Stake is locked");
    });

    it("Should allow fast unstaking from dependant side with penalty", async function () {
      await doubleSidePool.setStakeLockPeriod(0);
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = 100;
      await doubleSidePool.stake(true, dependantStake);

      //await time.increase(D1);
      //await doubleSidePool.onBlock();

      const balanceBefore = await dependantToken.balanceOf(owner.address);
      await doubleSidePool.unstakeFast(true, dependantStake);
      const balanceAfter = await dependantToken.balanceOf(owner.address);
      
      const expectedReturn = 95; // 95% due to 5% penalty
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReturn);
    });

    it("Should update stake limits when main side stake changes", async function () {
      const initialMainStake = 1000;
      await doubleSidePool.stake(false, initialMainStake);

      const maxDependantStake = 2000; // 2x multiplier
      await doubleSidePool.stake(true, maxDependantStake);

      // Increase main stake
      const additionalMainStake = 100;
      await doubleSidePool.stake(false, additionalMainStake);

      // Now we should be able to stake more on the dependant side
      const additionalDependantStake = 200;
      await expect(doubleSidePool.stake(true, additionalDependantStake)).to.not.be.reverted;
    });

    it("Should not allow adding dependant side twice", async function () {
      const dependantSideConfig: DoubleSidePool.DependantSideConfigStruct = {
        token: dependantToken.address,
        rewardToken: dependantToken.address,
        rewardTokenPrice: BILLION,
        minStakeValue: 5,
        unstakeLockPeriod: D1,
        fastUnstakePenalty: 0.05 * BILLION,
        lockPeriod: D1,
        interest: 0.15 * BILLION,
        interestRate: D1,
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLockPeriod: D1,
        stakeLimitsMultiplier: 2 * BILLION,
      };

      await expect(doubleSidePool.addDependantSide(dependantSideConfig)).to.be.revertedWith("Second side already exists");
    });

  });

  describe("Interaction between Main and Dependant Sides", function () {
    beforeEach(async function () {
      const dependantSideConfig: DoubleSidePool.DependantSideConfigStruct = {
        token: dependantToken.address,
        rewardToken: dependantToken.address,
        rewardTokenPrice: BILLION,
        minStakeValue: 5,
        unstakeLockPeriod: D1,
        fastUnstakePenalty: 0.05 * BILLION,
        lockPeriod: D1,
        interest: 0.15 * BILLION,
        interestRate: D1,
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLockPeriod: D1,
        stakeLimitsMultiplier: 2,
      };

      await doubleSidePool.addDependantSide(dependantSideConfig);
      await dependantToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
      await mainToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
    });

    it("Should correctly calculate rewards for both sides", async function () {
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = 500;
      await doubleSidePool.stake(true, dependantStake);

      await time.increase(D1);
      await doubleSidePool.onBlock();

      const mainRewards = await doubleSidePool.getUserMainSideRewards(owner.address);
      const dependantRewards = await doubleSidePool.getUserDependantSideRewards(owner.address);

      expect(mainRewards).to.equal(mainStake * 10 / 100 ); // 10% interest
      expect(dependantRewards).to.equal(dependantStake * 15 / 100); // 15% interest
    });

    it("Should allow staking and unstaking on both sides independently", async function () {
      await doubleSidePool.setStakeLockPeriod(0);
      const mainStake = ethers.utils.parseEther("1000");
      await doubleSidePool.stake(false, mainStake);

      const dependantStake = ethers.utils.parseEther("500");
      await doubleSidePool.stake(true, dependantStake);

      await doubleSidePool.unstake(false, mainStake.div(2));
      await doubleSidePool.unstake(true, dependantStake.div(2));

      const mainStaker = await doubleSidePool.getMainSideStaker(owner.address);
      const dependantStaker = await doubleSidePool.getDependantSideStaker(owner.address);

      expect(mainStaker.stake).to.equal(mainStake.div(2));
      expect(dependantStaker.stake).to.equal(dependantStake.div(2));
    });

    it("Should enforce dependant side limits based on main side stake", async function () {
      const mainStake = 1000;
      await doubleSidePool.stake(false, mainStake);

      const maxDependantStake = 2000; // 2x multiplier
      await doubleSidePool.stake(true, maxDependantStake);

      // Trying to stake more should fail
      await expect(doubleSidePool.stake(true, 100)).to.be.revertedWith("Pool: user max stake value exceeded");

      // Unstake half of main side
      await time.increase(D1);
      await doubleSidePool.unstake(false, 500);

      // Trying to stake on dependant side should still fail due to existing stake
      await expect(doubleSidePool.stake(true, 100)).to.be.revertedWith("Pool: user max stake value exceeded");
    });
  });

  describe("Edge cases and error handling", function () {
    beforeEach(async function () {
      const dependantSideConfig: DoubleSidePool.DependantSideConfigStruct = {
        token: dependantToken.address,
        rewardToken: dependantToken.address,
        rewardTokenPrice: BILLION,
        minStakeValue: 5,
        unstakeLockPeriod: D1,
        fastUnstakePenalty: 0.05 * BILLION,
        lockPeriod: D1,
        interest: 0.15 * BILLION,
        interestRate: D1,
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLockPeriod: D1,
        stakeLimitsMultiplier: 2,
      };

      await doubleSidePool.addDependantSide(dependantSideConfig);
      await dependantToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
      await mainToken.approve(doubleSidePool.address, ethers.utils.parseEther("1000000"));
    });

    it("Should handle zero stakes correctly", async function () {
      await expect(doubleSidePool.stake(false, 0)).to.be.revertedWith("Pool: stake value is too low");
      await expect(doubleSidePool.stake(true, 0)).to.be.revertedWith("Pool: stake value is too low");
    });

    it("Should handle unstaking more than staked amount", async function () {
      const stake = ethers.utils.parseEther("100");
      await doubleSidePool.stake(false, stake);
      await doubleSidePool.stake(true, stake);

      await time.increase(D1);

      await expect(doubleSidePool.unstake(false, stake.mul(2))).to.be.revertedWith("Not enough stake");
      await expect(doubleSidePool.unstake(true, stake.mul(2))).to.be.revertedWith("Not enough stake");
    });

    it("Should handle claiming rewards when there are no rewards", async function () {
      await doubleSidePool.claim(false);
      await doubleSidePool.claim(true);
      // These should not revert, but also should not transfer any tokens
    });

    it("Should handle multiple stake and unstake operations correctly", async function () {
      await doubleSidePool.setStakeLockPeriod(0);
      const stake1 = 100;
      const stake2 = 200;
      const stake3 = 300;

      await doubleSidePool.stake(false, stake1);
      await doubleSidePool.stake(true, stake1);

      await time.increase(D1 / 2);

      await doubleSidePool.stake(false, stake2);
      await doubleSidePool.stake(true, stake2);

      await time.increase(D1 / 2);

      await doubleSidePool.unstake(false, stake3);
      await doubleSidePool.unstake(true, stake3);

      const mainStaker = await doubleSidePool.getMainSideStaker(owner.address);
      const dependantStaker = await doubleSidePool.getDependantSideStaker(owner.address);

      expect(mainStaker.stake).to.equal(stake1 + stake2 - stake3);
      expect(dependantStaker.stake).to.equal(stake1 + stake2 - stake3);
    });
  });

});
