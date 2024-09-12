import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  TokenPoolsManager,
  RewardsBank,
  AirBond__factory,
  SingleSidePool,
  RewardsBank__factory,
  TokenPoolsManager__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

import SignleSidePoolJson from "../../../artifacts/contracts/staking/token/SingleSidePool.sol/SingleSidePool.json";

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

    const singleSidePoolFactory = await ethers.getContractFactory("SingleSidePool");
    const singleSidePoolBeacon = await upgrades.deployBeacon(singleSidePoolFactory);

    const doubleSidePoolFactory = await ethers.getContractFactory("DoubleSidePool");
    const doubleSidePoolBeacon = await upgrades.deployBeacon(doubleSidePoolFactory);

    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const poolsManager = await new TokenPoolsManager__factory(owner)
      .deploy(rewardsBank.address, lockKeeper.address, singleSidePoolBeacon.address, doubleSidePoolBeacon.address);

    await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), poolsManager.address)).wait();
    const tokenAddr = airBond.address;

    return { poolsManager, rewardsBank, lockKeeper, tokenAddr, owner };
  }

  beforeEach(async function () {
    ({ poolsManager, rewardsBank, lockKeeper, tokenAddr, owner } = await loadFixture(deploy));
  });

  describe("SingleSidePool Management", function () {
    it("Should allow the owner to create a single side pool", async function () {
      const singleSidePoolConfig: SingleSidePool.ConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        minStakeValue: 10,
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      console.log("before createPool");
      const tx = await poolsManager.createSingleSidePool(singleSidePoolConfig);
      const receipt = await tx.wait();
      console.log("Receipt: ", receipt);
      const poolAddress = receipt.events![4].args![1];

      expect(await poolsManager.getPoolAddress("TestProxy")).to.equal(poolAddress);
    });

    it("Should activate and deactivate a pool", async function () {
      const singleSidePoolConfig: SingleSidePool.ConfigStruct = {
        token: tokenAddr,
        name: "TestPool",
        minStakeValue: 10,
        rewardToken: tokenAddr,
        rewardTokenPrice: 1,
        fastUnstakePenalty: 100000, // 10%
        interest: 100000, // 10%
        interestRate: 24 * 60 * 60, // 24 hours
        lockPeriod: 24 * 60 * 60, // 24 hours
      };

      await poolsManager.createSingleSidePool(tokenAddr, "TestProxy", minStakeValue, fastUnstakePenalty, interest, interestRate, lockPeriod, tokenAddr, rewardsTokenPrice);
      const poolAddress = await poolsManager.getPoolAddress("TestProxy");
      console.log("Pool Address: ", poolAddress);

      //await poolsManager.deactivatePool("TestProxy");
      const proxyPool = new ethers.Contract(poolAddress, SignleSidePoolJson.abi, owner);
      const active = await proxyPool.active();
      console.log("Active: ", active);
    });

  });

});

