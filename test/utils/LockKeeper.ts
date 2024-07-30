import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AddressZero } from "@ethersproject/constants";
import { LockKeeper } from "../../typechain-types";

const T = 40000000000;

describe("LockKeeper", function () {
  let lockKeeper: LockKeeper;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  async function deployERC20() {
    const Factory = await ethers.getContractFactory("MintableERC20");
    const contract = await Factory.deploy("Test", "Test");
    return { contract };
  }

  async function deploy() {
    const [user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("LockKeeper");
    const contract = (await upgrades.deployProxy(Factory, [])) as LockKeeper;

    await time.setNextBlockTimestamp(T);
    return { contract, user1, user2 };
  }

  beforeEach(async function () {
    ({ contract: lockKeeper, user1, user2 } = await loadFixture(deploy));
  });

  describe("lock", function () {
    it("returns empty array when no locks are present", async function () {
      expect(await lockKeeper.getAllLocksIds()).to.deep.equal([]);
      expect(await lockKeeper.getAllLocks()).to.deep.equal([]);
    });

    it("returns correct lock ids after locks are added", async function () {
      await lockKeeper.lockSingle(user1.address, ethers.constants.AddressZero, 1672531200, 100, "test lock", {
        value: 100,
      });
      const lockIds = await lockKeeper.getAllLocksIds();
      expect(lockIds).to.have.lengthOf(1);
    });

    it("lock single", async function () {
      await expect(lockKeeper.lockSingle(user2.address, AddressZero, T + 1000, 100, "Test", { value: 100 }))
        .to.emit(lockKeeper, "Locked")
        .withArgs(1, user2.address, AddressZero, user1.address, T, T + 1000, 1, 1, 100, "Test");

      expect(normalizeStruct(await lockKeeper.getLock(1))).to.deep.eq({
        locker: user1.address,
        receiver: user2.address,
        token: AddressZero,
        firstUnlockTime: T + 1000,
        unlockPeriod: 1,
        totalClaims: 1,
        timesClaimed: 0,
        intervalAmount: 100,
        description: "Test",
      });

      expect((await lockKeeper.allUserLocks(user2.address))[0]).to.eql([BigNumber.from(1)]);

      expect(await ethers.provider.getBalance(lockKeeper.address)).to.eq(100);
    });

    it("lock linear", async function () {
      await expect(lockKeeper.lockLinear(user2.address, AddressZero, T + 1000, 3, 200, 100, "Test", { value: 300 }))
        .to.emit(lockKeeper, "Locked")
        .withArgs(1, user2.address, AddressZero, user1.address, T, T + 1000, 200, 3, 100, "Test");

      expect(normalizeStruct(await lockKeeper.getLock(1))).to.deep.eq({
        locker: user1.address,
        receiver: user2.address,
        token: AddressZero,
        firstUnlockTime: T + 1000,
        unlockPeriod: 200,
        totalClaims: 3,
        timesClaimed: 0,
        intervalAmount: 100,
        description: "Test",
      });
    });

    it("wrong AMB amount", async function () {
      await expect(lockKeeper.lockSingle(user2.address, AddressZero, T + 1000, 100, "Test", { value: 42 })).to.be
        .reverted;
    });

    it("wrong totalClaims", async function () {
      await expect(lockKeeper.lockLinear(user2.address, AddressZero, T + 1000, 0, 200, 100, "Test", { value: 300 })).to
        .be.reverted;
    });

    describe("lock erc20", function () {
      let erc20: Contract;

      beforeEach(async function () {
        ({ contract: erc20 } = await loadFixture(deployERC20));
      });

      it("should work", async function () {
        await erc20.increaseAllowance(lockKeeper.address, 100);
        await erc20.mint(user1.address, 100);

        await expect(lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test"))
          .to.emit(lockKeeper, "Locked")
          .withArgs(1, user2.address, erc20.address, user1.address, anyValue, T + 1000, 1, 1, 100, "Test");

        expect(await erc20.balanceOf(lockKeeper.address)).to.eq(100);
      });

      it("send AMB", async function () {
        await expect(
          lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test", { value: 42 })
        ).to.be.revertedWith("LockKeeper: why do you send AMB?");
      });

      it("insufficient allowance", async function () {
        await expect(lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test")).to.be.revertedWith(
          "ERC20: insufficient allowance"
        );
      });

      it("transfer amount exceeds balance", async function () {
        await erc20.increaseAllowance(lockKeeper.address, 1000);

        await expect(lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test")).to.be.revertedWith(
          "ERC20: transfer amount exceeds balance"
        );
      });
    });
  });

  describe("claim", function () {
    describe("autoClaim", function () {
      it("does not claim when no locks are present", async function () {
        await expect(lockKeeper.autoClaim()).to.be.reverted;
      });

      it("claims a lock when one is present and time has passed", async function () {
        await lockKeeper.lockSingle(
          user1.address,
          ethers.constants.AddressZero,
          Math.floor(Date.now() / 1000),
          100,
          "test lock",
          { value: 100 }
        );
        await ethers.provider.send("evm_increaseTime", [3600]);
        await ethers.provider.send("evm_mine", []);
        await expect(lockKeeper.autoClaim()).to.emit(lockKeeper, "Claim");
      });
    });

    describe("claim single", function () {
      beforeEach(async function () {
        // lock
        await lockKeeper.lockSingle(user1.address, AddressZero, T + 1000, 100, "Test", { value: 100 });
      });

      it("too early", async function () {
        await expect(lockKeeper.claim(1)).to.be.revertedWith("LockKeeper: too early to claim");
      });

      it("wrong user", async function () {
        await expect(lockKeeper.connect(user2).claim(1)).to.be.revertedWith("LockKeeper: not your lock");
      });

      it("should work", async function () {
        await time.setNextBlockTimestamp(T + 1000);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 100);
      });

      it("try to claim second time", async function () {
        await time.setNextBlockTimestamp(T + 1000);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 100);
        await expect(lockKeeper.claim(1)).to.be.revertedWith("LockKeeper: not your lock");
      });
    });

    it("claim erc20", async function () {
      // lock
      const { contract: erc20 } = await loadFixture(deployERC20);
      await erc20.increaseAllowance(lockKeeper.address, 100);
      await erc20.mint(user1.address, 100);

      await lockKeeper.lockSingle(user1.address, erc20.address, T + 1000, 100, "Test");

      await time.setNextBlockTimestamp(T + 1000);
      await expect(lockKeeper.claim(1)).to.changeTokenBalance(erc20, user1, 100);
    });

    describe("claim linear", function () {
      beforeEach(async function () {
        // lock
        await lockKeeper.lockLinear(user1.address, AddressZero, T + 1000, 3, 200, 100, "Test", { value: 300 });
      });

      it("try to claim second time", async function () {
        await time.setNextBlockTimestamp(T + 1000);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 100);
        await expect(lockKeeper.claim(1)).to.be.revertedWith("LockKeeper: too early to claim");
      });

      it("claim second interval after waiting", async function () {
        await time.setNextBlockTimestamp(T + 1000);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 100);
        await time.setNextBlockTimestamp(T + 1000 + 200);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 100);
      });

      it("claim first two intervals at one call", async function () {
        await time.setNextBlockTimestamp(T + 1000 + 200);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 200);
      });

      it("claim all and try to claim again", async function () {
        await time.setNextBlockTimestamp(T + 1000 + 200 + 200);
        await expect(lockKeeper.claim(1)).to.changeEtherBalance(user1, 300);

        await expect(lockKeeper.claim(1)).to.be.revertedWith("LockKeeper: not your lock");
      });
    });

    describe("claimAll", function () {
      beforeEach(async function () {
        // lock
        await lockKeeper.lockLinear(user1.address, AddressZero, T + 1000, 3, 200, 100, "Test", { value: 300 });
        await lockKeeper.lockLinear(user1.address, AddressZero, T + 2000, 1, 200, 100, "Test", { value: 100 });
      });

      it("claim part of one lock", async function () {
        await time.setNextBlockTimestamp(T + 1000 + 200);
        await expect(lockKeeper.claimAll()).to.changeEtherBalance(user1, 200);
      });

      it("claim only one lock", async function () {
        await time.setNextBlockTimestamp(T + 1000 + 500);
        await expect(lockKeeper.claimAll()).to.changeEtherBalance(user1, 300);
      });

      it("wait for both and claim both", async function () {
        await time.setNextBlockTimestamp(T + 2000);
        await expect(lockKeeper.claimAll()).to.changeEtherBalance(user1, 400);
      });

      it("nothing to claim", async function () {
        await time.setNextBlockTimestamp(T + 100);
        await expect(lockKeeper.claimAll()).to.be.revertedWith("LockKeeper: nothing to claim");
      });
    });
  });

  describe("cancelLock", function () {
    let erc20: Contract;

    beforeEach(async function () {
      ({ contract: erc20 } = await loadFixture(deployERC20));
    });

    it("should allow the locker to cancel the lock", async function () {
      await erc20.mint(user1.address, 100);
      await erc20.approve(lockKeeper.address, 100);
      await lockKeeper.lockSingle(user1.address, erc20.address, 1672531200, 100, "example of lockSingle");

      await expect(lockKeeper.cancelLock(1)).to.emit(lockKeeper, "LockCanceled");
    });

    it("should not allow non-locker to cancel the lock", async function () {
      await erc20.mint(user1.address, 100);
      await erc20.approve(lockKeeper.address, 100);
      await lockKeeper.lockSingle(user2.address, erc20.address, 1672531200, 100, "example of lockSingle");

      await expect(lockKeeper.connect(user2).cancelLock(1)).to.be.revertedWith(
        "Only address that create lock can cancel it"
      );
    });

    it("should return unclaimed native coin amount when cancelling the lock", async function () {
      await erc20.mint(user1.address, 100000);
      await erc20.approve(lockKeeper.address, 100000);

      await lockKeeper.lockSingle(
        user2.address,
        ethers.constants.AddressZero,
        1672531200,
        100000,
        "example of lockSingle",
        { value: 100000 }
      );

      const initialBalance = await ethers.provider.getBalance(user1.address);
      const tx = await lockKeeper.cancelLock(1);
      await tx.wait();
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const tolerance = ethers.utils.parseEther("0.01");

      expect(finalBalance.add(tolerance)).to.be.gte(initialBalance);
    });

    it("should return unclaimed amount when cancelling the lock", async function () {
      await erc20.mint(user1.address, 100);
      await erc20.approve(lockKeeper.address, 100);
      await lockKeeper.lockSingle(user2.address, erc20.address, 1672531200, 100, "example of lockSingle");

      await expect(lockKeeper.cancelLock(1))
        .to.emit(lockKeeper, "LockCanceled").withArgs(1, 100);
    });
  });

  describe("on block function", function () {
    let erc20: Contract;

    beforeEach(async function () {
      ({ contract: erc20 } = await loadFixture(deployERC20));
    });

    it("should not auto claim when onBlock is called and it's too early to claim", async function () {
      await erc20.mint(user1.address, 100);
      await erc20.approve(lockKeeper.address, 100);
      await lockKeeper.lockSingle(
        user2.address,
        erc20.address,
        Math.floor(Date.now() / 1000) + 10, // unlock time is 10 seconds from now
        100,
        "example of lockSingle"
      );

      await lockKeeper.onBlock();

      const lock = await lockKeeper.getLock(1);
      expect(lock.timesClaimed).to.equal(0);
    });
  });
});

function normalizeStruct(struct: any) {
  // remove array keys, leave only object keys
  return Object.fromEntries(Object.entries(struct).filter(([k]) => isNaN(+k)));
}
