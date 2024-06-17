import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  BaseNodes_Manager,
  BaseNodes_Manager__factory,
  RewardsBank__factory,
  TEST_ValidatorSet,
  Treasury__factory,
} from "../../typechain-types";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";

describe("BaseNodes", function () {
  let validatorSet: TEST_ValidatorSet;
  let baseNodes: BaseNodes_Manager;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);

    const BaseNodesFactory = await ethers.getContractFactory("BaseNodes_Manager");
    const baseNodes = (await upgrades.deployProxy(BaseNodesFactory, [
      validatorSet.address,
      rewardsBank.address,
      treasury.address,
    ])) as BaseNodes_Manager;

    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), baseNodes.address);
    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), baseNodes.address);

    return { validatorSet, baseNodes, owner };
  }

  beforeEach(async function () {
    ({ validatorSet, baseNodes, owner } = await loadFixture(deploy));
  });

  describe("addStake", function () {
    it("ok", async function () {
      await expect(baseNodes.addStake(owner.address, { value: 50 })).to.changeEtherBalance(owner, -50);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.equal(50);

      await expect(baseNodes.addStake(owner.address, { value: 25 })).to.changeEtherBalance(owner, -25);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.equal(75);
    });

    it("not from admin", async function () {
      const [_, notAdmin] = await ethers.getSigners();
      await expect(baseNodes.connect(notAdmin).addStake(owner.address, { value: 50 })).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    });
  });

  describe("removeStake", function () {
    beforeEach(async function () {
      await baseNodes.addStake(owner.address, { value: 50 });
    });

    it("remove all stake", async function () {
      await expect(baseNodes.removeStake(owner.address, 50, owner.address)).to.changeEtherBalance(owner, 50);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.equal(0);
    });
    it("remove part of stake", async function () {
      await expect(baseNodes.removeStake(owner.address, 30, owner.address)).to.changeEtherBalance(owner, 30);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.equal(20);
    });
    it("remove more than staked", async function () {
      await expect(baseNodes.removeStake(owner.address, 100, owner.address)).to.be.revertedWith("Stake < amount");
    });

    it("not from admin", async function () {
      const [_, notAdmin] = await ethers.getSigners();
      await expect(baseNodes.connect(notAdmin).removeStake(owner.address, 50, owner.address)).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    });
  });

  describe("reward", function () {
    beforeEach(async function () {
      await baseNodes.addStake(owner.address, { value: 50 });
    });

    it("ok", async function () {
      await ethers.provider.send("hardhat_setCoinbase", [owner.address]); // call as current block miner
      await validatorSet.process();
    });

    it("not from validatorSet", async function () {
      await expect(baseNodes.reward(owner.address, 50)).to.be.revertedWith("Only validatorSet can call reward()");
    });
  });

  it("report", async function () {
    // do nothing, for coverage
    await baseNodes.report(owner.address);
  });


  it("initialize shouldn't decrease my coverage", async () => {
    await expect(      baseNodes.initialize(AddressZero, AddressZero, AddressZero)    ).to.be.reverted;
  });

});
