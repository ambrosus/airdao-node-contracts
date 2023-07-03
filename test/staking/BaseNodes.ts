import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers, upgrades } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BaseNodes_Manager, TEST_ValidatorSet } from "../../typechain-types";

describe("BaseNodes", function () {
  let validatorSet: TEST_ValidatorSet;
  let baseNodes: BaseNodes_Manager;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = (await upgrades.deployProxy(ValidatorSetFactory, [
      owner.address,
      owner.address,
      10,
      2,
    ])) as TEST_ValidatorSet;

    const BaseNodesFactory = await ethers.getContractFactory("BaseNodes_Manager");
    const baseNodes = await BaseNodesFactory.deploy(owner.address, validatorSet.address);

    await validatorSet.grantRole(await validatorSet.STAKING_MANAGER_ROLE(), baseNodes.address);

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
