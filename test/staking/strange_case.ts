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
const MILLION = 1_000_000;

const T = 20000000000;

const nodeStake = ethers.utils.parseEther("500");
const maxNodeCount = 10;

const interest = 0.10 * MILLION; // 10%
const interestPeriod = D1; // 1 day
const minStakeValue = 1;
const lockPeriod = 30 * D1; // 30 days
const penalty = 0.10 * MILLION; // 10%


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

  it("replicate transactions from the network", async function () {
    const [user1, user2, user3, user4, user5, user6, user7, user8] = await ethers.getSigners();
    stakingTiers.setBonus(user1.address, 100);
    stakingTiers.setBonus(user2.address, 100);
    stakingTiers.setBonus(user3.address, 100);
    stakingTiers.setBonus(user4.address, 100);
    stakingTiers.setBonus(user5.address, 100);
    stakingTiers.setBonus(user6.address, 100);
    stakingTiers.setBonus(user7.address, 100);
    stakingTiers.setBonus(user8.address, 100);

    console.log("tx 1, block 125390, stake 15k, user1");
    await liquidPool.connect(user1).stake({value: 15_000});

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 2, block 125468, unstake 800, user1");
    await liquidPool.connect(user1).unstake(800, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 3, block 125518, claim, user1");
    await liquidPool.connect(user1).claimRewards(100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 4, block 125590, stake 35k, user1");
    await liquidPool.connect(user1).stake({value: 35_000});

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 5, block 125709, stake 5m, user2");
    await liquidPool.connect(user2).stake({value: 5_000_000});

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 6, block 126086, unstake 5m, user2");
    await liquidPool.connect(user2).unstake(5000000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 7, block 126125, stake 5m, user2");
    await liquidPool.connect(user2).stake({value: 5_000_000});

    console.log("tx 8, block 126136, unstake 2.2k, user1");
    await liquidPool.connect(user1).unstake(2200, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 9, block 127757, stake 50k, user3");
    await liquidPool.connect(user3).stake({value: 50_000});

    console.log("tx 10, block 127761, stake 100k, user1");
    await liquidPool.connect(user1).stake({value: 100_000});

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 11, block 132682, stake 10k, user3");
    await liquidPool.connect(user3).stake({value: 10_000});
    
    console.log("tx 12, block 132699, stake 1m, user4");
    await liquidPool.connect(user4).stake({value: 1_000_000});

    console.log("tx 13, block 132716, stake 750k, user5");
    await liquidPool.connect(user5).stake({value: 750_000});

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 14, block 132746, unstake 300k, user4");
    await liquidPool.connect(user4).unstake(300000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 15, block 132817, unstake 100k, user5");
    await liquidPool.connect(user5).unstake(100000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 16, block 132845, stake 1k, user5");
    await liquidPool.connect(user5).stake({value: 1_000});

    console.log("tx 17, block 132856, stake 1m, user6");
    await liquidPool.connect(user6).stake({value: 1_000_000});

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 18, block 133322, unstake 50k, user5");
    await liquidPool.connect(user5).unstake(50000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 19, block 133614, unstake 101k, user5");
    await liquidPool.connect(user5).unstake(101000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 20, block 133645, unstake 200k, user4");
    await liquidPool.connect(user4).unstake(200000, 100);

    console.log("tx 21, block 133658, unstake 150k, user6");
    await liquidPool.connect(user6).unstake(150000, 100);

    console.log("tx 22, block 133671, stake 1.3m, user7");
    await liquidPool.connect(user7).stake({value: 1_300_000});

    console.log("tx 23, block 133677, unstake 1k, user7");
    await liquidPool.connect(user7).unstake(1000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 24, block 134848, unstake 1m, user2");
    await liquidPool.connect(user2).unstake(1000000, 100);

    console.log("tx 25, block 134852, unstake 1k, user2");
    await liquidPool.connect(user2).unstake(1000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 26, block 135799, unstake 250k, user4");
    await liquidPool.connect(user4).unstake(250000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 27, block 136818, claim, user5");
    await liquidPool.connect(user5).claimRewards(100);

    console.log("tx 28, block 136837, unstake 1k, user5");
    await liquidPool.connect(user5).unstake(1000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 29, block 137333, stake 1k, user8");
    await liquidPool.connect(user8).stake({value: 1_000});

    console.log("tx 30, block 137341, unstake 1k, user8");
    await liquidPool.connect(user4).unstake(250000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 31, block 140566, unstake 1k, user5");
    await liquidPool.connect(user5).unstake(1000, 100);

    console.log("tx 32, block 140592, unstake 100k, user2");
    await liquidPool.connect(user2).unstake(100000, 100);

    await time.increase(D1);
    await liquidPool.onBlock();

    console.log("tx 33, block 140624, unstake 100k, user2");
    await liquidPool.connect(user2).unstake(100000, 100);

    console.log("tx 34, block 140626, unstake 100k, user2");
    await liquidPool.connect(user2).unstake(100000, 100);

  });

});
