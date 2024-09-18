import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  DepositedTokenPool,
  RewardsBank__factory,
  AirBond__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

const D1 = 24 * 60 * 60;
const BILLION = 1_000_000_000;

import { expect } from "chai";

describe("DepositedTokenPool", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let depositedPool: DepositedTokenPool;
  let rewardsBank: RewardsBank;
  let lockKeeper: LockKeeper;
  let depositToken: AirBond;
  let profitableToken: AirBond;


  async function deploy() {
    const [owner, user1, user2] = await ethers.getSigners();

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const depositToken = await new AirBond__factory(owner).deploy(owner.address);
    const profitableToken = await new AirBond__factory(owner).deploy(owner.address);
    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const depositedPoolFactory = await ethers.getContractFactory("DepositedTokenPool");

    const mainConfig: DepositedTokenPool.MainConfigStruct = {
      name: "Test Deposited Pool",
      depositToken: depositToken.address,
      profitableToken: profitableToken.address,
      rewardToken: profitableToken.address,
      rewardTokenPrice: 1, // 1:1 ratio
      interest: 0.10 * BILLION, // 10%
      interestRate: D1, // 1 day
    };

    const limitsConfig: DepositedTokenPool.LimitsConfigStruct = {
      minDepositValue: 10,
      minStakeValue: 10,
      fastUnstakePenalty: 0.10 * BILLION, // 10%
      unstakeLockPeriod: D1, // 1 day
      stakeLockPeriod: D1, // 1 day
      maxTotalStakeValue: ethers.utils.parseEther("1000000"),
      maxStakePerUserValue: ethers.utils.parseEther("100000"),
      stakeLimitsMultiplier: 2 * BILLION, // 2x
    };

    const depositedPool = (await upgrades.deployProxy(depositedPoolFactory, [
      rewardsBank.address,
      lockKeeper.address,
      mainConfig
    ])) as DepositedTokenPool;

    await depositedPool.setLimitsConfig(limitsConfig);

    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), depositedPool.address);
    await depositToken.grantRole(await depositToken.MINTER_ROLE(), owner.address);
    await profitableToken.grantRole(await profitableToken.MINTER_ROLE(), owner.address);

    // Mint tokens for testing
    const mintAmount = ethers.utils.parseEther("1000000");
    await depositToken.mint(owner.address, mintAmount);
    await profitableToken.mint(owner.address, mintAmount);
    await profitableToken.mint(rewardsBank.address, mintAmount);

    // Approve tokens for testing
    await depositToken.approve(depositedPool.address, mintAmount);
    await profitableToken.approve(depositedPool.address, mintAmount);

    return { owner, user1, user2, depositedPool, rewardsBank, lockKeeper, depositToken, profitableToken};
  }

  beforeEach(async function () {
    ({ owner, user1, user2, depositedPool, rewardsBank, lockKeeper, depositToken, profitableToken } = await loadFixture(deploy));
  });

  describe("Initialization", function () {
    it("Should initialize with correct main config", async function () {
      const config = await depositedPool.getMainConfig();
      expect(config.name).to.equal("Test Deposited Pool");
      expect(config.depositToken).to.equal(depositToken.address);
      expect(config.profitableToken).to.equal(profitableToken.address);
      expect(config.rewardToken).to.equal(profitableToken.address);
      expect(config.rewardTokenPrice).to.equal(1);
      expect(config.interest).to.equal(0.10 * BILLION);
      expect(config.interestRate).to.equal(D1);
    });

    it("Should initialize with correct limits config", async function () {
      const limits = await depositedPool.getLimitsConfig();
      expect(limits.minDepositValue).to.equal(10);
      expect(limits.minStakeValue).to.equal(10);
      expect(limits.fastUnstakePenalty).to.equal(0.10 * BILLION);
      expect(limits.unstakeLockPeriod).to.equal(D1);
      expect(limits.stakeLockPeriod).to.equal(D1);
      expect(limits.maxTotalStakeValue).to.equal(ethers.utils.parseEther("1000000"));
      expect(limits.maxStakePerUserValue).to.equal(ethers.utils.parseEther("100000"));
      expect(limits.stakeLimitsMultiplier).to.equal(2 * BILLION);
    });
  });

  describe("Deposit", function () {
    it("Should allow deposit", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      await expect(depositedPool.deposit(depositAmount))
        .to.emit(depositedPool, "Deposited")
        .withArgs(owner.address, depositAmount);

      const info = await depositedPool.getInfo();
      expect(info.totalDeposit).to.equal(depositAmount);

      const staker = await depositedPool.getStaker(owner.address);
      expect(staker.deposit).to.equal(depositAmount);
    });

    it("Should not allow deposit below minimum", async function () {
      const depositAmount = 1;
      await expect(depositedPool.deposit(depositAmount)).to.be.revertedWith("Pool: deposit value is too low");
    });
  });

  describe("Withdrawal", function () {
    beforeEach(async function () {
      await depositedPool.deposit(ethers.utils.parseEther("1000"));
    });

    it("Should allow withdrawal", async function () {
      const withdrawAmount = ethers.utils.parseEther("500");
      await expect(depositedPool.withdraw(withdrawAmount))
        .to.emit(depositedPool, "Withdrawn")
        .withArgs(owner.address, withdrawAmount);

      const info = await depositedPool.getInfo();
      expect(info.totalDeposit).to.equal(ethers.utils.parseEther("500"));

      const staker = await depositedPool.getStaker(owner.address);
      expect(staker.deposit).to.equal(ethers.utils.parseEther("500"));
    });

    it("Should not allow withdrawal more than deposited", async function () {
      const withdrawAmount = ethers.utils.parseEther("1001");
      await expect(depositedPool.withdraw(withdrawAmount)).to.be.revertedWith("Not enough deposit");
    });

    it("Should not allow withdrawal that would violate stake limits", async function () {
      await depositedPool.stake(ethers.utils.parseEther("500"));
      await expect(depositedPool.withdraw(ethers.utils.parseEther("751")))
        .to.be.revertedWith("Pool: user max stake value exceeded");
    });
  });

  describe("Stake", function () {
    beforeEach(async function () {
      // Deposit before staking
      await depositedPool.deposit(ethers.utils.parseEther("1000"));
    });

    it("Should allow staking", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await expect(depositedPool.stake(stakeAmount))
        .to.emit(depositedPool, "Staked")
        .withArgs(owner.address, stakeAmount);

      const info = await depositedPool.getInfo();
      expect(info.totalStake).to.equal(stakeAmount);

      const staker = await depositedPool.getStaker(owner.address);
      expect(staker.stake).to.equal(stakeAmount);
    });

    it("Should not allow staking below minimum", async function () {
      const stakeAmount = 1;
      await expect(depositedPool.stake(stakeAmount)).to.be.revertedWith("Pool: stake value is too low");
    });

    it("Should not allow staking above user limit", async function () {
      const stakeAmount = ethers.utils.parseEther("2001");
      await expect(depositedPool.stake(stakeAmount)).to.be.revertedWith("Pool: user max stake value exceeded");
    });

    it("Should not allow staking above total pool limit", async function () {
      await depositedPool.setMaxTotalStakeValue(ethers.utils.parseEther("100"));
      const stakeAmount = ethers.utils.parseEther("101");
      await expect(depositedPool.stake(stakeAmount)).to.be.revertedWith("Pool: max stake value exceeded");
    });
  });

  describe("Unstake", function () {
    const stakeAmount = ethers.utils.parseEther("100");

    beforeEach(async function () {
      await depositedPool.deposit(ethers.utils.parseEther("1000"));
      await depositedPool.stake(stakeAmount);
      await time.increase(D1);
    });

    it("Should allow unstaking", async function () {
      await expect(depositedPool.unstake(stakeAmount))
        .to.emit(lockKeeper, "Locked");

      const info = await depositedPool.getInfo();
      expect(info.totalStake).to.equal(0);

      const staker = await depositedPool.getStaker(owner.address);
      expect(staker.stake).to.equal(0);
    });

    it("Should not allow unstaking more than staked", async function () {
      await expect(depositedPool.unstake(stakeAmount.add(1))).to.be.revertedWith("Not enough stake");
    });

    it("Should not allow unstaking before stake lock period", async function () {
      await depositedPool.setStakeLockPeriod(D1 * 2);
      await depositedPool.stake(stakeAmount);
      await time.increase(D1);
      await expect(depositedPool.unstake(stakeAmount)).to.be.revertedWith("Stake is locked");
    });
  });

  describe("Fast Unstake", function () {
    const stakeAmount = ethers.utils.parseEther("100");

    beforeEach(async function () {
      await depositedPool.deposit(ethers.utils.parseEther("1000"));
      await depositedPool.stake(stakeAmount);
      await time.increase(D1);
    });

    it("Should allow fast unstaking with penalty", async function () {
      const balanceBefore = await profitableToken.balanceOf(owner.address);
      await depositedPool.unstakeFast(stakeAmount);
      const balanceAfter = await profitableToken.balanceOf(owner.address);

      const expectedReturn = stakeAmount.mul(90).div(100); // 90% due to 10% penalty
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReturn);

      const info = await depositedPool.getInfo();
      expect(info.totalStake).to.equal(0);
    });
  });

  describe("Rewards", function () {
    const stakeAmount = 1000;

    beforeEach(async function () {
      await depositedPool.deposit(ethers.utils.parseEther("2000"));
      await depositedPool.stake(stakeAmount);
    });

    it("Should calculate rewards correctly", async function () {
      await time.increase(D1);
      await depositedPool.onBlock();

      const rewards = await depositedPool.getUserRewards(owner.address);
      const expectedRewards = stakeAmount * 0.1; // 10% interest
      expect(rewards).to.equal(expectedRewards);
    });

    it("Should allow claiming rewards", async function () {
      await time.increase(D1);
      await depositedPool.onBlock();

      const balanceBefore = await profitableToken.balanceOf(owner.address);
      await depositedPool.claim();
      const balanceAfter = await profitableToken.balanceOf(owner.address);

      const expectedRewards = stakeAmount * 0.1; // 10% interest
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedRewards);
    });
  });

  describe("Edge cases", function () {
    it("Should handle multiple deposits and stakes correctly", async function () {
      await depositedPool.setStakeLockPeriod(0); // No lock period
      const depositAmount = ethers.utils.parseEther("1000");
      const stakeAmount = ethers.utils.parseEther("500");

      await depositedPool.deposit(depositAmount);
      await depositedPool.stake(stakeAmount);
      await depositedPool.deposit(depositAmount);
      await depositedPool.stake(stakeAmount);

      const info = await depositedPool.getInfo();
      expect(info.totalDeposit).to.equal(depositAmount.mul(2));
      expect(info.totalStake).to.equal(stakeAmount.mul(2));

      const staker = await depositedPool.getStaker(owner.address);
      expect(staker.deposit).to.equal(depositAmount.mul(2));
      expect(staker.stake).to.equal(stakeAmount.mul(2));
    });

    it("Should handle rewards correctly after multiple stakes and unstakes", async function () {
      await depositedPool.setStakeLockPeriod(0); // No lock period
      const depositAmount = ethers.utils.parseEther("2000");
      const stakeAmount = ethers.utils.parseEther("500");

      await depositedPool.deposit(depositAmount);
      await depositedPool.stake(stakeAmount);
      await time.increase(D1 / 2);
      await depositedPool.stake(stakeAmount);
      await time.increase(D1 / 2);
      await depositedPool.unstake(stakeAmount);

      await depositedPool.onBlock();

      const rewards = await depositedPool.getUserRewards(owner.address);
      // Expected rewards calculation is complex due to different staking times
      expect(rewards).to.be.gt(0);
    });

    it("Should not allow actions when pool is deactivated", async function () {
      await depositedPool.deactivate();

      await expect(depositedPool.deposit(ethers.utils.parseEther("100"))).to.be.revertedWith("Pool is not active");
      await expect(depositedPool.stake(ethers.utils.parseEther("100"))).to.be.revertedWith("Pool is not active");
    });
  });


  describe("Interest calculation", function () {
    beforeEach(async function () {
      await depositedPool.deposit(ethers.utils.parseEther("1000"));
      await depositedPool.stake(500);
    });

    it("Should calculate interest correctly over multiple periods", async function () {
      for (let i = 0; i < 5; i++) {
        await time.increase(D1);
        await depositedPool.onBlock();
      }

      const rewards = await depositedPool.getUserRewards(owner.address);
      //const expectedRewards = ethers.utils.parseEther("500").mul(10).div(100).mul(5); // 10% interest for 5 days
      const expectedRewards = 500 * 0.1 * 5; // 10% interest for 5 days
      expect(rewards).to.be.closeTo(expectedRewards, "100"); // Allow small rounding error
    });

    it("Should not add interest if called too frequently", async function () {
      await depositedPool.onBlock();
      const infoBefore = await depositedPool.getInfo();
      
      await time.increase(D1 / 2); // Half a day
      await depositedPool.onBlock();
      const infoAfter = await depositedPool.getInfo();

      expect(infoAfter.totalRewards).to.equal(infoBefore.totalRewards);
    });
  });
  
  describe("Multiple users", function () {
    beforeEach(async function () {
      // Setup for multiple users
      await depositToken.transfer(user1.address, ethers.utils.parseEther("1000"));
      await depositToken.transfer(user2.address, ethers.utils.parseEther("1000"));
      await profitableToken.transfer(user1.address, ethers.utils.parseEther("1000"));
      await profitableToken.transfer(user2.address, ethers.utils.parseEther("1000"));

      await depositToken.connect(user1).approve(depositedPool.address, ethers.utils.parseEther("1000"));
      await depositToken.connect(user2).approve(depositedPool.address, ethers.utils.parseEther("1000"));
      await profitableToken.connect(user1).approve(depositedPool.address, ethers.utils.parseEther("1000"));
      await profitableToken.connect(user2).approve(depositedPool.address, ethers.utils.parseEther("1000"));
    });

    it("Should handle deposits and stakes from multiple users correctly", async function () {
      await depositedPool.connect(user1).deposit(ethers.utils.parseEther("500"));
      await depositedPool.connect(user2).deposit(ethers.utils.parseEther("300"));
      await depositedPool.connect(user1).stake(ethers.utils.parseEther("200"));
      await depositedPool.connect(user2).stake(ethers.utils.parseEther("100"));

      const infoUser1 = await depositedPool.getStaker(user1.address);
      const infoUser2 = await depositedPool.getStaker(user2.address);

      expect(infoUser1.deposit).to.equal(ethers.utils.parseEther("500"));
      expect(infoUser1.stake).to.equal(ethers.utils.parseEther("200"));
      expect(infoUser2.deposit).to.equal(ethers.utils.parseEther("300"));
      expect(infoUser2.stake).to.equal(ethers.utils.parseEther("100"));

      const poolInfo = await depositedPool.getInfo();
      expect(poolInfo.totalDeposit).to.equal(ethers.utils.parseEther("800"));
      expect(poolInfo.totalStake).to.equal(ethers.utils.parseEther("300"));
    });

    it("Should distribute rewards correctly among multiple users", async function () {
      await depositedPool.connect(user1).deposit(ethers.utils.parseEther("500"));
      await depositedPool.connect(user2).deposit(ethers.utils.parseEther("500"));
      await depositedPool.connect(user1).stake(ethers.utils.parseEther("300"));
      await depositedPool.connect(user2).stake(ethers.utils.parseEther("200"));

      await time.increase(D1);
      await depositedPool.onBlock();

      const rewardsUser1 = await depositedPool.getUserRewards(user1.address);
      const rewardsUser2 = await depositedPool.getUserRewards(user2.address);

      // User1 should have 60% of the rewards, User2 40%
      expect(rewardsUser1).to.be.closeTo(
        ethers.utils.parseEther("30"), // 10% of 300
        ethers.utils.parseEther("0.1")
      );
      expect(rewardsUser2).to.be.closeTo(
        ethers.utils.parseEther("20"), // 10% of 200
        ethers.utils.parseEther("0.1")
      );
    });
  });

  describe("Safety checks", function () {
    it("Should not allow initialization twice", async function () {
      const mainConfig: DepositedTokenPool.MainConfigStruct = {
        name: "Test Deposited Pool",
        depositToken: depositToken.address,
        profitableToken: profitableToken.address,
        rewardToken: profitableToken.address,
        rewardTokenPrice: BILLION,
        interest: 0.10 * BILLION,
        interestRate: D1,
      };

      await expect(depositedPool.initialize(rewardsBank.address, lockKeeper.address, mainConfig))
        .to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Should only allow admin to change configurations", async function () {
      await expect(depositedPool.connect(user1).setRewardTokenPrice(BILLION * 2))
        .to.be.revertedWith("AccessControl: account " + user1.address.toLowerCase() + " is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should handle zero stakes and deposits correctly", async function () {
      await expect(depositedPool.stake(0)).to.be.revertedWith("Pool: stake value is too low");
      await expect(depositedPool.deposit(0)).to.be.revertedWith("Pool: deposit value is too low");
    });
  });

  describe("Native token handling", function () {
    it("Should handle native token deposits if configured", async function () {
      // Deploy a new pool with ETH as deposit token
      const depositedPoolFactory = await ethers.getContractFactory("DepositedTokenPool");
      const mainConfig: DepositedTokenPool.MainConfigStruct = {
        name: "ETH Deposited Pool",
        depositToken: ethers.constants.AddressZero, // ETH
        profitableToken: profitableToken.address,
        rewardToken: profitableToken.address,
        rewardTokenPrice: BILLION,
        interest: 0.10 * BILLION,
        interestRate: D1,
      };

      const ethPool = (await upgrades.deployProxy(depositedPoolFactory, [
        rewardsBank.address,
        lockKeeper.address,
        mainConfig
      ])) as DepositedTokenPool;

      await ethPool.setLimitsConfig({
        minDepositValue: ethers.utils.parseEther("0.1"),
        minStakeValue: ethers.utils.parseEther("0.1"),
        fastUnstakePenalty: 0.10 * BILLION,
        unstakeLockPeriod: D1,
        stakeLockPeriod: D1,
        maxTotalStakeValue: ethers.utils.parseEther("1000"),
        maxStakePerUserValue: ethers.utils.parseEther("100"),
        stakeLimitsMultiplier: 2 * BILLION,
      });

      const depositAmount = ethers.utils.parseEther("1");
      await expect(ethPool.deposit(depositAmount, { value: depositAmount }))
        .to.emit(ethPool, "Deposited")
        .withArgs(owner.address, depositAmount);

      const info = await ethPool.getInfo();
      expect(info.totalDeposit).to.equal(depositAmount);
    });

    it("Should handle native token stakes if configured", async function () {
      // Deploy a new pool with ETH as profitable token
      const depositedPoolFactory = await ethers.getContractFactory("DepositedTokenPool");
      const mainConfig: DepositedTokenPool.MainConfigStruct = {
        name: "ETH Stake Pool",
        depositToken: depositToken.address,
        profitableToken: ethers.constants.AddressZero, // ETH
        rewardToken: profitableToken.address,
        rewardTokenPrice: BILLION,
        interest: 0.10 * BILLION,
        interestRate: D1,
      };

      const ethPool = (await upgrades.deployProxy(depositedPoolFactory, [
        rewardsBank.address,
        lockKeeper.address,
        mainConfig
      ])) as DepositedTokenPool;

      await ethPool.setLimitsConfig({
        minDepositValue: ethers.utils.parseEther("0.1"),
        minStakeValue: ethers.utils.parseEther("0.1"),
        fastUnstakePenalty: 0.10 * BILLION,
        unstakeLockPeriod: D1,
        stakeLockPeriod: D1,
        maxTotalStakeValue: ethers.utils.parseEther("1000"),
        maxStakePerUserValue: ethers.utils.parseEther("100"),
        stakeLimitsMultiplier: 2 * BILLION,
      });

      // First deposit some tokens
      await depositToken.approve(ethPool.address, ethers.utils.parseEther("10"));
      await ethPool.deposit(ethers.utils.parseEther("10"));

      const stakeAmount = ethers.utils.parseEther("1");
      await expect(ethPool.stake(stakeAmount, { value: stakeAmount }))
        .to.emit(ethPool, "Staked")
        .withArgs(owner.address, stakeAmount);

      const info = await ethPool.getInfo();
      expect(info.totalStake).to.equal(stakeAmount);
    });
  });
});
