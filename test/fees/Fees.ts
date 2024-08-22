import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { Fees } from "../../typechain-types";
import { AddressZero } from "@ethersproject/constants";

describe("Fees", function () {

  async function deploy() {
    const [owner] = await ethers.getSigners();
    const feesFactory = await ethers.getContractFactory("Fees");

    const fees = (await upgrades.deployProxy(feesFactory, [1337, owner.address, 1488])) as Fees;
    return { fees };
  }

  it("should validate percent at deploy", async function () {
    const [owner] = await ethers.getSigners();
    const feesFactory = await ethers.getContractFactory("Fees");
    await expect(upgrades.deployProxy(feesFactory, [1337, owner.address, 1000001])).to.be.reverted;
  });
  describe("setGasPrice", function () {
    it("should work only for admin", async function () {
      const [_, notOwner] = await ethers.getSigners();
      const {fees} = await loadFixture(deploy);
      await expect(fees.connect(notOwner).setGasPrice(228)).to.be.reverted;
    });
    it("should change gas price", async function () {
      const {fees} = await loadFixture(deploy);
      const gasPrice = 228;
      await fees.setGasPrice(gasPrice);
      expect(await fees.getGasPrice()).to.be.eq(gasPrice);
    });
  });
  describe("setFeesParams", function () {

    it("should work only for admin", async function () {
      const [_, notOwner] = await ethers.getSigners();
      const {fees} = await loadFixture(deploy);
      await expect(fees.connect(notOwner).setFeesParams(notOwner.address, 228)).to.be.reverted;
    });
    it("should validate percent", async function () {
      const [_, receiver] = await ethers.getSigners();
      const {fees} = await loadFixture(deploy);
      await expect(fees.setFeesParams(receiver.address, 1000001)).to.be.reverted;
    });
    it("should change fees params", async function () {
      const [_, receiver] = await ethers.getSigners();
      const {fees} = await loadFixture(deploy);
      const percent = 228;

      await fees.setFeesParams(receiver.address, percent);

      const feeParams = await fees.getFeesParams();
      expect(feeParams.addr).to.be.eq(receiver.address);
      expect(feeParams.percent).to.be.eq(percent);
    });

  });

  it("initialize shouldn't decrease my coverage", async () => {
    const {fees} = await loadFixture(deploy);

    await expect(
      fees.initialize(10, AddressZero, 10)
    ).to.be.reverted;
  });

});
