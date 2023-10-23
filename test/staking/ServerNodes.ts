import { impersonateAccount, loadFixture, setBalance, time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  AirBond,
  AirBond__factory,
  LockKeeper,
  LockKeeper__factory,
  RewardsBank__factory,
  ServerNodes_Manager,
  TEST_ValidatorSet,
  Treasury__factory,
} from "../../typechain-types";
import { expect } from "chai";
import { AddressZero } from "@ethersproject/constants";

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

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;
    const lockKeeper = await new LockKeeper__factory(owner).deploy();
    const airBond = await new AirBond__factory(owner).deploy(owner.address);
    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);

    const ServerNodesFactory = await ethers.getContractFactory("ServerNodes_Manager");
    const serverNodes = (await upgrades.deployProxy(ServerNodesFactory, [
      validatorSet.address,
      lockKeeper.address,
      rewardsBank.address,
      airBond.address,
      treasury.address,
      onboardingDelay,
      60 * 5,
      42,
    ])) as ServerNodes_Manager;

    await airBond.grantRole(await airBond.MINTER_ROLE(), owner.address);
    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), serverNodes.address);
    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), serverNodes.address);

    await time.setNextBlockTimestamp(T);

    return { validatorSet, serverNodes, owner, lockKeeper, airBond };
  }

  beforeEach(async function () {
    ({ validatorSet, serverNodes, owner, lockKeeper, airBond } = await loadFixture(deploy));
  });

  describe("newStake", function () {
    it("ok", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });

      const stake = await serverNodes.stakes(owner.address);
      expect(stake.stake).to.be.eq(50);

      await time.setNextBlockTimestamp(+stake.timestampStake + onboardingDelay + 1);
      await serverNodes.onBlock();

      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);
    });

    it("ok, onboarding delay", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(50);
      await serverNodes.onBlock(); // not enough time passed
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(0);
    });

    it("< minStakeAmount", async function () {
      await expect(serverNodes.newStake(owner.address, AddressZero, { value: 1 })).to.be.revertedWith(
        "msg.value must be >= minStakeAmount"
      );
    });

    it("node already registered", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await expect(serverNodes.newStake(owner.address, AddressZero, { value: 50 })).to.be.revertedWith(
        "node already registered"
      );

      // different owner
      const [_, anotherOwner] = await ethers.getSigners();
      await expect(
        serverNodes.connect(anotherOwner).newStake(owner.address, AddressZero, { value: 50 })
      ).to.be.revertedWith("node already registered");
    });

    it("same owner 2 nodes", async function () {
      const [_, anotherNode] = await ethers.getSigners();
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await expect(serverNodes.newStake(anotherNode.address, AddressZero, { value: 50 })).to.not.be.reverted;
    });
  });

  describe("addStake", function () {
    it("ok", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await serverNodes.addStake(owner.address, { value: 50 });
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(100);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(0);
    });

    it("onboarded ok", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.onBlock();
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(50);

      await serverNodes.addStake(owner.address, { value: 50 });
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(100);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(100);
    });

    it("value == 0", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await expect(serverNodes.addStake(owner.address)).to.be.revertedWith("msg.value must be > 0");
    });

    it("not owner", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      const [_, notOwner] = await ethers.getSigners();
      await expect(serverNodes.connect(notOwner).addStake(owner.address, { value: 50 })).to.be.revertedWith(
        "Only owner can do this"
      );
    });
  });

  describe("unstake", function () {
    it("unstake", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });

      await expect(serverNodes.unstake(owner.address, 50)).to.emit(lockKeeper, "Locked");
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(0);
    });

    it("unstake part", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });

      await expect(serverNodes.unstake(owner.address, 1)).to.emit(lockKeeper, "Locked");
      expect((await serverNodes.stakes(owner.address)).stake).to.be.eq(49);
    });

    it("unstake part locked correctly", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });

      await expect(serverNodes.unstake(owner.address, 1)).to.emit(lockKeeper, "Locked");
      const lockId = await serverNodes.lockedWithdraws(owner.address);
      const lock = await lockKeeper.getLock(lockId);
      console.log(lock);
      console.log(lock);
    });

    it("unstake onboarded", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.onBlock();
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);

      await serverNodes.unstake(owner.address, 5);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(45);
    });

    it("amount == 0", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await expect(serverNodes.unstake(owner.address, 0)).to.be.revertedWith("amount must be > 0");
    });

    it("stake < amount", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await expect(serverNodes.unstake(owner.address, 100)).to.be.revertedWith("stake < amount");
    });

    it("resulting stake < minStakeAmount", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await expect(serverNodes.unstake(owner.address, 40)).to.be.revertedWith("resulting stake < minStakeAmount");
    });

    it("not owner", async function () {
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      const [_, notOwner] = await ethers.getSigners();
      await expect(serverNodes.connect(notOwner).unstake(owner.address, 50)).to.be.revertedWith(
        "Only owner can do this"
      );
    });
  });

  describe("onboard delay", function () {
    it("many nodes", async function () {
      const [_, node1, node2, node3, node4] = await ethers.getSigners();
      await serverNodes.connect(node1).newStake(node1.address, AddressZero, { value: 50 });
      await serverNodes.connect(node2).newStake(node2.address, AddressZero, { value: 50 });
      await serverNodes.connect(node3).newStake(node3.address, AddressZero, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.connect(node4).newStake(node4.address, AddressZero, { value: 50 });
      await serverNodes.connect(node3).unstake(node3.address, 50);
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
      await serverNodes.newStake(owner.address, AddressZero, { value: 50 });
      await time.setNextBlockTimestamp(T + onboardingDelay + 1);
      await serverNodes.onBlock();
      await validatorSet.finalizeChange();

      await airBond.mint(serverNodes.rewardsBank(), 10000);
      await owner.sendTransaction({ to: serverNodes.rewardsBank(), value: 10000 });

      await impersonateAccount(validatorSet.address);
      await setBalance(validatorSet.address, ethers.utils.parseEther("1"));
      validatorSetSigner = await ethers.getSigner(validatorSet.address);
    });

    it("reward with bonds (amb to stake, bonds to owner address)", async function () {
      await time.setNextBlockTimestamp(T + 10000);
      const [nativeReward, bondsReward] = await getRewardsValues(10, getBondsPercent(10000));

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, 0) // todo why owner balance is changed?
        .to.changeTokenBalance(airBond, owner, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50 + nativeReward);
    });

    it("reward with bonds (amb and bonds to reward address)", async function () {
      const [_, rewardAddress] = await ethers.getSigners();
      await serverNodes.setRewardsAddress(owner.address, rewardAddress.address);

      await time.setNextBlockTimestamp(T + 10000);
      const [nativeReward, bondsReward] = await getRewardsValues(10, getBondsPercent(10000));

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(rewardAddress, nativeReward)
        .to.changeTokenBalance(airBond, rewardAddress, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);
    });

    it("reward with bonds (amb and bonds to reward address (which is owner))", async function () {
      await serverNodes.setRewardsAddress(owner.address, owner.address);
      await time.setNextBlockTimestamp(T + 10000);
      const [nativeReward, bondsReward] = await getRewardsValues(10, getBondsPercent(10000));

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, nativeReward)
        .to.changeTokenBalance(airBond, owner, bondsReward);

      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50);
    });

    it("reward without bonds (3 years)", async function () {
      const years3 = 3 * 365 * 24 * 60 * 60;
      await time.setNextBlockTimestamp(T + years3);
      const [nativeReward, bondsReward] = await getRewardsValues(10, getBondsPercent(years3));
      expect(bondsReward).to.be.eq(0);

      await expect(serverNodes.connect(validatorSetSigner).reward(owner.address, 10))
        .to.changeEtherBalance(owner, 0)
        .to.changeTokenBalance(airBond, owner, bondsReward);
      expect(await validatorSet.getNodeStake(owner.address)).to.be.eq(50 + nativeReward);
    });

    it("reward without bonds (4 years)", async function () {
      const years4 = 4 * 365 * 24 * 60 * 60;
      await time.setNextBlockTimestamp(T + years4);
      const [nativeReward, bondsReward] = await getRewardsValues(10, getBondsPercent(years4));
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
        "nodeAddress not in stakes"
      );
    });

    it("setRewardsAddress by not owner", async function () {
      const [_, notOwner] = await ethers.getSigners();
      await expect(serverNodes.setRewardsAddress(notOwner.address, owner.address)).to.be.revertedWith(
        "Only owner can do this"
      );
    });
  });

  describe("changeNodeOwner", async function () {
    it("if requester is not owner of node, must be reverted", async function () {
      const [_, notOwner] = await ethers.getSigners();
      await expect(serverNodes.changeNodeOwner(notOwner.address, owner.address)).to.be.revertedWith(
        "Only owner can do this"
      );
    });

    it("should change node owner", async function () {
      const [_, user] = await ethers.getSigners();

      await serverNodes.newStake(owner.address, AddressZero, { value: 100 });
      await serverNodes.changeNodeOwner(owner.address, user.address);

      expect((await serverNodes.stakes(owner.address)).ownerAddress).to.equal(user.address);
    });
  });

  describe("changeMinStakeAmount", async function () {
    it("should change min stake", async function () {
      await validatorSet.grantRole(await validatorSet.DEFAULT_ADMIN_ROLE(), owner.address);

      await serverNodes.changeMinStakeAmount(1000);

      const minStake = await serverNodes.minStakeAmount();

      expect(minStake).to.equal(1000);
    });
  });

  describe("changeUnstakeLockTime", async function () {
    it("should change unstake lock time", async function () {
      await validatorSet.grantRole(await validatorSet.DEFAULT_ADMIN_ROLE(), owner.address);

      await serverNodes.changeUnstakeLockTime(1000);

      const minStake = await serverNodes.unstakeLockTime();

      expect(minStake).to.equal(1000);
    });
  });

  describe("importOldStakes", async function () {
    it("should import old stakes correctly", async function () {
      const [user1, user2, user3] = await ethers.getSigners();
      const amounts = [100, 200, 300];
      const totalSum = amounts.reduce((a, b) => a + b, 0);
      const timestamps = [T - 1000 * 60 * 60 * 24, T - 1000 * 60 * 60 * 12, T - 1000 * 60 * 60 * 6]; // Some timestamps in the past

      expect((await serverNodes.stakes(user1.address)).stake).to.be.eq(0);
      expect((await serverNodes.stakes(user2.address)).stake).to.be.eq(0);
      expect((await serverNodes.stakes(user3.address)).stake).to.be.eq(0);

      const addresses = [user1.address, user2.address, user3.address];

      await serverNodes.importOldStakes(addresses, amounts, timestamps, { value: totalSum });

      expect((await serverNodes.stakes(addresses[0])).stake).to.be.eq(amounts[0]);
      expect((await serverNodes.stakes(addresses[1])).stake).to.be.eq(amounts[1]);
      expect((await serverNodes.stakes(addresses[2])).stake).to.be.eq(amounts[2]);
    });

    it("if input arrays have different lengths, should revert ", async function () {
      const [_, user1, user2] = await ethers.getSigners();
      const addresses = [user1.address, user2.address];
      const amounts = [100, 200];
      const timestamps = [T - 1000 * 60 * 60 * 24];

      await expect(serverNodes.importOldStakes(addresses, amounts, timestamps)).to.be.revertedWith("Invalid input");
    });

    it("if stake already exists for the node, should revert", async function () {
      const [_, user] = await ethers.getSigners();
      const addresses = [user.address];
      const amounts = [100];
      const timestamps = [T - 1000 * 60 * 60 * 24];

      // import first time to add import to address
      await serverNodes.importOldStakes(addresses, amounts, timestamps, { value: 100 }); //100 - is total amount

      // import second time to check revert
      await expect(serverNodes.importOldStakes(addresses, amounts, timestamps, { value: 0 })).to.be.revertedWith(
        "node already registered"
      );
    });

    it("if msg.value is not equal to total stake amounts, should revert ", async function () {
      const addresses = [owner.address, ethers.constants.AddressZero];
      const amounts = [100, 200];
      const timestamps = [T - 1000 * 60 * 60 * 24, T - 1000 * 60 * 60 * 12];

      await expect(serverNodes.importOldStakes(addresses, amounts, timestamps, { value: 250 })).to.be.revertedWith(
        "msg.value must be equal to amounts sum"
      );
    });

    it("if stake amount is less than minStakeAmount, should revert ", async function () {
      const addresses = [owner.address];
      const amounts = [10];
      const timestamps = [T - 1000 * 60 * 60 * 24];

      await expect(serverNodes.importOldStakes(addresses, amounts, timestamps)).to.be.revertedWith(
        "msg.value must be > minStakeAmount"
      );
    });
  });

  describe("pause", async function () {
    it("should pause contract", async function () {
      expect(await serverNodes.paused()).to.be.false;

      await serverNodes.pause();

      expect(await serverNodes.paused()).to.be.true;
    });
  });

  describe("unpause", async function () {
    it("should unpause contract", async function () {
      await serverNodes.pause();

      expect(await serverNodes.paused()).to.be.true;

      await serverNodes.unpause();

      expect(await serverNodes.paused()).to.be.false;
    });
  });

  async function getRewardsValues(amount: number, bondsPercent: number) {
    const treasuryFee = +(await Treasury__factory.connect(await serverNodes.treasury(), owner).calcFee(amount));
    amount -= treasuryFee;

    const bondsReward = Math.floor((amount * bondsPercent) / 100);
    const nativeReward = amount - bondsReward;
    return [nativeReward, bondsReward];
  }
});

function getBondsPercent(stakingTime: number) {
  return 0; // for now

  const nativePercent = 25 + (stakingTime * 75) / (3 * 365 * 24 * 60 * 60);
  return 100 - Math.min(nativePercent, 100);
}
