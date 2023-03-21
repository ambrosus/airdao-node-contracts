import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {PoolsNodesManager, TEST_ValidatorSet} from "../../typechain-types";

describe("BaseNodes", function () {
  let validatorSet: TEST_ValidatorSet;
  let manager: PoolsNodesManager;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const ValidatorSetFactory = await ethers.getContractFactory("TEST_ValidatorSet");
    const validatorSet = await ValidatorSetFactory.deploy(owner.address, owner.address, 10, 2);

    const PoolsNodesManagerFactory = await ethers.getContractFactory("PoolsNodesManager");
    const manager = await PoolsNodesManagerFactory.deploy(100);

    return { validatorSet, manager, owner };
  }

  beforeEach(async function () {
    ({ validatorSet, baseNodes, owner } = await loadFixture(deploy));
  });




});
