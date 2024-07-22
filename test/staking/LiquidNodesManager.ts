import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { LiquidNodesManager, RewardsBank__factory, TEST_ValidatorSet, Treasury__factory } from "../../typechain-types";
import { expect } from "chai";

const nodeStake = 1000;
const maxNodeCount = 10;

describe("LiquidNodesManager", function () {
  let nodeManager: LiquidNodesManager;
  let validatorSet: TEST_ValidatorSet;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  async function deploy() {
    const [owner, addr1, addr2] = await ethers.getSigners();

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
    await nodeManager.grantRole(await nodeManager.BACKEND_ROLE(), owner.address);
    await rewardsBankPool.grantRole(await rewardsBankNode.DEFAULT_ADMIN_ROLE(), nodeManager.address);
    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), nodeManager.address);


    await setBalance(rewardsBankNode.address, ethers.utils.parseEther("1000"));
    await setBalance(rewardsBankPool.address, ethers.utils.parseEther("1000"));

    return {nodeManager, validatorSet, owner, addr1, addr2};
  }

  beforeEach(async function () {
    ({nodeManager, validatorSet, owner, addr1, addr2} = await loadFixture(deploy));
  });

  describe("Node management", function () {
    it("Should create one request", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake})).to.emit(nodeManager, "AddNodeRequest");
    });

    it("Should onboard one Node", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake})).to.emit(nodeManager, "AddNodeRequest");

      const tx = await nodeManager.connect(owner).onboardNode(1, addr1.address, 0);
      expect(tx).to.emit(nodeManager, "NodeOnboarded");
      expect(tx).to.not.emit(nodeManager, "AddNodeRequest");
      expect(await nodeManager.getNodesCount()).to.equal(1);
      expect(await nodeManager.nodes(0)).to.equal(addr1.address);
      expect(await validatorSet.getNodeStake(addr1.address)).to.equal(nodeStake);
    });

    it("Should onboard two Nodes", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake * 2})).to.emit(nodeManager, "AddNodeRequest");

      const tx1 = await nodeManager.connect(owner).onboardNode(1, addr1.address, 0);
      expect(tx1).to.emit(nodeManager, "NodeOnboarded");
      expect(tx1).to.emit(nodeManager, "AddNodeRequest");
      expect(await nodeManager.getNodesCount()).to.equal(1);
      expect(await nodeManager.nodes(0)).to.equal(addr1.address);
      expect(await nodeManager.getNodeDeposit(addr1.address)).to.equal(nodeStake);
      expect(await validatorSet.getNodeStake(addr1.address)).to.equal(nodeStake);

      const tx2 = await nodeManager.connect(owner).onboardNode(2, addr2.address, 1);
      expect(tx2).to.emit(nodeManager, "NodeOnboarded");
      expect(tx2).to.not.emit(nodeManager, "AddNodeRequest");
      expect(await nodeManager.getNodesCount()).to.equal(2);
      expect(await nodeManager.nodes(1)).to.equal(addr2.address);
      expect(await nodeManager.getNodeDeposit(addr2.address)).to.equal(nodeStake);
      expect(await validatorSet.getNodeStake(addr2.address)).to.equal(nodeStake);
    });

    it("Should fail to onboard node with invalid request", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake})).to.emit(nodeManager, "AddNodeRequest");

      await expect(nodeManager.connect(owner).onboardNode(3, addr1.address, 0)).to.be.revertedWith("Invalid request id");
    });

    it("Should retire node on unstake", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake})).to.emit(nodeManager, "AddNodeRequest");

      expect(await nodeManager.connect(owner).unstake(nodeStake)).to.emit(nodeManager, "NodeRetired");
      expect(await nodeManager.getNodesCount()).to.equal(0);
    });
  });

  describe("Node rewards", function () {
    beforeEach(async function () {
      await nodeManager.stake({value: nodeStake});
    });

    it("ok", async function () {
      await ethers.provider.send("hardhat_setCoinbase", [owner.address]); // call as current block miner
      await validatorSet.process();
    });

    it("not from validatorSet", async function () {
      await expect(nodeManager.reward(owner.address, 50)).to.be.revertedWith("Only validatorSet can call reward()");
    });
  });

  it("report", async function () {
    // do nothing, for coverage
    await nodeManager.report(owner.address);
  });



});
