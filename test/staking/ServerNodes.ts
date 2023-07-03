import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AirBond__factory,
  LockKeeper,
  LockKeeper__factory,
  ServerNodes_Manager,
  ServerNodes_Manager__factory,
  TEST_ValidatorSet,
} from "../../typechain-types";
import { expect } from "chai";

const T = 30000000000;
const onboardingDelay = 60 * 5;

describe("ServerNodes", function () {
  let validatorSet: TEST_ValidatorSet;
  let lockKeeper: LockKeeper;
  let serverNodes: ServerNodes_Manager;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const ValidatorSetFactory = await ethers.getContractFactory("ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [
      owner.address,
      owner.address,
      10,
      2,
    ])) as TEST_ValidatorSet;

    const lockKeeper = await new LockKeeper__factory(owner).deploy();
    const airbond = await new AirBond__factory(owner).deploy(owner.address);

    const serverNodes = await new ServerNodes_Manager__factory(owner).deploy(
      validatorSet.address,
      lockKeeper.address,
      airbond.address,
      onboardingDelay,
      60 * 5,
      42
    );

    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), serverNodes.address);
    await time.setNextBlockTimestamp(T);

    return { validatorSet, serverNodes, owner, lockKeeper };
  }

  beforeEach(async function () {
    ({ validatorSet, serverNodes, owner, lockKeeper } = await loadFixture(deploy));
  });

  describe("newStake", function () {
    it("ok", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });

      const stake = await serverNodes.stakes(owner.address);
      expect(stake.stake).to.be.eq(50);

      await time.setNextBlockTimestamp(+stake.timestampStake + onboardingDelay + 1);
      await serverNodes.onBlock();

      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);
    });

    it("ok, onboarding delay", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(50);
      await serverNodes.onBlock(); // not enough time passed
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(0);
    });

    it("< minStakeAmount", async function () {
      await expect(serverNodes.newStake(owner.address, { value: 42 })).to.be.revertedWith(
        "msg.value must be > minStakeAmount"
      );
    });

    it("node already registered", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await expect(serverNodes.newStake(owner.address, { value: 50 })).to.be.revertedWith("node already registered");

      // different owner
      const [_, anotherOwner] = await ethers.getSigners();
      await expect(serverNodes.connect(anotherOwner).newStake(owner.address, { value: 50 })).to.be.revertedWith(
        "node already registered"
      );
    });

    it("same owner 2 nodes", async function () {
      const [_, anotherNode] = await ethers.getSigners();
      await serverNodes.newStake(owner.address, { value: 50 });

      await expect(serverNodes.newStake(anotherNode.address, { value: 50 })).to.be.revertedWith(
        "owner already has a stake"
      );
    });
  });

  describe("addStake", function () {
    it("ok", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await serverNodes.addStake({ value: 50 });
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(100);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(0);
    });

    it("onboarded ok", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.onBlock();
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(50);

      await serverNodes.addStake({ value: 50 });
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(100);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(100);
    });

    it("value == 0", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await expect(serverNodes.addStake()).to.be.revertedWith("msg.value must be > 0");
    });

    it("node not registered", async function () {
      await expect(serverNodes.addStake({ value: 50 })).to.be.revertedWith("no stake for you address");
    });
  });

  describe("unstake", function () {
    it("unstake", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });

      await expect(serverNodes.unstake(50)).to.emit(lockKeeper, "Locked");
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(0);
    });

    it("unstake part", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });

      await expect(serverNodes.unstake(1)).to.emit(lockKeeper, "Locked");
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(49);
    });

    it("unstake onboarded", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.onBlock();
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);

      await serverNodes.unstake(5);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(45);
    });

    it("amount == 0", async function () {
      await expect(serverNodes.unstake(0)).to.be.revertedWith("amount must be > 0");
    });

    it("node not registered", async function () {
      await expect(serverNodes.unstake(50)).to.be.revertedWith("no stake for you address");
    });

    it("stake < amount", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await expect(serverNodes.unstake(100)).to.be.revertedWith("stake < amount");
    });

    it("resulting stake < minStakeAmount", async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await expect(serverNodes.unstake(40)).to.be.revertedWith("resulting stake < minStakeAmount");
    });
  });
});
