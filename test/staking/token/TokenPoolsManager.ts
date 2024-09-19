import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  TokenPoolsManager,
  RewardsBank,
  AirBond__factory,
  TokenPool,
  LimitedTokenPool,
  RewardsBank__factory,
  TokenPoolsManager__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

import TokenPoolJson from "../../../artifacts/contracts/staking/token/TokenPool.sol/TokenPool.json";
import LimitedTokenPoolJson from "../../../artifacts/contracts/staking/token/LimitedTokenPool.sol/LimitedTokenPool.json";


import { expect } from "chai";

describe("PoolsManager", function () {
  let poolsManager: TokenPoolsManager;
  let rewardsBank: RewardsBank;
  let tokenAddr: string;
  let owner: SignerWithAddress;
  let lockKeeper: LockKeeper;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const airBond = await new AirBond__factory(owner).deploy(owner.address);

    const tokenPoolFactory = await ethers.getContractFactory("TokenPool");
    const tokenPoolBeacon = await upgrades.deployBeacon(tokenPoolFactory);

    const limitedTokenPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
    const limitedTokenPoolBeacon = await upgrades.deployBeacon(limitedTokenPoolFactory);

    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const poolsManager = await new TokenPoolsManager__factory(owner)
      .deploy(rewardsBank.address, lockKeeper.address, tokenPoolBeacon.address, limitedTokenPoolBeacon.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, lockKeeper, tokenAddr, owner };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, lockKeeper, tokenAddr, owner } = await loadFixture(deploy));
  });

  describe("TokenPool Management", function () {
    it("Should allow the owner to create a token pool", async function () {
      const tokenPoolConfig: TokenPool.ConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        minStakeValue: 10,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      const tx = await poolsManager.createTokenPool(tokenPoolConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![3].args![1];

      expect(await poolsManager.getPoolAddress("TestPool")).to.equal(poolAddress);
    });

    it("Should activate and deactivate a token pool", async function () {
      const tokenPoolConfig: TokenPool.ConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        minStakeValue: 10,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      await poolsManager.createTokenPool(tokenPoolConfig);
      const poolAddress = await poolsManager.getPoolAddress("TestPool");

      const proxyPool = new ethers.Contract(poolAddress, TokenPoolJson.abi, owner);
      expect(await proxyPool.active()).to.equal(true);
      await poolsManager.deactivateTokenPool("TestPool");
      expect(await proxyPool.active()).to.equal(false);
      await poolsManager.activateTokenPool("TestPool");
      expect(await proxyPool.active()).to.equal(true);
    });

    it("Should allow updating token pool parameters", async function () {
      const tokenPoolConfig: TokenPool.ConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        minStakeValue: 10,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      await poolsManager.createTokenPool(tokenPoolConfig);
      const poolAddress = await poolsManager.getPoolAddress("TestPool");
      const proxyPool = new ethers.Contract(poolAddress, TokenPoolJson.abi, owner);


      await poolsManager.setInterest("TestPool", 200000, 48 * 60 * 60);
      await poolsManager.setFastUnstakePenalty("TestPool", 200000);
      await poolsManager.setMinStakeValue("TestPool", 20);
      await poolsManager.setLockPeriod("TestPool", 48 * 60 * 60);
      await poolsManager.setRewardTokenPrice("TestPool", 2);
      const newConfig = await proxyPool.getConfig();
      expect(newConfig.interest).to.equal(200000);
      expect(newConfig.interestRate).to.equal(48 * 60 * 60);
      expect(newConfig.lockPeriod).to.equal(48 * 60 * 60);
      expect(newConfig.rewardTokenPrice).to.equal(2);
      expect(newConfig.fastUnstakePenalty).to.equal(200000);
      expect(newConfig.minStakeValue).to.equal(20);
    });
  });

  describe("LimitedTokenPool Management", function () {
    it("Should allow the owner to create a deposited token pool", async function () {
      const limitedTokenPoolConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestDepositedPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
      };

      const tx = await poolsManager.createLimitedTokenPool(limitedTokenPoolConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![3].args![1];

      expect(await poolsManager.getDepositedPoolAdress("TestDepositedPool")).to.equal(poolAddress);
    });

    it("Should configure deposited token pool limits", async function () {
      const limitedTokenPoolConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestDepositedPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
      };

      await poolsManager.createLimitedTokenPool(limitedTokenPoolConfig);

      const limitsConfig: LimitedTokenPool.LimitsConfigStruct = {
        minDepositValue: ethers.utils.parseEther("10"),
        minStakeValue: ethers.utils.parseEther("10"),
        fastUnstakePenalty: 100000, // 10%
        unstakeLockPeriod: 24 * 60 * 60, // 24 hours
        stakeLockPeriod: 24 * 60 * 60, // 24 hours
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLimitsMultiplier: 2 * 1000000000, // 2x
      };

      await poolsManager.configureLimitedTokenPoolLimits("TestDepositedPool", limitsConfig);

      const poolAddress = await poolsManager.getDepositedPoolAdress("TestDepositedPool");
      const proxyPool = new ethers.Contract(poolAddress, LimitedTokenPoolJson.abi, owner);
      const configuredLimits = await proxyPool.getLimitsConfig();

      expect(configuredLimits.minDepositValue).to.equal(limitsConfig.minDepositValue);
      expect(configuredLimits.minStakeValue).to.equal(limitsConfig.minStakeValue);
      expect(configuredLimits.fastUnstakePenalty).to.equal(limitsConfig.fastUnstakePenalty);
      expect(configuredLimits.unstakeLockPeriod).to.equal(limitsConfig.unstakeLockPeriod);
      expect(configuredLimits.stakeLockPeriod).to.equal(limitsConfig.stakeLockPeriod);
      expect(configuredLimits.maxTotalStakeValue).to.equal(limitsConfig.maxTotalStakeValue);
      expect(configuredLimits.maxStakePerUserValue).to.equal(limitsConfig.maxStakePerUserValue);
      expect(configuredLimits.stakeLimitsMultiplier).to.equal(limitsConfig.stakeLimitsMultiplier);
    });

    it("Should activate and deactivate a deposited token pool", async function () {
      const limitedTokenPoolConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestDepositedPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
      };

      await poolsManager.createLimitedTokenPool(limitedTokenPoolConfig);
      const poolAddress = await poolsManager.getDepositedPoolAdress("TestDepositedPool");

      const proxyPool = new ethers.Contract(poolAddress, LimitedTokenPoolJson.abi, owner);
      expect(await proxyPool.active()).to.equal(true);
      await poolsManager.deactivateDoubleSidePool("TestDepositedPool");
      expect(await proxyPool.active()).to.equal(false);
      await poolsManager.activateDoubleSidePool("TestDepositedPool");
      expect(await proxyPool.active()).to.equal(true);
    });

    it("Should allow updating deposited token pool parameters", async function () {
      const limitedTokenPoolConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestDepositedPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
      };

      await poolsManager.createLimitedTokenPool(limitedTokenPoolConfig);
      const poolAddress = await poolsManager.getDepositedPoolAdress("TestDepositedPool");
      const proxyPool = new ethers.Contract(poolAddress, LimitedTokenPoolJson.abi, owner);

      await poolsManager.setRewardTokenPriceL("TestDepositedPool", 2);
      await poolsManager.setInterestL("TestDepositedPool", 200000, 48 * 60 * 60);
      const updatedConfig = await proxyPool.getMainConfig();
      expect(updatedConfig.rewardTokenPrice).to.equal(2);
      expect(updatedConfig.interest).to.equal(200000);
      expect(updatedConfig.interestRate).to.equal(48 * 60 * 60);

      await poolsManager.setMinDepositValueL("TestDepositedPool", 20);
      await poolsManager.setMinStakeValueL("TestDepositedPool", 30);
      await poolsManager.setFastUnstakePenaltyL("TestDepositedPool", 200000);
      await poolsManager.setUnstakeLockPeriodL("TestDepositedPool", 48 * 60 * 60);
      await poolsManager.setStakeLockPeriodL("TestDepositedPool", 72 * 60 * 60);
      await poolsManager.setMaxTotalStakeValueL("TestDepositedPool", ethers.utils.parseEther("2000000"));
      await poolsManager.setMaxStakePerUserValueL("TestDepositedPool", ethers.utils.parseEther("200000"));
      await poolsManager.setStakeLimitsMultiplierL("TestDepositedPool", 3 * 1000000000);

      const updatedLimits = await proxyPool.getLimitsConfig();
      expect(updatedLimits.minDepositValue).to.equal(20);
      expect(updatedLimits.minStakeValue).to.equal(30);
      expect(updatedLimits.fastUnstakePenalty).to.equal(200000);
      expect(updatedLimits.unstakeLockPeriod).to.equal(48 * 60 * 60);
      expect(updatedLimits.stakeLockPeriod).to.equal(72 * 60 * 60);
      expect(updatedLimits.maxTotalStakeValue).to.equal(ethers.utils.parseEther("2000000"));
      expect(updatedLimits.maxStakePerUserValue).to.equal(ethers.utils.parseEther("200000"));
      expect(updatedLimits.stakeLimitsMultiplier).to.equal(3 * 1000000000);
    });
  });

});

