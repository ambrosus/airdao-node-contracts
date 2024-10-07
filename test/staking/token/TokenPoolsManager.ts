import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  TokenPoolsManager,
  RewardsBank,
  AirBond__factory,
  TokenPool,
  RewardsBank__factory,
  TokenPoolsManager__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

import TokenPoolJson from "../../../artifacts/contracts/staking/token/TokenPool.sol/TokenPool.json";

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

    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const poolsManager = await new TokenPoolsManager__factory(owner)
      .deploy(rewardsBank.address, lockKeeper.address, tokenPoolBeacon.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, lockKeeper, tokenAddr, owner };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, lockKeeper, tokenAddr, owner } = await loadFixture(deploy));
  });

  describe("TokenPool Management", function () {
    it("Should allow the owner to create a token pool", async function () {
      const mainConfig: TokenPool.MainConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        rewardToken: tokenAddr,
      };

      const limitsConfig: TokenPool.LimitsConfigStruct = {
        rewardTokenPrice: 1,
        minStakeValue: 10,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      const tx = await poolsManager.createPool(mainConfig, limitsConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![4].args![0];

      expect(await poolsManager.pools(0)).to.equal(poolAddress);
    });

    it("Should activate and deactivate a token pool", async function () {
      const mainConfig: TokenPool.MainConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        rewardToken: tokenAddr,
      };

      const limitsConfig: TokenPool.LimitsConfigStruct = {
        rewardTokenPrice: 1,
        minStakeValue: 10,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      const tx = await poolsManager.createPool(mainConfig, limitsConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![4].args![0];

      const proxyPool = new ethers.Contract(poolAddress, TokenPoolJson.abi, owner);
      expect(await proxyPool.active()).to.equal(true);
      await poolsManager.deactivateTokenPool(poolAddress);
      expect(await proxyPool.active()).to.equal(false);
      await poolsManager.activateTokenPool(poolAddress);
      expect(await proxyPool.active()).to.equal(true);
    });

    it("Should allow updating token pool parameters", async function () {
      const mainConfig: TokenPool.MainConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        rewardToken: tokenAddr,
      };

      const limitsConfig: TokenPool.LimitsConfigStruct = {
        rewardTokenPrice: 1,
        minStakeValue: 10,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      const tx = await poolsManager.createPool(mainConfig, limitsConfig);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![4].args![0];
      const proxyPool = new ethers.Contract(poolAddress, TokenPoolJson.abi, owner);

      const newLimitsConfig: TokenPool.LimitsConfigStruct = {
        rewardTokenPrice: 2,
        minStakeValue: 20,
        fastUnstakePenalty: 200000, // 20%
        interest: 200000, // 20%
        interestRate: 48 * 60 * 60, // 48 hours
        lockPeriod: 48 * 60 * 60, // 48 hours
      };

      await poolsManager.configurePool(poolAddress, newLimitsConfig);
      const updatedConfig = await proxyPool.getLimitsConfig();
      
      expect(updatedConfig.rewardTokenPrice).to.equal(2);
      expect(updatedConfig.minStakeValue).to.equal(20);
      expect(updatedConfig.fastUnstakePenalty).to.equal(200000);
      expect(updatedConfig.interest).to.equal(200000);
      expect(updatedConfig.interestRate).to.equal(48 * 60 * 60);
      expect(updatedConfig.lockPeriod).to.equal(48 * 60 * 60);
    });
  });
});
