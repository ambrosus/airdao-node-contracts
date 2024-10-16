import { loadFixture, setBalance, time } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  AirBond,
  AirBond__factory,
  LiquidNodesManager,
  LiquidPool,
  RewardsBank__factory,
  LockKeeper__factory,
  LockKeeper,
  StakingTiers,
  StAMB,
  StAMB__factory,
  TEST_ValidatorSet,
  Treasury__factory
} from "../../typechain-types";
import { expect } from "chai";

const D1 = 60 * 60 * 24;
const BILLION = 1_000_000_000;

const T = 20000000000;

const nodeStake = ethers.utils.parseEther("500");
const maxNodeCount = 10;

const interest = 0.10 * BILLION; // 10%
const interestPeriod = D1; // 1 day
const minStakeValue = 1;
const lockPeriod = 30 * D1; // 30 days
const penalty = 0.10 * BILLION; // 10%


describe("LiquidPool", function () {
  let liquidPool: LiquidPool;
  let stAMB: StAMB;
  let airBond: AirBond;
  let stakingTiers: StakingTiers;
  let lockKeeper: LockKeeper;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  async function deploy() {
    await time.setNextBlockTimestamp(T);

    const [owner, addr1] = await ethers.getSigners();

    const validatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(validatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;

    const rewardsBankNode = await new RewardsBank__factory(owner).deploy();
    const rewardsBankPool = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0);
    const treasuryFee = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);
    const airBond = await new AirBond__factory(owner).deploy(owner.address);

    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const stAMB = await new StAMB__factory(owner).deploy();


    const stakingTiersFactory = await ethers.getContractFactory("StakingTiers");
    const stakingTiers = await upgrades.deployProxy(stakingTiersFactory, [
      stAMB.address
    ]) as StakingTiers;


    const nodeManagerFactory = await ethers.getContractFactory("LiquidNodesManager");
    const nodeManager = (await upgrades.deployProxy(nodeManagerFactory, [
      validatorSet.address,
      rewardsBankNode.address,
      treasury.address,
      treasuryFee.address,
      nodeStake,
      maxNodeCount,
    ])) as LiquidNodesManager;

    const liquidPoolFactory = await ethers.getContractFactory("LiquidPool");
    const liquidPool = (await upgrades.deployProxy(liquidPoolFactory, [
      nodeManager.address,
      rewardsBankPool.address,
      stakingTiers.address,
      lockKeeper.address,
      airBond.address,
      stAMB.address,
      interest,
      interestPeriod,
      minStakeValue,
      lockPeriod,
      penalty
    ])) as LiquidPool;


    await stAMB.setLiquidPool(liquidPool.address);
    await nodeManager.grantRole(await nodeManager.POOL_ROLE(), liquidPool.address);

    await rewardsBankNode.grantRole(await rewardsBankNode.DEFAULT_ADMIN_ROLE(), nodeManager.address);
    await rewardsBankPool.grantRole(await rewardsBankPool.DEFAULT_ADMIN_ROLE(), liquidPool.address);
    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), nodeManager.address);


    await airBond.grantRole(await airBond.MINTER_ROLE(), owner.address);
    await setBalance(rewardsBankNode.address, ethers.utils.parseEther("1000"));
    await airBond.mint(rewardsBankNode.address, ethers.utils.parseEther("1000"));
    await setBalance(rewardsBankPool.address, ethers.utils.parseEther("1000"));
    await airBond.mint(rewardsBankPool.address, ethers.utils.parseEther("1000"));

    return { liquidPool, stAMB, airBond, stakingTiers, lockKeeper, owner, addr1 };
  }

  beforeEach(async function () {
    ({ liquidPool, stAMB, airBond, stakingTiers, lockKeeper, owner, addr1 } = await loadFixture(deploy));
  });

  it("should work", async function () {
    const [A, B, C] = await ethers.getSigners();


    await liquidPool.connect(A).stake({ value: 15_000 });
    expect(await liquidPool.getStake(A.address)).to.be.equal(15_000);
    expect(await liquidPool.totalRewards()).to.be.equal(15_000);
    expect(await liquidPool.totalRewardsDebt()).to.be.equal(15_000);
    expect(await liquidPool.rewardsDebt(A.address)).to.be.equal(15_000);

    await liquidPool.connect(B).stake({ value: 5_000 });
    expect(await liquidPool.getStake(B.address)).to.be.equal(5_000);
    expect(await liquidPool.totalRewards()).to.be.equal(20_000);
    expect(await liquidPool.totalRewardsDebt()).to.be.equal(20_000);
    expect(await liquidPool.rewardsDebt(B.address)).to.be.equal(5_000);


    await liquidPool.connect(C).stake({ value: 15_000 });
    expect(await liquidPool.getStake(C.address)).to.be.equal(15_000);
    expect(await liquidPool.totalRewards()).to.be.equal(35_000);
    expect(await liquidPool.totalRewardsDebt()).to.be.equal(35_000);
    expect(await liquidPool.rewardsDebt(C.address)).to.be.equal(15_000);

  });



  describe("stake", function () {
    it("should work", async function () {
      await expect(liquidPool.stake({ value: 50 }))
        .to.changeEtherBalance(owner, -50);

      expect(await liquidPool.getTotalStAmb()).to.be.equal(50);
      expect(await liquidPool.getTotalRewards()).to.be.equal(0);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(50);

      await expect(liquidPool.stake({ value: 25 }))
        .to.changeEtherBalance(owner, -25);

      expect(await liquidPool.getTotalStAmb()).to.be.equal(75);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(75);
    });

    it("should reject stakes below minStakeValue", async function () {
      await expect(liquidPool.stake({ value: 0 })).to.be.revertedWith("Pool: stake value too low");
    });

    it("should allow to stake from many addresses", async function () {
      const testAddr1 = ethers.Wallet.createRandom().connect(ethers.provider);
      setBalance(testAddr1.address, ethers.utils.parseEther("100"));
      await expect(liquidPool.connect(testAddr1).stake({ value: 10 })).to.changeEtherBalance(testAddr1, -10);
      expect(await liquidPool.getTotalStAmb()).to.be.equal(10);
      expect(await liquidPool.getStake(testAddr1.address)).to.be.equal(10);

      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();

      const testAddr2 = ethers.Wallet.createRandom().connect(ethers.provider);
      setBalance(testAddr2.address, ethers.utils.parseEther("100"));
      await expect(liquidPool.connect(testAddr2).stake({ value: 10 })).to.changeEtherBalance(testAddr2, -10);
      expect(await liquidPool.getTotalStAmb()).to.be.equal(20);
      expect(await liquidPool.getStake(testAddr2.address)).to.be.equal(10);

      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();

      const testAddr3 = ethers.Wallet.createRandom().connect(ethers.provider);
      setBalance(testAddr3.address, ethers.utils.parseEther("100"));
      await expect(liquidPool.connect(testAddr3).stake({ value: 10 })).to.changeEtherBalance(testAddr3, -10);
      expect(await liquidPool.getTotalStAmb()).to.be.equal(30);
      expect(await liquidPool.getStake(testAddr3.address)).to.be.equal(10);

      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();
    });
  });

  it("Test strange unstake case", async function () {
    await stakingTiers.setBonus(owner.address, 100);  // can unstake with rewards in 100% amb
    await stakingTiers.setBonus(addr1.address, 100);  // can unstake with rewards in 100% amb
    await expect(await liquidPool.stake({value: 1000})).to.changeEtherBalance(owner, -1000);
    expect(await liquidPool.getStake(owner.address)).to.be.equal(1000);
    expect(await liquidPool.getTotalStAmb()).to.be.equal(1000);

    await time.increase(D1);
    await liquidPool.onBlock();

    expect(await liquidPool.totalRewards()).to.be.equal(1100);
    expect(await liquidPool.getClaimAmount(owner.address)).to.be.equal(100);

    await expect(await liquidPool.connect(addr1).stake({value: 1000})).to.changeEtherBalance(addr1, -1000);
    expect(await liquidPool.getStake(addr1.address)).to.be.equal(1000);
    expect(await liquidPool.getTotalStAmb()).to.be.equal(2000);

    await time.increase(D1);
    await liquidPool.onBlock();

    expect(await liquidPool.getClaimAmount(addr1.address)).to.be.equal(100);
    expect(await liquidPool.getClaimAmount(owner.address)).to.be.equal(200);

    await expect(await liquidPool.unstake(500, 100)).to.changeEtherBalance(owner, 200); //expecting to get rewards in amb
    expect(await liquidPool.getClaimAmount(owner.address)).to.be.equal(0);
    expect(await liquidPool.getStake(owner.address)).to.be.equal(500);
    expect(await liquidPool.getTotalStAmb()).to.be.equal(1500);

    await expect(await liquidPool.unstake(500, 100)).to.changeEtherBalance(owner, 0); //expecting to get zero rewards
    expect(await liquidPool.getClaimAmount(owner.address)).to.be.equal(0);
    expect(await liquidPool.getStake(owner.address)).to.be.equal(0);
    expect(await liquidPool.getTotalStAmb()).to.be.equal(1000);    

    await expect(await liquidPool.connect(addr1).unstake(500, 100)).to.changeEtherBalance(addr1, 100); //expecting to get rewards in amb
    expect(await liquidPool.getClaimAmount(addr1.address)).to.be.equal(0);
    expect(await liquidPool.getStake(addr1.address)).to.be.equal(500);
    expect(await liquidPool.getTotalStAmb()).to.be.equal(500);

    await expect(await liquidPool.connect(addr1).unstake(500, 100)).to.changeEtherBalance(addr1, 0); //expecting to get rewards in amb
    expect(await liquidPool.getClaimAmount(addr1.address)).to.be.equal(0);
    expect(await liquidPool.getStake(addr1.address)).to.be.equal(0);
    expect(await liquidPool.getTotalStAmb()).to.be.equal(0);    

    await liquidPool.stake({value: 1000});
  });


  describe("unstake", function () {
    beforeEach(async function () {
      await liquidPool.stake({ value: 100 });
      await stakingTiers.setBonus(owner.address, 100);  // can unstake with rewards in 100% amb
    });


    it("should work (no rewards, with delay)", async function () {
      await expect(liquidPool.unstake(100, 100)).to.emit(lockKeeper, "Locked");
    });

    it("should work (no rewards, with delay, several unstakes)", async function () {
      await expect(liquidPool.unstake(50, 100)).to.emit(lockKeeper, "Locked");
      await expect(liquidPool.unstake(50, 100)).to.emit(lockKeeper, "Locked");
    });


    it("should work (no rewards, with delay, twice)", async function () {
      await expect(liquidPool.unstake(50, 100)).to.emit(lockKeeper, "Locked");
      await expect(liquidPool.unstake(50, 100)).to.emit(lockKeeper, "Locked");
    });

    it("should work (claim rewards, with delay)", async function () {
      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.eq(10);

      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(10);

      await expect(liquidPool.unstake(100, 100)).to.emit(lockKeeper, "Locked");
    });

    it("should work (no rewards, without delay)", async function () {
      //the penalty is 10% of the stake
      await expect(liquidPool.unstakeFast(100, 100)).to.changeEtherBalance(owner, 90);

      expect(await liquidPool.getTotalStAmb()).to.be.equal(0);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(0);
    });

    it("should work (claim rewards, without delay)", async function () {
      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.eq(10);

      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(10);

      // the penalty is 10% of the stake
      await expect(() => liquidPool.unstakeFast(100, 100)).to.changeEtherBalance(owner, 100);

      expect(await liquidPool.getTotalStAmb()).to.be.equal(0);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(0);
    });

    it("should show 0 rewards after unstake", async function () {
      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.eq(10);

      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(10);

      await expect(liquidPool.unstake(100, 100)).to.emit(lockKeeper, "Locked");
      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(0);
    });

    it("should reject unstaking more then staked", async function () {
      await expect(liquidPool.unstake(1000, 75)).to.be.revertedWith("Sender has not enough tokens");
    });
  });


  describe("claimRewards", function () {
    beforeEach(async function () {
      await liquidPool.stake({ value: 100 });
      await stakingTiers.setBonus(owner.address, 100);  // can unstake with rewards in 100% amb

      // increase time by 1 day and call interest => rewards should increase by 10%
      await time.increase(D1);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.eq(10);
      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(10);
    });

    it("should work (100% amb)", async function () {
      await expect(liquidPool.claimRewards(100))
        .to.changeEtherBalance(owner, 10);
      expect(await airBond.balanceOf(owner.address)).to.eq(0);

      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(0);
    });

    it("should work (50% amb)", async function () {
      await expect(liquidPool.claimRewards(50))
        .to.changeEtherBalance(owner, 5);
      expect(await airBond.balanceOf(owner.address)).to.eq(5);
    });

    it("should work (0% amb)", async function () {
      await expect(liquidPool.claimRewards(0))
        .to.changeEtherBalance(owner, 0);
      expect(await airBond.balanceOf(owner.address)).to.eq(10);
    });

    it("shouldn't work (146% amb)", async function () {
      await expect(liquidPool.claimRewards(146)).to.be.revertedWith("Invalid desired coeff");
    });

    it("shouldn't work when user doesn't have desired tier", async function () {
      await stakingTiers.setBonus(owner.address, 0);  // without bonus user tier is 25
      expect(await stakingTiers.calculateTier(owner.address)).to.be.equal(25);

      await expect(liquidPool.claimRewards(100)).to.be.revertedWith("User tier is too low");
    });

    it("claim without rewards should do nothing", async function () {
      await expect(liquidPool.claimRewards(100))
        .to.changeEtherBalance(owner, 10);

      expect(await liquidPool.getClaimAmount(owner.address)).to.eq(0);

      await expect(liquidPool.claimRewards(100))
        .to.changeEtherBalance(owner, 0);
    });

  });


  describe("setInterest", function () {
    it("should work", async function () {
      await liquidPool.setInterest(1000, 2 * D1);
      expect(await liquidPool.interest()).to.be.equal(1000);
      expect(await liquidPool.interestPeriod()).to.be.equal(2 * D1);
    });

    it("should revert if interest is too high", async function () {
      await expect(liquidPool.setInterest(BILLION + 1, 2 * D1)).to.be.reverted;
    });

    it("should revert if not admin", async function () {
      await expect(liquidPool.connect(addr1).setInterest(1000, 2 * D1)).to.be.reverted;
    });
  });

  describe("tryInterest", function () {
    it("should work", async function () {
      await liquidPool.stake({ value: 100 });
      await liquidPool.connect(addr1).stake({ value: 900 });

      expect(await liquidPool.getTotalRewards()).to.be.equal(0);
      await time.increase(D1);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.be.equal(100);
    });

    it("should do nothing if called too early", async function () {
      await liquidPool.stake({ value: 100 });
      await liquidPool.connect(addr1).stake({ value: 900 });

      expect(await liquidPool.getTotalRewards()).to.be.equal(0);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.be.equal(0);
    });

    it("should do nothing if there is no stakes", async function () {
      expect(await liquidPool.getTotalRewards()).to.be.equal(0);
      await time.increase(D1);
      await liquidPool.onBlock();
      expect(await liquidPool.getTotalRewards()).to.be.equal(0);
    });

  });

});
