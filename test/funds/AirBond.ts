import { expect } from "chai";
import { ethers } from "hardhat";
import { AirBond } from "../../typechain-types";

describe("AirBond", function () {
  let AirBond, airBond: AirBond, admin, minter: any, account1: any;

  beforeEach(async function () {
    AirBond = await ethers.getContractFactory("AirBond");
    [admin, minter, account1] = await ethers.getSigners();
    airBond = await AirBond.deploy(admin.address);
    await airBond.grantRole(ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MINTER_ROLE")), minter.address);
  });

  it("should mint tokens correctly", async function () {
    await airBond.connect(minter).mint(account1.address, ethers.utils.parseEther("1000"));
    expect(await airBond.balanceOf(account1.address)).to.equal(ethers.utils.parseEther("1000"));
  });

  it("should not allow non-minters to mint tokens", async function () {
    await expect(airBond.connect(account1).mint(account1.address, ethers.utils.parseEther("1000"))).to.be.reverted;
  });

  it("should burn tokens correctly", async function () {
    await airBond.connect(minter).mint(account1.address, ethers.utils.parseEther("1000"));
    await airBond.connect(minter).burn(account1.address, ethers.utils.parseEther("1000"));
    expect(await airBond.balanceOf(account1.address)).to.equal(0);
  });

  it("should not allow non-minters to burn tokens", async function () {
    await airBond.connect(minter).mint(account1.address, ethers.utils.parseEther("1000"));
    await expect(airBond.connect(account1).burn(account1.address, ethers.utils.parseEther("1000"))).to.be.reverted;
  });
});
