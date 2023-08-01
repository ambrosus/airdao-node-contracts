import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AirBond, AirBond__factory, RewardsBank, RewardsBank__factory } from "../../typechain-types";

describe("RewardsBank", function () {
  let rewardsBank: RewardsBank;
  let airBond: AirBond;
  let owner: SignerWithAddress;

  async function deploy() {
    const [owner] = await ethers.getSigners();

    const airBond = await new AirBond__factory(owner).deploy(owner.address);
    const rewardsBank = await new RewardsBank__factory(owner).deploy(airBond.address);

    await airBond.grantRole(await airBond.MINTER_ROLE(), owner.address);

    return { rewardsBank, airBond, owner };
  }

  beforeEach(async function () {
    ({ rewardsBank, airBond, owner } = await loadFixture(deploy));
  });

  describe("withdraw", function () {
    beforeEach(async function () {
      await airBond.mint(rewardsBank.address, 10000);
      await owner.sendTransaction({ to: rewardsBank.address, value: 10000 });
    });

    it("withdrawAmb", async function () {
      await expect(rewardsBank.withdrawAmb(owner.address, 1000)).to.changeEtherBalance(owner, 1000);
    });
    it("withdrawBonds", async function () {
      await expect(rewardsBank.withdrawBonds(owner.address, 1000)).to.changeTokenBalance(airBond, owner, 1000);
    });

    it("withdrawAmb not admin", async function () {
      const [_, notAdmin] = await ethers.getSigners();
      await expect(rewardsBank.connect(notAdmin).withdrawAmb(owner.address, 1000)).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    });
    it("withdrawBonds not admin", async function () {
      const [_, notAdmin] = await ethers.getSigners();
      await expect(rewardsBank.connect(notAdmin).withdrawBonds(owner.address, 1000)).to.be.revertedWith(
        `AccessControl: account ${notAdmin.address.toLowerCase()} is missing role 0x0000000000000000000000000000000000000000000000000000000000000000`
      );
    });
  });
});
