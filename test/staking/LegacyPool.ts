import { impersonateAccount, loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { Catalogue__factory, Context__factory, Head, LegacyPool, TEST_ValidatorSet } from "../../typechain-types";

const HERA_POOL = "0x0E051C8C1cd519d918DB9b631Af303aeC85266BF";
const HEAD = "0x0000000000000000000000000000000000000F10";

// check that already deployed hera pool is working with PoolsNodesManager Legacy Adapter

describe("Legacy Pool", function () {
  async function deploy() {
    const [owner] = await ethers.getSigners();
    await setBalance(owner.address, ethers.utils.parseEther("100000000"));

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [
      owner.address,
      owner.address,
      10,
      2,
    ])) as TEST_ValidatorSet;

    const PoolsNodesManagerFactory = await ethers.getContractFactory("LegacyPoolsNodes_Manager");
    const manager = await PoolsNodesManagerFactory.deploy(100, validatorSet.address, 100);

    const head: Head = await ethers.getContractAt("Head", HEAD);
    const headOwnerAddr = await head.owner();
    const headOwner = await ethers.getSigner(headOwnerAddr);
    await impersonateAccount(headOwnerAddr);
    await setBalance(headOwnerAddr, ethers.utils.parseEther("100000000"));

    const catalogue = await new Catalogue__factory(owner).deploy(manager.address);
    const context = await new Context__factory(owner).deploy(catalogue.address);
    await head.connect(headOwner).setContext(context.address);

    const heraPool: LegacyPool = await ethers.getContractAt("LegacyPool", HERA_POOL);

    const heraServiceAddr = ethers.utils.defaultAbiCoder.decode(
      ["address"],
      await heraPool.provider.getStorageAt(heraPool.address, 2)
    )[0];
    const heraService = await ethers.getSigner(heraServiceAddr);
    await impersonateAccount(heraServiceAddr);
    await setBalance(heraServiceAddr, ethers.utils.parseEther("100000000"));

    return { validatorSet, manager, owner, heraPool, heraService };
  }

  it("pool not registered", async function () {
    const { heraPool } = await loadFixture(deploy);
    await expect(heraPool.stake({ value: heraPool.minStakeValue() })).to.be.revertedWith(
      "The message sender is not pool"
    );
  });

  it("stake", async function () {
    const { manager, heraPool } = await loadFixture(deploy);
    await manager.addPool(heraPool.address);

    await expect(heraPool.stake({ value: heraPool.minStakeValue() })).to.emit(manager, "PoolStakeChanged");
  });

  it("stake + onboard request", async function () {
    const { manager, heraPool } = await loadFixture(deploy);
    await manager.addPool(heraPool.address);

    await expect(heraPool.stake({ value: heraPool.nodeStake() }))
      .to.emit(manager, "PoolStakeChanged")
      .emit(manager, "AddNodeRequest");
  });

  it("onboard request + approve request", async function () {
    const { validatorSet, manager, heraPool, heraService } = await loadFixture(deploy);
    await manager.addPool(heraPool.address);

    const receipt = await (await heraPool.stake({ value: heraPool.nodeStake() })).wait();
    const requestEvent = manager.interface.decodeEventLog("AddNodeRequest", receipt.events![2].data);

    const newNodeAddr = (await ethers.getSigners())[5].address;

    await expect(heraPool.connect(heraService).addNode(requestEvent.id, newNodeAddr, requestEvent.nodeId))
      .to.emit(manager, "AddNodeRequestResolved")
      .emit(manager, "NodeOnboarded");

    expect((await validatorSet.getTopStakes()).includes(newNodeAddr));
  });
});
