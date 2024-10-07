import { ethers, upgrades } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RewardsBank,
  AirBond,
  LimitedTokenPool,
  RewardsBank__factory,
  AirBond__factory,
  LockKeeper__factory,
  LockKeeper,
} from "../../../typechain-types";

const D1 = 24 * 60 * 60;
const BILLION = 1_000_000_000;

import { expect } from "chai";

describe("LimitedTokenPool", function () {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let limitedPool : LimitedTokenPool;
  let rewardsBank: RewardsBank;
  let lockKeeper: LockKeeper;
  let limitsMultiplierToken: AirBond;
  let profitableToken: AirBond;


  async function deploy() {
    const [owner, user1, user2] = await ethers.getSigners();

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const limitsMultiplierToken = await new AirBond__factory(owner).deploy(owner.address);
    const profitableToken = await new AirBond__factory(owner).deploy(owner.address);
    const lockKeeper = await new LockKeeper__factory(owner).deploy();

    const limitedPoolFactory = await ethers.getContractFactory("LimitedTokenPool");

    const mainConfig: LimitedTokenPool.MainConfigStruct = {
      name: "Test Deposited Pool",
      limitsMultiplierToken: limitsMultiplierToken.address,
      profitableToken: profitableToken.address,
      rewardToken: profitableToken.address,
    };

    const limitsConfig: LimitedTokenPool.LimitsConfigStruct = {
      rewardTokenPrice: BILLION, // 1:1 ratio
      interest: 0.10 * BILLION, // 10%
      interestRate: D1, // 1 day
      minDepositValue: 10,
      minStakeValue: 10,
      fastUnstakePenalty: 0.10 * BILLION, // 10%
      unstakeLockPeriod: D1, // 1 day
      stakeLockPeriod: D1, // 1 day
      maxTotalStakeValue: ethers.utils.parseEther("1000000"),
      maxStakePerUserValue: ethers.utils.parseEther("100000"),
      stakeLimitsMultiplier: 2 * BILLION, // 2x
    };

    const limitedPool = (await upgrades.deployProxy(limitedPoolFactory, [
      rewardsBank.address,
      lockKeeper.address,
      mainConfig
    ])) as LimitedTokenPool;

    await limitedPool.setLimitsConfig(limitsConfig);

    await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), limitedPool.address);
    await limitsMultiplierToken.grantRole(await limitsMultiplierToken.MINTER_ROLE(), owner.address);
    await profitableToken.grantRole(await profitableToken.MINTER_ROLE(), owner.address);

    // Mint tokens for testing
    const mintAmount = ethers.utils.parseEther("1000000");
    await limitsMultiplierToken.mint(owner.address, mintAmount);
    await profitableToken.mint(owner.address, mintAmount);
    await profitableToken.mint(rewardsBank.address, mintAmount);

    // Approve tokens for testing
    await limitsMultiplierToken.approve(limitedPool.address, mintAmount);
    await profitableToken.approve(limitedPool.address, mintAmount);

    return { owner, user1, user2, limitedPool, rewardsBank, lockKeeper, limitsMultiplierToken, profitableToken};
  }

  beforeEach(async function () {
    ({ owner, user1, user2, limitedPool, rewardsBank, lockKeeper, limitsMultiplierToken, profitableToken } = await loadFixture(deploy));
  });

  describe("Initialization", function () {
    it("Should initialize with correct main config", async function () {
      const config = await limitedPool.mainConfig();
      expect(config.name).to.equal("Test Deposited Pool");
      expect(config.limitsMultiplierToken).to.equal(limitsMultiplierToken.address);
      expect(config.profitableToken).to.equal(profitableToken.address);
      expect(config.rewardToken).to.equal(profitableToken.address);
    });

    it("Should initialize with correct limits config", async function () {
      const limits = await limitedPool.limitsConfig();
      expect(limits.rewardTokenPrice).to.equal(BILLION);
      expect(limits.interest).to.equal(0.10 * BILLION);
      expect(limits.interestRate).to.equal(D1);
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
      await expect(limitedPool.deposit(depositAmount))
        .to.emit(limitedPool, "Deposited")
        .withArgs(owner.address, depositAmount);

      const info = await limitedPool.info();
      expect(info.totalDeposit).to.equal(depositAmount);

      const staker = await limitedPool.getStaker(owner.address);
      expect(staker.deposit).to.equal(depositAmount);
    });

    it("Should not allow deposit below minimum", async function () {
      const depositAmount = 1;
      await expect(limitedPool.deposit(depositAmount)).to.be.revertedWith("Pool: deposit value is too low");
    });
  });

  describe("Withdrawal", function () {
    beforeEach(async function () {
      await limitedPool.deposit(ethers.utils.parseEther("1000"));
    });

    it("Should allow withdrawal", async function () {
      const withdrawAmount = ethers.utils.parseEther("500");
      await expect(limitedPool.withdraw(withdrawAmount))
        .to.emit(limitedPool, "Withdrawn")
        .withArgs(owner.address, withdrawAmount);

      const info = await limitedPool.info();
      expect(info.totalDeposit).to.equal(ethers.utils.parseEther("500"));

      const staker = await limitedPool.getStaker(owner.address);
      expect(staker.deposit).to.equal(ethers.utils.parseEther("500"));
    });

    it("Should not allow withdrawal more than deposited", async function () {
      const withdrawAmount = ethers.utils.parseEther("1001");
      await expect(limitedPool.withdraw(withdrawAmount)).to.be.revertedWith("Not enough deposit");
    });

    it("Should not allow withdrawal that would violate stake limits", async function () {
      await limitedPool.stake(ethers.utils.parseEther("500"));
      await expect(limitedPool.withdraw(ethers.utils.parseEther("751")))
        .to.be.revertedWith("Pool: user max stake value exceeded");
    });
  });

  describe("Stake", function () {
    beforeEach(async function () {
      // Deposit before staking
      await limitedPool.deposit(ethers.utils.parseEther("1000"));
    });

    it("Should allow staking", async function () {
      const stakeAmount = ethers.utils.parseEther("100");
      await limitedPool.stake(stakeAmount);

      const info = await limitedPool.info();
      expect(info.totalStake).to.equal(stakeAmount);

      const staker = await limitedPool.getStaker(owner.address);
      expect(staker.stake).to.equal(stakeAmount);
    });

    it("Should not allow staking below minimum", async function () {
      const stakeAmount = 1;
      await expect(limitedPool.stake(stakeAmount)).to.be.revertedWith("Pool: stake value is too low");
    });

    it("Should not allow staking above user limit", async function () {
      const stakeAmount = ethers.utils.parseEther("2001");
      await expect(limitedPool.stake(stakeAmount)).to.be.revertedWith("Pool: user max stake value exceeded");
    });

    it("Should not allow staking above total pool limit", async function () {
      const limits= await limitedPool.limitsConfig();
      const updatedLimits = {
        ...limits,
        maxTotalStakeValue: ethers.utils.parseEther("100")
      };
      await limitedPool.setLimitsConfig(updatedLimits);
      const stakeAmount = ethers.utils.parseEther("101");
      await expect(limitedPool.stake(stakeAmount)).to.be.revertedWith("Pool: max stake value exceeded");
    });
  });

  describe("Unstake", function () {
    const stakeAmount = ethers.utils.parseEther("100");

    beforeEach(async function () {
      await limitedPool.deposit(ethers.utils.parseEther("1000"));
      await limitedPool.stake(stakeAmount);
      await time.increase(D1);
    });

    it("Should allow unstaking", async function () {
      await expect(limitedPool.unstake(stakeAmount))
        .to.emit(lockKeeper, "Locked");

      const info = await limitedPool.info();
      expect(info.totalStake).to.equal(0);

      const staker = await limitedPool.getStaker(owner.address);
      expect(staker.stake).to.equal(0);
    });

    it("Should not allow unstaking more than staked", async function () {
      await expect(limitedPool.unstake(stakeAmount.add(1))).to.be.revertedWith("Not enough stake");
    });

    it("Should not allow unstaking before stake lock period", async function () {
      const limits = await limitedPool.limitsConfig();
      const updatedLimits = {
        ...limits,
        stakeLockPeriod: ethers.BigNumber.from(D1 * 2)
      };
      await limitedPool.setLimitsConfig(updatedLimits);
      await limitedPool.stake(stakeAmount);
      await time.increase(D1 / 2);
      await expect(limitedPool.unstake(stakeAmount)).to.be.revertedWith("Stake is locked");
    });
  });

  describe("Fast Unstake", function () {
    const stakeAmount = ethers.utils.parseEther("100");

    beforeEach(async function () {
      await limitedPool.deposit(ethers.utils.parseEther("1000"));
      await limitedPool.stake(stakeAmount);
      await time.increase(D1);
    });

    it("Should allow fast unstaking with penalty", async function () {
      const balanceBefore = await profitableToken.balanceOf(owner.address);
      await limitedPool.unstakeFast(stakeAmount);
      const balanceAfter = await profitableToken.balanceOf(owner.address);

      const expectedReturn = stakeAmount.mul(90).div(100); // 90% due to 10% penalty
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedReturn);

      const info = await limitedPool.info();
      expect(info.totalStake).to.equal(0);
    });
  });

  describe("Rewards", function () {
    const stakeAmount = 1000;

    beforeEach(async function () {
      await limitedPool.deposit(ethers.utils.parseEther("2000"));
      await limitedPool.stake(stakeAmount);
    });

    it("Should calculate rewards correctly", async function () {
      await time.increase(D1);
      await limitedPool.onBlock();

      const rewards = await limitedPool.getUserRewards(owner.address);
      const expectedRewards = stakeAmount * 0.1; // 10% interest
      expect(rewards).to.equal(expectedRewards);
    });

    it("Should allow claiming rewards", async function () {
      await time.increase(D1);
      await limitedPool.onBlock();

      const balanceBefore = await profitableToken.balanceOf(owner.address);
      await limitedPool.claim();
      const balanceAfter = await profitableToken.balanceOf(owner.address);

      const expectedRewards = stakeAmount * 0.1; // 10% interest
      expect(balanceAfter.sub(balanceBefore)).to.equal(expectedRewards);
    });
  });

  describe("Edge cases", function () {
    it("Should handle multiple deposits and stakes correctly", async function () {
      const limits  = await limitedPool.limitsConfig();
      const updatedLimits = {
        ...limits,
        stakeLockPeriod: 0,
      };
      await limitedPool.setLimitsConfig(updatedLimits);
      const depositAmount = ethers.utils.parseEther("1000");
      const stakeAmount = ethers.utils.parseEther("500");

      await limitedPool.deposit(depositAmount);
      await limitedPool.stake(stakeAmount);
      await limitedPool.deposit(depositAmount);
      await limitedPool.stake(stakeAmount);

      const info = await limitedPool.info();
      expect(info.totalDeposit).to.equal(depositAmount.mul(2));
      expect(info.totalStake).to.equal(stakeAmount.mul(2));

      const staker = await limitedPool.getStaker(owner.address);
      expect(staker.deposit).to.equal(depositAmount.mul(2));
      expect(staker.stake).to.equal(stakeAmount.mul(2));
    });

    it("Should handle rewards correctly after multiple stakes and unstakes", async function () {
      const limits = await limitedPool.limitsConfig();
      const updatedLimits = {
        ...limits,
        stakeLockPeriod: 0,
      };
      await limitedPool.setLimitsConfig(updatedLimits);
      const depositAmount = ethers.utils.parseEther("2000");
      const stakeAmount = ethers.utils.parseEther("500");

      await limitedPool.deposit(depositAmount);
      await limitedPool.stake(stakeAmount);
      await time.increase(D1 / 2);
      await limitedPool.stake(stakeAmount);
      await time.increase(D1 / 2);
      await limitedPool.unstake(stakeAmount);

      await limitedPool.onBlock();

      const rewards = await limitedPool.getUserRewards(owner.address);
      // Expected rewards calculation is complex due to different staking times
      expect(rewards).to.be.gt(0);
    });

    it("Should not allow actions when pool is deactivated", async function () {
      await limitedPool.deactivate();

      await expect(limitedPool.deposit(ethers.utils.parseEther("100"))).to.be.revertedWith("Pool is not active");
      await expect(limitedPool.stake(ethers.utils.parseEther("100"))).to.be.revertedWith("Pool is not active");
    });
  });


  describe("Interest calculation", function () {
    beforeEach(async function () {
      await limitedPool.deposit(ethers.utils.parseEther("1000"));
      await limitedPool.stake(500);
    });

    it("Should calculate interest correctly over multiple periods", async function () {
      for (let i = 0; i < 5; i++) {
        await time.increase(D1);
        await limitedPool.onBlock();
      }

      const rewards = await limitedPool.getUserRewards(owner.address);
      //const expectedRewards = ethers.utils.parseEther("500").mul(10).div(100).mul(5); // 10% interest for 5 days
      const expectedRewards = 500 * 0.1 * 5; // 10% interest for 5 days
      expect(rewards).to.be.closeTo(expectedRewards, "100"); // Allow small rounding error
    });

    it("Should not add interest if called too frequently", async function () {
      await limitedPool.onBlock();
      const infoBefore = await limitedPool.info();
      
      await time.increase(D1 / 2); // Half a day
      await limitedPool.onBlock();
      const infoAfter = await limitedPool.info();

      expect(infoAfter.totalRewards).to.equal(infoBefore.totalRewards);
    });
  });
  
  describe("Multiple users", function () {
    beforeEach(async function () {
      // Setup for multiple users
      await limitsMultiplierToken.transfer(user1.address, ethers.utils.parseEther("1000"));
      await limitsMultiplierToken.transfer(user2.address, ethers.utils.parseEther("1000"));
      await profitableToken.transfer(user1.address, ethers.utils.parseEther("1000"));
      await profitableToken.transfer(user2.address, ethers.utils.parseEther("1000"));

      await limitsMultiplierToken.connect(user1).approve(limitedPool.address, ethers.utils.parseEther("1000"));
      await limitsMultiplierToken.connect(user2).approve(limitedPool.address, ethers.utils.parseEther("1000"));
      await profitableToken.connect(user1).approve(limitedPool.address, ethers.utils.parseEther("1000"));
      await profitableToken.connect(user2).approve(limitedPool.address, ethers.utils.parseEther("1000"));
    });

    it("Should handle deposits and stakes from multiple users correctly", async function () {
      await limitedPool.connect(user1).deposit(ethers.utils.parseEther("500"));
      await limitedPool.connect(user2).deposit(ethers.utils.parseEther("300"));
      await limitedPool.connect(user1).stake(ethers.utils.parseEther("200"));
      await limitedPool.connect(user2).stake(ethers.utils.parseEther("100"));

      const infoUser1 = await limitedPool.getStaker(user1.address);
      const infoUser2 = await limitedPool.getStaker(user2.address);

      expect(infoUser1.deposit).to.equal(ethers.utils.parseEther("500"));
      expect(infoUser1.stake).to.equal(ethers.utils.parseEther("200"));
      expect(infoUser2.deposit).to.equal(ethers.utils.parseEther("300"));
      expect(infoUser2.stake).to.equal(ethers.utils.parseEther("100"));

      const poolInfo = await limitedPool.info();
      expect(poolInfo.totalDeposit).to.equal(ethers.utils.parseEther("800"));
      expect(poolInfo.totalStake).to.equal(ethers.utils.parseEther("300"));
    });

    it("Should distribute rewards correctly among multiple users", async function () {
      await limitedPool.connect(user1).deposit(ethers.utils.parseEther("500"));
      await limitedPool.connect(user2).deposit(ethers.utils.parseEther("500"));
      await limitedPool.connect(user1).stake(ethers.utils.parseEther("300"));
      await limitedPool.connect(user2).stake(ethers.utils.parseEther("200"));

      await time.increase(D1);
      await limitedPool.onBlock();

      const rewardsUser1 = await limitedPool.getUserRewards(user1.address);
      const rewardsUser2 = await limitedPool.getUserRewards(user2.address);

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
      const mainConfig: LimitedTokenPool.MainConfigStruct = {
        name: "Test Deposited Pool",
        limitsMultiplierToken: limitsMultiplierToken.address,
        profitableToken: profitableToken.address,
        rewardToken: profitableToken.address,
      };

      await expect(limitedPool.initialize(rewardsBank.address, lockKeeper.address, mainConfig))
        .to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Should only allow admin to change configurations", async function () {
      const limits = await limitedPool.limitsConfig();
      const updatedLimits = {
        ...limits,
        rewardTokenPrice: BILLION * 2
      };
      await expect(limitedPool.connect(user1).setLimitsConfig(updatedLimits))
        .to.be.revertedWith("AccessControl: account " + user1.address.toLowerCase() + " is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
    });

    it("Should handle zero stakes and deposits correctly", async function () {
      await expect(limitedPool.stake(0)).to.be.revertedWith("Pool: stake value is too low");
      await expect(limitedPool.deposit(0)).to.be.revertedWith("Pool: deposit value is too low");
    });
  });

  describe("Native token handling", function () {
    it("Should handle native token deposits if configured", async function () {
      // Deploy a new pool with ETH as deposit token
      const limitedPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
      const mainConfig: LimitedTokenPool.MainConfigStruct = {
        name: "ETH Deposited Pool",
        limitsMultiplierToken: ethers.constants.AddressZero, // ETH
        profitableToken: profitableToken.address,
        rewardToken: profitableToken.address,
      };

      const ethPool = (await upgrades.deployProxy(limitedPoolFactory, [
        rewardsBank.address,
        lockKeeper.address,
        mainConfig
      ])) as LimitedTokenPool;

      await ethPool.setLimitsConfig({
        rewardTokenPrice: BILLION,
        interest: 0.10 * BILLION,
        interestRate: D1,
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

      const info = await ethPool.info();
      expect(info.totalDeposit).to.equal(depositAmount);
    });

    it("Should handle native token stakes if configured", async function () {
      // Deploy a new pool with ETH as profitable token
      const limitedPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
      const mainConfig: LimitedTokenPool.MainConfigStruct = {
        name: "ETH Stake Pool",
        limitsMultiplierToken: limitsMultiplierToken.address,
        profitableToken: ethers.constants.AddressZero, // ETH
        rewardToken: profitableToken.address,
      };

      const ethPool = (await upgrades.deployProxy(limitedPoolFactory, [
        rewardsBank.address,
        lockKeeper.address,
        mainConfig
      ])) as LimitedTokenPool;

      await ethPool.setLimitsConfig({
        rewardTokenPrice: BILLION,
        interest: 0.10 * BILLION,
        interestRate: D1,
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
      await limitsMultiplierToken.approve(ethPool.address, ethers.utils.parseEther("10"));
      await ethPool.deposit(ethers.utils.parseEther("10"));

      const stakeAmount = ethers.utils.parseEther("1");
      await ethPool.stake(stakeAmount, { value: stakeAmount });

      const info = await ethPool.info();
      expect(info.totalStake).to.equal(stakeAmount);
    });
  });
});
