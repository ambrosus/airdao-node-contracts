import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

import {
  PoolsManager,
  RewardsBank,
  AirBond__factory,
  RewardsBank__factory,
  PoolsManager__factory,
} from "../../../typechain-types";

import { expect } from "chai";

describe("PoolsManager", function () {
  let poolsManager: PoolsManager;
  let rewardsBank: RewardsBank;
  let tokenAddr: string;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const airBond = await new AirBond__factory(owner).deploy(owner.address);

    const poolsManager = await new PoolsManager__factory(owner).deploy(rewardsBank.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, tokenAddr };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, tokenAddr } = await loadFixture(deploy));
  });

  describe("Pool Management", function () {
    it("Should allow the owner to create a pool", async function () {
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const minStakeValue = 10;

      const tx = await poolsManager.createPool(tokenAddr, interest,interestRate, minStakeValue);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![3].args!.pool;

      expect(await poolsManager.getPool(tokenAddr)).to.equal(poolAddress);
    });

    it("Should activate and deactivate a pool", async function () {
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const minStakeValue = 10;

      const tx = await poolsManager.createPool(tokenAddr, interest, interestRate, minStakeValue);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![3].args!.pool;

      await poolsManager.deactivatePool(poolAddress);
      expect(await poolsManager.getPoolInfo(poolAddress)).to.include(false); // Pool should be inactive

      await poolsManager.activatePool(poolAddress);
      expect(await poolsManager.getPoolInfo(poolAddress)).to.include(true); // Pool should be active
    });

    it("Should allow the owner to set interest and min stake value", async function () {
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const minStakeValue = 10;

      const tx = await poolsManager.createPool(tokenAddr, interest, interestRate, minStakeValue);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![3].args![0];

      const newInterest = 300000; // 30%
      await poolsManager.setInterest(poolAddress, newInterest);
      const [,interestSet,,,] = await poolsManager.getPoolInfo(poolAddress);
      expect(interestSet).to.equal(newInterest);

      const newMinStakeValue = 20;
      await poolsManager.setMinStakeValue(poolAddress, newMinStakeValue);
      const [,,minStakeValueSet,,,] = await poolsManager.getPoolInfo(poolAddress);
      expect(minStakeValueSet).to.equal(newMinStakeValue);
    });

  });

});

