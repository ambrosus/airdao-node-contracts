import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { LiquidNodesManager, RewardsBank__factory, TEST_ValidatorSet, Treasury__factory } from "../../typechain-types";
import { expect } from "chai";

const nodeStake = 1000;
const maxNodeCount = 10;



describe("LiquidNodesManager", function () {
  let nodeManager: LiquidNodesManager;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  async function deploy() {
    const [owner, addr1] = await ethers.getSigners();

    const validatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(validatorSetFactory, [owner.address, 10, 2])) as TEST_ValidatorSet;

    const rewardsBankNode = await new RewardsBank__factory(owner).deploy();
    const rewardsBankPool = await new RewardsBank__factory(owner).deploy();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0);
    const treasuryFee = await new Treasury__factory(owner).deploy(owner.address, 0.1 * 10000);


    const nodeManagerFactory = await ethers.getContractFactory("LiquidNodesManager");
    const nodeManager = (await upgrades.deployProxy(nodeManagerFactory, [
      validatorSet.address,
      rewardsBankNode.address,
      treasury.address,
      treasuryFee.address,
      nodeStake,
      maxNodeCount,
    ])) as LiquidNodesManager;


    await nodeManager.setLiquidPool(owner.address);

    await rewardsBankPool.grantRole(await rewardsBankNode.DEFAULT_ADMIN_ROLE(), nodeManager.address);
    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), nodeManager.address);


    await setBalance(rewardsBankNode.address, ethers.utils.parseEther("1000"));
    await setBalance(rewardsBankPool.address, ethers.utils.parseEther("1000"));

    return {nodeManager, owner, addr1};
  }

  beforeEach(async function () {
    ({nodeManager, owner, addr1} = await loadFixture(deploy));
  });

  describe("stake", function () {
    it("should work", async function () {
      expect(await nodeManager.getFreeBalance()).to.be.equal(0);
      await nodeManager.stake({value: 100});
      expect(await nodeManager.getFreeBalance()).to.be.equal(100);

      await expect(nodeManager.stake({value: 900}))
        .to.emit(nodeManager, "AddNodeRequest").withArgs(1, 1, 1000);

      expect(await nodeManager.getFreeBalance()).to.be.equal(0);
    });

    it("should revert if call not by pool", async function () {
      await expect(nodeManager.connect(addr1).stake({value: 900})).to.be.revertedWith("LiquidNodesManager: caller is not a pool");
    });

  });



});
