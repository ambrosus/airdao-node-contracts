import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  TokenPoolsManager,
  RewardsBank,
  AirBond__factory,
  RewardsBank__factory,
  TokenPoolsManager__factory,
  LockKeeper__factory,
} from "../../../typechain-types";

import TokenPoolJson from "../../../artifacts/contracts/staking/token/TokenPool.sol/TokenPool.json";

import { expect } from "chai";

describe("PoolsManager", function () {
  let poolsManager: TokenPoolsManager;
  let rewardsBank: RewardsBank;
  let tokenAddr: string;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const airBond = await new AirBond__factory(owner).deploy(owner.address);
    const tokenPoolFactory = await ethers.getContractFactory("TokenPool");
    const tokenPoolBeacon = await upgrades.deployBeacon(tokenPoolFactory);

    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const poolsManager = await new TokenPoolsManager__factory(owner).deploy(rewardsBank.address, lockKeeper.address, tokenPoolBeacon.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, tokenAddr, owner };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, tokenAddr, owner } = await loadFixture(deploy));
  });

  describe("Pool Management", function () {
    it("Should allow the owner to create a pool", async function () {
      const minStakeValue = 10;
      const fastUnstakePenalty = 100000; // 10%
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const lockPeriod = 24 * 60 * 60; // 24 hours
      const rewardsTokenPrice = 1;

      console.log("before createPool");
      const tx = await poolsManager.createPool(tokenAddr, "TestProxy", minStakeValue, fastUnstakePenalty, interest, interestRate, lockPeriod, tokenAddr, rewardsTokenPrice);
      const receipt = await tx.wait();
      console.log("Receipt: ", receipt);
      const poolAddress = receipt.events![4].args![1];

      expect(await poolsManager.getPoolAddress("TestProxy")).to.equal(poolAddress);
    });

    it("Should activate and deactivate a pool", async function () {
      const minStakeValue = 10;
      const fastUnstakePenalty = 100000; // 10%
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const lockPeriod = 24 * 60 * 60; // 24 hours
      const rewardsTokenPrice = 1;

      await poolsManager.createPool(tokenAddr, "TestProxy", minStakeValue, fastUnstakePenalty, interest, interestRate, lockPeriod, tokenAddr, rewardsTokenPrice);
      const poolAddress = await poolsManager.getPoolAddress("TestProxy");
      console.log("Pool Address: ", poolAddress);

      //await poolsManager.deactivatePool("TestProxy");
      const proxyPool = new ethers.Contract(poolAddress, TokenPoolJson.abi, owner);
      const active = await proxyPool.active();
      console.log("Active: ", active);
    });

  });

});

