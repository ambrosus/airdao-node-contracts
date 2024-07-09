import {loadFixture, setBalance} from "@nomicfoundation/hardhat-network-helpers";
import {ethers, upgrades} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

import {
  AirBond__factory,
  LiquidNodeManager,
  LiquidPool,
  RewardsBank__factory, StakingTiers,
  StAMB,
  StAMB__factory,
  TEST_ValidatorSet,
  Treasury__factory
} from "../../typechain-types";
import {expect} from "chai";

describe("LiquidPool", function () {
  let liquidPool: LiquidPool;
  let stAMB: StAMB;
  let stakingTiers: StakingTiers;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  async function deploy() {
    const [owner, addr1] = await ethers.getSigners();

    const validatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(validatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0);
    const treasuryFee = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);
    const airBond = await new AirBond__factory(owner).deploy(owner.address);


    const stAMB = await new StAMB__factory(owner).deploy();


    const stakingTiersFactory = await ethers.getContractFactory("StakingTiers");
    const stakingTiers = await upgrades.deployProxy(stakingTiersFactory, [
      stAMB.address
    ]) as StakingTiers;

    const nodeStake = ethers.utils.parseEther("5000000");
    const maxNodeCount = 10;

    const nodeManagerFactory = await ethers.getContractFactory("LiquidNodeManager");
    const nodeManager = (await upgrades.deployProxy(nodeManagerFactory, [
      validatorSet.address,
      rewardsBank.address,
      treasury.address,
      treasuryFee.address,
      nodeStake,
      maxNodeCount,
    ])) as LiquidNodeManager;

    const interest = 100000; // 10%
    const interestRate = 24 * 60 * 60; // 1 day
    const minStakeValue = 10;
    const bondAddress = airBond.address;
    const lockPeriod = 24 * 30 * 60 * 60; // 30 days


    const liquidPoolFactory = await ethers.getContractFactory("LiquidPool");
    const liquidPool = (await upgrades.deployProxy(liquidPoolFactory, [
      nodeManager.address,
      rewardsBank.address,
      stakingTiers.address,
      bondAddress,
      stAMB.address,
      interest,
      interestRate,
      minStakeValue,
      lockPeriod
    ])) as LiquidPool;

    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), liquidPool.address);
    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), liquidPool.address);
    await nodeManager.grantRole(await nodeManager.DEFAULT_ADMIN_ROLE(), liquidPool.address);
    await stAMB.setLiquidPool(liquidPool.address);


    await airBond.grantRole(await airBond.MINTER_ROLE(), owner.address);
    await setBalance(rewardsBank.address, ethers.utils.parseEther("1000"));
    await airBond.mint(rewardsBank.address, ethers.utils.parseEther("1000"));


    return {liquidPool, stAMB, stakingTiers, owner, addr1};
  }

  beforeEach(async function () {
    ({liquidPool, stAMB, stakingTiers, owner, addr1} = await loadFixture(deploy));
  });

  describe("Stacking", function () {
    it("should allow stacking", async function () {
      await expect(liquidPool.stake({value: 50})).to.changeEtherBalance(owner, -50);
      expect(await liquidPool.getTotalStAmb()).to.be.equal(50);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(50);
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(50);

      await expect(liquidPool.stake({value: 25})).to.changeEtherBalance(owner, -25);
      expect(await liquidPool.getTotalStAmb()).to.be.equal(75);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(75);
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(75);
    });

    it("should reject stakes below minStakeValue", async function () {
      await expect(liquidPool.stake({value: 0})).to.be.revertedWith("Pool: stake value too low");
    });
  });

  describe("Unstacking", function () {
    it("should allow unstaking", async function () {
      await liquidPool.stake({value: 25});
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(25);
      await liquidPool.setLockPeriod(0);

      await stakingTiers.setBonus(owner.address, 75);
      await liquidPool.unstake(25, 75);
      expect(await liquidPool.getTotalStAmb()).to.be.equal(0);
      expect(await liquidPool.getStake(owner.address)).to.be.equal(0);
      expect(await stAMB.balanceOf(owner.address)).to.be.equal(0);
    });

    it("should reject unstaking more then staked", async function () {
      await liquidPool.stake({value: 50});
      await expect(liquidPool.unstake(100, 75)).to.be.revertedWith("Sender has not enough tokens");
    });

    // todo unlock like in server nodes
    // it("should reject unstaking before lock period", async function () {
    //   await liquidPool.setLockPeriod(24 * 60 * 60);
    //   await liquidPool.stake({ value: 50 });
    //   console.log(await liquidPool.lockPeriod());
    //   await expect(liquidPool.unstake(50)).to.be.revertedWith("Lock period is not expired");
    // });
  });

  describe("Access control", function () {
    it("should only allow admin to set interest", async function () {
      await liquidPool.connect(owner).setInterest(1000);
      expect(await liquidPool.interest()).to.be.equal(1000);

      await expect(liquidPool.connect(addr1).setInterest(1000)).to.be.reverted;
    });
  });

});
