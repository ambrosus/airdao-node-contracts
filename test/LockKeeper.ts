import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {expect} from "chai";
import {ethers} from "hardhat";
import {BigNumber, Contract} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {LockKeeper} from "../typechain-types";
import {AddressZero} from "@ethersproject/constants";

const T = 30000000000;

describe("LockKeeper", function () {
  let lockKeeper: LockKeeper;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async function () {
    ({contract: lockKeeper, user1, user2} = await loadFixture(deploy));
  });


  async function deployERC20() {
    const [owner] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AmbBond");
    const contract = await Factory.deploy();
    return {contract};
  }

  async function deploy() {
    const [user1, user2] = await ethers.getSigners();

    await time.setNextBlockTimestamp(T);
    const Factory = await ethers.getContractFactory("LockKeeper");
    const contract = await Factory.deploy();

    return {contract, user1, user2};
  }

  describe("lock", function () {


    it("lock single", async function () {
      await time.setNextBlockTimestamp(T + 10);  // to match `lockTime` field in event

      await expect(
        lockKeeper.lockSingle(user2.address, AddressZero, T + 1000, 100, "Test", {value: 100})
      ).to.emit(lockKeeper, "Locked")
        .withArgs(1, user2.address, AddressZero, user1.address, T + 10, T + 1000, 0, 1, 100, "Test");

      expect(normalizeStruct(await lockKeeper.locks(1))).to.deep.eq({
        receiver: user2.address,
        token: AddressZero,
        firstUnlockTime: T + 1000,
        unlockPeriod: 0,
        totalClaims: 1,
        timesClaimed: 0,
        intervalAmount: 100
      })

      expect(await lockKeeper.allUserLocks(user2.address)).to.eql([BigNumber.from(1)]);

      expect(await ethers.provider.getBalance(lockKeeper.address)).to.eq(100);

      console.log("ASD")

    });

    it("lock linear", async function () {
      await time.setNextBlockTimestamp(T + 10);  // to match `lockTime` field in event

      await expect(
        lockKeeper.lockLinear(user2.address, AddressZero, T + 1000,
          3, 200, 100, "Test", {value: 300})
      ).to.emit(lockKeeper, "Locked")
        .withArgs(1, user2.address, AddressZero, user1.address, T + 10, T + 1000, 200, 3, 100, "Test");
    });

    it("wrong AMB amount", async function () {
      await expect(
        lockKeeper.lockSingle(user2.address, AddressZero, T + 1000, 100, "Test", {value: 42})
      ).to.be.revertedWith("LockKeeper: wrong AMB amount");
    });

    it("wrong totalClaims", async function () {
      await time.setNextBlockTimestamp(T + 10);  // to match `lockTime` field in event

      await expect(
        lockKeeper.lockLinear(user2.address, AddressZero, T + 1000,
          0, 200, 100, "Test", {value: 300})
      ).to.be.revertedWith("LockKeeper: totalClaims must be > 0");
    });


    describe("lock erc20", function () {
      let erc20: Contract;

      beforeEach(async function () {
        ({contract: erc20} = await loadFixture(deployERC20));
      });


      it("should work", async function () {
        await erc20.increaseAllowance(lockKeeper.address, 100);
        await erc20.reward(user1.address, 100);

        await expect(
          lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test")
        ).to.emit(lockKeeper, "Locked")
          .withArgs(1, user2.address, erc20.address, user1.address, anyValue, T + 1000, 0, 1, 100, "Test");

        expect(await erc20.balanceOf(lockKeeper.address)).to.eq(100);
      });


      it("send AMB", async function () {
        await expect(
          lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test", {value: 42})
        ).to.be.revertedWith('LockKeeper: why do you send AMB?');
      });

      it("insufficient allowance", async function () {
        await expect(
          lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test")
        ).to.be.revertedWith('ERC20: insufficient allowance');
      });


      it("transfer amount exceeds balance", async function () {
        await erc20.increaseAllowance(lockKeeper.address, 1000);

        await expect(
          lockKeeper.lockSingle(user2.address, erc20.address, T + 1000, 100, "Test")
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });


    });

  });


  describe("claim", function () {

    describe("claim single", function () {

      beforeEach(async function () {
        // lock
        await lockKeeper.lockSingle(user1.address, AddressZero, T + 1000, 100, "Test", {value: 100});
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
        await expect(lockKeeper.claim(1)).to.be.revertedWith("LockKeeper: lock not found");
      });

    });

    it("claim erc20", async function () {
      // lock
      const {contract: erc20} = await loadFixture(deployERC20);
      await erc20.increaseAllowance(lockKeeper.address, 100);
      await erc20.reward(user1.address, 100);

      await lockKeeper.lockSingle(
        user1.address, erc20.address,
        T + 1000, 100, "Test"
      )

      await time.setNextBlockTimestamp(T + 1000);
      await expect(lockKeeper.claim(1)).to.changeTokenBalance(erc20, user1, 100);
    });

    describe("claim linear", function () {

      beforeEach(async function () {
        // lock
        await lockKeeper.lockLinear(user1.address, AddressZero, T + 1000,
          3, 200, 100, "Test", {value: 300});
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

        await expect(lockKeeper.claim(1)).to.be.revertedWith("LockKeeper: lock not found");
      });

    });

    describe("claimAll", function () {

      beforeEach(async function () {
        // lock
        await lockKeeper.lockLinear(user1.address, AddressZero, T + 1000,
          3, 200, 100, "Test", {value: 300});
        await lockKeeper.lockLinear(user1.address, AddressZero, T + 2000,
          1, 200, 100, "Test", {value: 100});
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


});

function normalizeStruct(struct: any) {
  // remove array keys, leave only object keys
  return Object.fromEntries(Object.entries(struct).filter(([k, v]) => isNaN(+k)));
}
