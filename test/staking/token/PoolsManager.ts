import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";

import {
  TokenPool,
  TokenPoolsManager,
  RewardsBank,
  AirBond__factory,
  RewardsBank__factory,
  TokenPoolsManager__factory,
  TokenPoolBeacon__factory,
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

    const interest = 100000; // 10%
    const interestRate = 24 * 60 * 60; // 24 hours
    const minStakeValue = 10;
    const rewardTokenPrice = 1;

    //Deploy the implementation 
    const tokenPool = (await upgrades.deployProxy(tokenPoolFactory, [
      "Test", airBond.address, rewardsBank.address, interest,
      interestRate, minStakeValue, airBond.address, rewardTokenPrice
    ])) as TokenPool;

    const tokenPoolBeacon = await new TokenPoolBeacon__factory(owner).deploy(tokenPool.address);

    const poolsManager = await new TokenPoolsManager__factory(owner).deploy(rewardsBank.address, tokenPoolBeacon.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, tokenAddr, owner };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, tokenAddr, owner } = await loadFixture(deploy));
  });

  describe("Pool Management", function () {
    it("Should allow the owner to create a pool", async function () {
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const minStakeValue = 10;

      const tx = await poolsManager.createPool("TestProxy", tokenAddr, interest, interestRate, minStakeValue, tokenAddr, 1);
      const receipt = await tx.wait();
      const poolAddress = receipt.events![2].args![1];

      expect(await poolsManager.getPoolAddress("TestProxy")).to.equal(poolAddress);
    });

    it("Should activate and deactivate a pool", async function () {
      const interest = 100000; // 10%
      const interestRate = 24 * 60 * 60; // 24 hours
      const minStakeValue = 10;

      await poolsManager.createPool("TestProxy", tokenAddr, interest, interestRate, minStakeValue, tokenAddr, 1);
      const poolAddress = await poolsManager.getPoolAddress("TestProxy");
      console.log("Pool Address: ", poolAddress);

      //await poolsManager.deactivatePool("TestProxy");
      const proxyPool = new ethers.Contract(poolAddress, TokenPoolJson.abi, owner);
      const active = await proxyPool.active();
      console.log("Active: ", active);
    });

  });

});

