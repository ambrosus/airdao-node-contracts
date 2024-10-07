import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  LimitedTokenPoolsManager,
  RewardsBank,
  AirBond__factory,
  LimitedTokenPool,
  RewardsBank__factory,
  LimitedTokenPoolsManager__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

import LimitedTokenPoolJson from "../../../artifacts/contracts/staking/token/LimitedTokenPool.sol/LimitedTokenPool.json";

import { expect } from "chai";

describe("LimitedTokenPoolsManager", function () {
  let poolsManager: LimitedTokenPoolsManager;
  let rewardsBank: RewardsBank;
  let tokenAddr: string;
  let owner: SignerWithAddress;
  let lockKeeper: LockKeeper;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const airBond = await new AirBond__factory(owner).deploy(owner.address);

    const limitedTokenPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
    const limitedTokenPoolBeacon = await upgrades.deployBeacon(limitedTokenPoolFactory);

    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const poolsManager = await new LimitedTokenPoolsManager__factory(owner)
      .deploy(rewardsBank.address, lockKeeper.address, limitedTokenPoolBeacon.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, lockKeeper, tokenAddr, owner };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, lockKeeper, tokenAddr, owner } = await loadFixture(deploy));
  });

  describe("LimitedTokenPool Management", function () {
    it("Should allow the owner to create a limited token pool and set limits", async function () {
      const mainConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
      };

      const tx = await poolsManager.createPool(mainConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![4].args![0];

      expect(await poolsManager.pools(0)).to.equal(poolAddress);

      const limitsConfig: LimitedTokenPool.LimitsConfigStruct = {
        rewardTokenPrice: ethers.utils.parseUnits("1", 9), // 1 BILLION
        interest: ethers.utils.parseUnits("0.1", 9), // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        minDepositValue: ethers.utils.parseEther("10"),
        minStakeValue: ethers.utils.parseEther("10"),
        fastUnstakePenalty: ethers.utils.parseUnits("0.1", 9), // 10%
        unstakeLockPeriod: 24 * 60 * 60, // 24 hours
        stakeLockPeriod: 24 * 60 * 60, // 24 hours
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLimitsMultiplier: ethers.utils.parseUnits("2", 9), // 2x
      };

      await poolsManager.configurePool(poolAddress, limitsConfig);

      const proxyPool = new ethers.Contract(poolAddress, LimitedTokenPoolJson.abi, owner);
      const updatedConfig = await proxyPool.getLimitsConfig();

      expect(updatedConfig.rewardTokenPrice).to.equal(limitsConfig.rewardTokenPrice);
      expect(updatedConfig.interest).to.equal(limitsConfig.interest);
      expect(updatedConfig.interestRate).to.equal(limitsConfig.interestRate);
      expect(updatedConfig.minDepositValue).to.equal(limitsConfig.minDepositValue);
      expect(updatedConfig.minStakeValue).to.equal(limitsConfig.minStakeValue);
      expect(updatedConfig.fastUnstakePenalty).to.equal(limitsConfig.fastUnstakePenalty);
      expect(updatedConfig.unstakeLockPeriod).to.equal(limitsConfig.unstakeLockPeriod);
      expect(updatedConfig.stakeLockPeriod).to.equal(limitsConfig.stakeLockPeriod);
      expect(updatedConfig.maxTotalStakeValue).to.equal(limitsConfig.maxTotalStakeValue);
      expect(updatedConfig.maxStakePerUserValue).to.equal(limitsConfig.maxStakePerUserValue);
      expect(updatedConfig.stakeLimitsMultiplier).to.equal(limitsConfig.stakeLimitsMultiplier);
    });

    it("Should activate and deactivate a limited token pool", async function () {
      const mainConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
      };

      const tx = await poolsManager.createPool(mainConfig);
      const receipt = await tx.wait();
      console.log(receipt.events);
      const poolAddress = receipt.events![4].args![0];

      const proxyPool = new ethers.Contract(poolAddress, LimitedTokenPoolJson.abi, owner);
      expect(await proxyPool.active()).to.equal(true);
      await poolsManager.deactivatePool(poolAddress);
      expect(await proxyPool.active()).to.equal(false);
      await poolsManager.activatePool(poolAddress);
      expect(await proxyPool.active()).to.equal(true);
    });

    it("Should allow updating limited token pool parameters", async function () {
      const mainConfig: LimitedTokenPool.MainConfigStruct = {
        name: "TestPool",
        limitsMultiplierToken: tokenAddr,
        profitableToken: tokenAddr,
        rewardToken: tokenAddr,
      };

      const tx = await poolsManager.createPool(mainConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![4].args![0];

      const initialLimitsConfig: LimitedTokenPool.LimitsConfigStruct = {
        rewardTokenPrice: ethers.utils.parseUnits("1", 9),
        interest: ethers.utils.parseUnits("0.1", 9),
        interestRate: 24 * 60 * 60,
        minDepositValue: ethers.utils.parseEther("10"),
        minStakeValue: ethers.utils.parseEther("10"),
        fastUnstakePenalty: ethers.utils.parseUnits("0.1", 9),
        unstakeLockPeriod: 24 * 60 * 60,
        stakeLockPeriod: 24 * 60 * 60,
        maxTotalStakeValue: ethers.utils.parseEther("1000000"),
        maxStakePerUserValue: ethers.utils.parseEther("100000"),
        stakeLimitsMultiplier: ethers.utils.parseUnits("2", 9),
      };

      await poolsManager.configurePool(poolAddress, initialLimitsConfig);

      const proxyPool = new ethers.Contract(poolAddress, LimitedTokenPoolJson.abi, owner);

      const newLimitsConfig: LimitedTokenPool.LimitsConfigStruct = {
        rewardTokenPrice: ethers.utils.parseUnits("2", 9),
        interest: ethers.utils.parseUnits("0.2", 9),
        interestRate: 48 * 60 * 60,
        minDepositValue: ethers.utils.parseEther("20"),
        minStakeValue: ethers.utils.parseEther("20"),
        fastUnstakePenalty: ethers.utils.parseUnits("0.2", 9),
        unstakeLockPeriod: 48 * 60 * 60,
        stakeLockPeriod: 48 * 60 * 60,
        maxTotalStakeValue: ethers.utils.parseEther("2000000"),
        maxStakePerUserValue: ethers.utils.parseEther("200000"),
        stakeLimitsMultiplier: ethers.utils.parseUnits("3", 9),
      };

      await poolsManager.configurePool(poolAddress, newLimitsConfig);
      const updatedConfig = await proxyPool.getLimitsConfig();
      
      expect(updatedConfig.rewardTokenPrice).to.equal(newLimitsConfig.rewardTokenPrice);
      expect(updatedConfig.interest).to.equal(newLimitsConfig.interest);
      expect(updatedConfig.interestRate).to.equal(newLimitsConfig.interestRate);
      expect(updatedConfig.minDepositValue).to.equal(newLimitsConfig.minDepositValue);
      expect(updatedConfig.minStakeValue).to.equal(newLimitsConfig.minStakeValue);
      expect(updatedConfig.fastUnstakePenalty).to.equal(newLimitsConfig.fastUnstakePenalty);
      expect(updatedConfig.unstakeLockPeriod).to.equal(newLimitsConfig.unstakeLockPeriod);
      expect(updatedConfig.stakeLockPeriod).to.equal(newLimitsConfig.stakeLockPeriod);
      expect(updatedConfig.maxTotalStakeValue).to.equal(newLimitsConfig.maxTotalStakeValue);
      expect(updatedConfig.maxStakePerUserValue).to.equal(newLimitsConfig.maxStakePerUserValue);
      expect(updatedConfig.stakeLimitsMultiplier).to.equal(newLimitsConfig.stakeLimitsMultiplier);
    });
  });
});
