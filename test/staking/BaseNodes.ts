import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BaseNodes, ValidatorSetTest } from "../../typechain-types";

describe("BaseNodes", function () {
  let validatorSet: ValidatorSetTest;
  let baseNodes: BaseNodes;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const AmbBankFactory = await ethers.getContractFactory("AmbBank");
    const ambBank = await AmbBankFactory.deploy();

    const ValidatorSetFactory = await ethers.getContractFactory("ValidatorSetTest");
    const validatorSet = await ValidatorSetFactory.deploy(owner.address, owner.address, 10, 2);

    // const LockKeeperFactory = await ethers.getContractFactory("LockKeeper");
    // const lockKeeper = await LockKeeperFactory.deploy();

    const BaseNodesFactory = await ethers.getContractFactory("BaseNodes");
    const baseNodes = await BaseNodesFactory.deploy(owner.address, validatorSet.address, ambBank.address);

    await validatorSet.grantRole(await validatorSet.STAKING_POOL_ROLE(), baseNodes.address);

    return { validatorSet, baseNodes, owner };
  }

  beforeEach(async function () {
    ({ validatorSet, baseNodes, owner } = await loadFixture(deploy));
  });

  describe("reward", function () {
    it("reward", async function () {
      await baseNodes.addStake(owner.address, { value: 50 });
      await asSuperUser(validatorSet.reward([owner.address], [1]));
    });
  });

  async function asSuperUser(call: Promise<any>) {
    await ethers.provider.send("hardhat_setCoinbase", ["0x0000000000000000000000000000000000000000"]); // superuser flag
    const res = await call;
    await ethers.provider.send("hardhat_setCoinbase", ["0x1111111111111111111111111111111111111111"]); // disable superuser flag
    return res;
  }
});
