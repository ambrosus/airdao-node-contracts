import { expect } from "chai";
import { ethers } from "hardhat";
import { Treasury__factory } from "../../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Treasury", function () {
  async function deploy() {
    const [owner] = await ethers.getSigners();
    const treasury = await new Treasury__factory(owner).deploy(owner.address, 0.10 * 10000);
    return {treasury};
  }

  it("should revert on too big fee (deploy)", async function () {
    const [owner] = await ethers.getSigners();
    await expect(new Treasury__factory(owner).deploy(owner.address, 10001)).to.be.revertedWith("fee is too big");
  });

  it("should revert on too big fee (setFee)", async function () {
    const {treasury} = await loadFixture(deploy);
    await expect(treasury.setFee(10001)).to.be.revertedWith("fee is too big");
  });

  it("should revert if called not by admin", async function () {
    const {treasury} = await loadFixture(deploy);
    const [_, notOwner] = await ethers.getSigners();
    await expect(treasury.connect(notOwner).setFee(5000)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should change fee", async function () {
    const {treasury} = await loadFixture(deploy);
    await treasury.setFee(5000);
    expect(await treasury.fee()).to.be.eq(5000);
  });

  it("calc fee", async function () {
    const {treasury} = await loadFixture(deploy);
    // 10% of 10000 is 1000
    expect(await treasury.calcFee(10000)).to.be.eq(1000);
  });



});
