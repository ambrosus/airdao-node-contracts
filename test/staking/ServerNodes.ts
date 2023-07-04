import { loadFixture, time, impersonateAccount, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AirBond,
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
  let airBond: AirBond;
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
    const airBond = await new AirBond__factory(owner).deploy(owner.address);
    await airBond.grantRole(await airBond.MINTER_ROLE(), owner.address);

    const serverNodes = await new ServerNodes_Manager__factory(owner).deploy(
      validatorSet.address,
      lockKeeper.address,
      airBond.address,
      onboardingDelay,
      60 * 5,
      42
    );

    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), serverNodes.address);
    await time.setNextBlockTimestamp(T);

    return { validatorSet, serverNodes, owner, lockKeeper, airBond };
  }

  beforeEach(async function () {
    ({ validatorSet, serverNodes, owner, lockKeeper, airBond } = await loadFixture(deploy));
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

  describe("onboard delay", function () {
    it("many nodes", async function () {
      const [_, node1, node2, node3, node4] = await ethers.getSigners();
      await serverNodes.connect(node1).newStake(node1.address, { value: 50 });
      await serverNodes.connect(node2).newStake(node2.address, { value: 50 });
      await serverNodes.connect(node3).newStake(node3.address, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.connect(node4).newStake(node4.address, { value: 50 });
      await serverNodes.connect(node3).unstake(50);
      await serverNodes.onBlock();

      expect(await validatorSet.getNodeStake(node1.address)).to.be.eq(50);
      expect(await validatorSet.getNodeStake(node2.address)).to.be.eq(50);
      expect(await validatorSet.getNodeStake(node3.address)).to.be.eq(0);
      expect(await validatorSet.getNodeStake(node4.address)).to.be.eq(0);
    });
  });

  describe("rewards", function () {
    let validatorSetSigner: SignerWithAddress;
    beforeEach(async function () {
      await serverNodes.newStake(owner.address, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.onBlock();
      await asSuperUser(validatorSet.finalizeChange());

      await airBond.mint(serverNodes.address, 10000);
      await owner.sendTransaction({ to: serverNodes.address, value: 10000 });

      await impersonateAccount(validatorSet.address);
      await setBalance(validatorSet.address, 10000000);
      validatorSetSigner = await ethers.getSigner(validatorSet.address);
    });

    it("reward with bonds (amb to stake, bonds to owner address)", async function () {
      await time.setNextBlockTimestamp(T + 10000);
      const [nativeReward, bondsReward] = getRewardsValues(10, getBondsPercent(10000));

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, 0) // todo why owner balance is changed?
        .to.changeTokenBalance(airBond, owner, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50 + nativeReward);
    });

    it("reward with bonds (amb and bonds to reward address)", async function () {
      const [_, rewardAddress] = await ethers.getSigners();
      await serverNodes.setRewardsAddress(owner.address, rewardAddress.address);

      await time.setNextBlockTimestamp(T + 10000);
      const [nativeReward, bondsReward] = getRewardsValues(10, getBondsPercent(10000));

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(rewardAddress, nativeReward)
        .to.changeTokenBalance(airBond, rewardAddress, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);
    });

    it("reward with bonds (amb and bonds to reward address (which is owner))", async function () {
      await serverNodes.setRewardsAddress(owner.address, owner.address);
      await time.setNextBlockTimestamp(T + 10000);
      const [nativeReward, bondsReward] = getRewardsValues(10, getBondsPercent(10000));

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, nativeReward)
        .to.changeTokenBalance(airBond, owner, bondsReward);

      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);
    });

    it("reward without bonds (3 years)", async function () {
      const years3 = 3 * 365 * 24 * 60 * 60;
      await time.setNextBlockTimestamp(T + years3);
      const [nativeReward, bondsReward] = getRewardsValues(10, getBondsPercent(years3));
      expect(bondsReward).to.be.eq(0);

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, 0)
        .to.changeTokenBalance(airBond, owner, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50 + nativeReward);
    });

    it("reward without bonds (4 years)", async function () {
      const years4 = 4 * 365 * 24 * 60 * 60;
      await time.setNextBlockTimestamp(T + years4);
      const [nativeReward, bondsReward] = getRewardsValues(10, getBondsPercent(years4));
      expect(bondsReward).to.be.eq(0);

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, 0)
        .to.changeTokenBalance(airBond, owner, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50 + nativeReward);
    });

    it("call from not validatorset", async function () {
      await expect(serverNodes.reward(owner.address, 1)).to.be.revertedWith("Only validatorSet can call reward()");
    });

    it("nodeAddress is not a validator", async function () {
      const [_, notNode] = await ethers.getSigners();
      await expect(serverNodes.connect(validatorSetSigner).reward(notNode.address, 10)).to.be.revertedWith(
        "nodeAddress is not a validator"
      );
    });

    it("setRewardsAddress by not owner", async function () {
      const [_, notOwner] = await ethers.getSigners();
      await expect(serverNodes.setRewardsAddress(notOwner.address, owner.address)).to.be.revertedWith(
        "Only owner can set flag"
      );
    });
  });
});

function getRewardsValues(amount: number, bondsPercent: number) {
  const bondsReward = Math.floor((amount * bondsPercent) / 100);
  const nativeReward = amount - bondsReward;
  return [nativeReward, bondsReward];
}

function getBondsPercent(stakingTime: number) {
  const nativePercent = 25 + (stakingTime * 75) / (3 * 365 * 24 * 60 * 60);
  return 100 - Math.min(nativePercent, 100);
}

async function asSuperUser(call: Promise<any>) {
  await ethers.provider.send("hardhat_setCoinbase", ["0x0000000000000000000000000000000000000000"]); // superuser flag
  const res = await call;
  await ethers.provider.send("hardhat_setCoinbase", ["0x1111111111111111111111111111111111111111"]); // disable superuser flag
  return res;
}
