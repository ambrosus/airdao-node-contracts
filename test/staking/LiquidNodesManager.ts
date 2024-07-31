import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { LiquidNodesManager,
  RewardsBank__factory,
  TEST_ValidatorSet,
  Treasury__factory,
  RewardsBank,
  Treasury
} from "../../typechain-types";
import { expect } from "chai";

const nodeStake = 1000;
const maxNodeCount = 10;

describe("LiquidNodesManager", function () {
  let nodeManager: LiquidNodesManager;
  let validatorSet: TEST_ValidatorSet;
  let rewardsBank: RewardsBank;
  let treasury: Treasury;
  let treasuryFee: Treasury;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let backend: SignerWithAddress;

  async function deploy() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const backend = owner;

    const validatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(
      validatorSetFactory,
      [owner.address, 10, 2])
    ) as TEST_ValidatorSet;

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
    
    const rewardsBank = rewardsBankNode;

    return {
      nodeManager,
      validatorSet,
      rewardsBank,
      treasury,
      treasuryFee,
      owner,
      addr1,
      addr2,
      backend
    };
  }

  beforeEach(async function () {
    (
      {
        nodeManager,
        validatorSet,
        rewardsBank,
        treasury,
        treasuryFee,
        owner,
        addr1,
        addr2,
        backend
      } = await loadFixture(deploy)
    );
  });

  describe("Initialization", function () {
    it("Should initialize with correct values", async function () {
      expect(await nodeManager.validatorSet()).to.equal(validatorSet.address);
      expect(await nodeManager.rewardsBank()).to.equal(rewardsBank.address);
      expect(await nodeManager.treasury()).to.equal(treasury.address);
      expect(await nodeManager.treasuryFee()).to.equal(treasuryFee.address);
      expect(await nodeManager.nodeStake()).to.equal(nodeStake);
      expect(await nodeManager.maxNodesCount()).to.equal(maxNodeCount);
      expect(await nodeManager.getNodesCount()).to.equal(0);
    });
  });

  describe("Role management", function () {
    it("Should grant and revoke roles correctly", async function () {
      const poolRole = await nodeManager.POOL_ROLE();
      await nodeManager.grantRole(poolRole, addr1.address);
      expect(await nodeManager.hasRole(poolRole, addr1.address)).to.be.true;

      await nodeManager.revokeRole(poolRole, addr1.address);
      expect(await nodeManager.hasRole(poolRole, addr1.address)).to.be.false;
    });
  });

  describe("Node management", function () {
    it("Should create one request", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake}))
        .to.emit(nodeManager, "AddNodeRequest")
        .withArgs(1, 0, nodeStake);;
    });

    it("Should onboard one Node", async function () {
      const result1  = await (await nodeManager.connect(owner).stake({value: nodeStake})).wait();
      if(!result1.events?.find((e) => e.event === "AddNodeRequest")) {
        expect.fail("AddNodeRequest event not found");
      }

      const result2 = await(await nodeManager.connect(owner).onboardNode(1, addr1.address, 0)).wait();
      if (!result2.events?.find((e) => e.event === "NodeOnboarded")) {
        expect.fail("NodeOnboarded event not found");
      }
      if (result2.events?.find((e) => e.event === "AddNodeRequest")) {
        expect.fail("AddNodeRequest event found");
      }

      expect(await nodeManager.getNodesCount()).to.equal(1);
      expect(await nodeManager.nodes(0)).to.equal(addr1.address);
      expect(await validatorSet.getNodeStake(addr1.address)).to.equal(nodeStake);
    });

    it("Should onboard two Nodes", async function () {
      const result1  = await (await nodeManager.connect(owner).stake({value: nodeStake * 2})).wait();
      if(!result1.events?.find((e) => e.event === "AddNodeRequest")) {
        expect.fail("AddNodeRequest event not found");
      }

      const result2 = await(await nodeManager.connect(owner).onboardNode(1, addr1.address, 0)).wait();
      if (!result2.events?.find((e) => e.event === "NodeOnboarded")) {
        expect.fail("NodeOnboarded event not found");
      }
      if (!result2.events?.find((e) => e.event === "AddNodeRequest")) {
        expect.fail("AddNodeRequest event not found");
      }
      expect(await nodeManager.getNodesCount()).to.equal(1);
      expect(await nodeManager.nodes(0)).to.equal(addr1.address);
      expect(await nodeManager.getNodeDeposit(addr1.address)).to.equal(nodeStake);
      expect(await validatorSet.getNodeStake(addr1.address)).to.equal(nodeStake);

      const result3 = await (await nodeManager.connect(owner).onboardNode(2, addr2.address, 1)).wait();
      if (!result3.events?.find((e) => e.event === "NodeOnboarded")) {
        expect.fail("NodeOnboarded event not found");
      }
      if (result3.events?.find((e) => e.event === "AddNodeRequest")) {
        expect.fail("AddNodeRequest event found");
      }
      expect(await nodeManager.getNodesCount()).to.equal(2);
      expect(await nodeManager.nodes(1)).to.equal(addr2.address);
      expect(await nodeManager.getNodeDeposit(addr2.address)).to.equal(nodeStake);
      expect(await validatorSet.getNodeStake(addr2.address)).to.equal(nodeStake);
    });

    it("Should fail to onboard node if not backend", async function () {
      await nodeManager.connect(owner).stake({ value: nodeStake });
      await expect(nodeManager.connect(addr1).onboardNode(1, addr1.address, 0)).to.be.reverted;
    });

    it("Should fail to onboard node with invalid request", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake})).to.emit(nodeManager, "AddNodeRequest");

      await expect(nodeManager.connect(owner).onboardNode(3, addr1.address, 0)).to.be.revertedWith("Invalid request id");
    });

    it("Should retire node on unstake", async function () {
      expect(await nodeManager.connect(owner).stake({value: nodeStake})).to.emit(nodeManager, "AddNodeRequest");
      await nodeManager.connect(owner).onboardNode(1, addr1.address, 0);

      expect(await nodeManager.connect(owner).unstake(nodeStake))
        .to.emit(nodeManager, "NodeRetired")
        .withArgs(0, addr1.address, nodeStake);

      expect(await nodeManager.getNodesCount()).to.equal(0);
    });

    it("Should fail to unstake more than available", async function () {
      await nodeManager.connect(owner).stake({ value: nodeStake });
      await expect(nodeManager.connect(owner).unstake(nodeStake * 2)).to.be.reverted;
    });
  });

  describe("Upgrade", function () {
    it("Should allow admin to upgrade", async function () {
      const NewLiquidNodesManager = await ethers.getContractFactory("LiquidNodesManager");
      await expect(upgrades.upgradeProxy(nodeManager.address, NewLiquidNodesManager)).to.not.be.reverted;
    });

    it("Should not allow non-admin to upgrade", async function () {
      const NewLiquidNodesManager = await ethers.getContractFactory("LiquidNodesManager", addr1);
      await expect(upgrades.upgradeProxy(nodeManager.address, NewLiquidNodesManager)).to.be.reverted;
    });
  });

  describe("Miscellaneous", function () {
    it("Should return correct free balance", async function () {
      await nodeManager.connect(owner).stake({ value: nodeStake * 2 });
      await nodeManager.connect(backend).onboardNode(1, addr1.address, 0);
      expect(await nodeManager.getFreeBalance()).to.equal(nodeStake);
    });

    it("Should return correct nodes array", async function () {
      await nodeManager.connect(owner).stake({ value: nodeStake * 2 });
      await nodeManager.connect(backend).onboardNode(1, addr1.address, 0);
      await nodeManager.connect(backend).onboardNode(2, addr2.address, 1);
      const nodes = await nodeManager.getNodes();
      expect(nodes).to.deep.equal([addr1.address, addr2.address]);
    });

    it("Should handle report function", async function () {
      await expect(nodeManager.report(addr1.address)).to.not.be.reverted;
    });
  });

});
