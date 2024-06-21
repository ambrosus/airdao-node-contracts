import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  LiquidPool,
  LiquidPool__factory,
  RewardsBank__factory,
  Treasury__factory,
  StAMB__factory,
  TEST_ValidatorSet
} from "../../typechain-types";
import { expect } from "chai";

describe("LiquidPool", function () {
  let validatorSet: TEST_ValidatorSet;
  let liquidPool: LiquidPool;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const validatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(validatorSetFactory, [owner.address])) as TEST_ValidatorSet;

    const rewardsBank = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);
    const stAMB = await new StAMB__factory(owner).deploy();

    const interest = 100000;
    const nodeStake = 5000000;
    const minStakeValue = 10000;
    const maxNodeCount = 10;

    const liquidPool = await new LiquidPool__factory(owner).deploy(
      validatorSet.address,
      rewardsBank.address,
      treasury.address,
      stAMB.address,
      interest,
      nodeStake,
      minStakeValue,
      maxNodeCount
    );

    return { validatorSet, liquidPool, owner };

  }

  beforeEach(async function () {
    ({ validatorSet, liquidPool, owner } = await loadFixture(deploy));
  });

  //TODO: describe add stake 
  //TODO: describe remove stake 
  //TODO: reward???
  //TODO: increase stake???

});
