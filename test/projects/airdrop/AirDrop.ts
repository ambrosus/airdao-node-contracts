import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AirDrop, AmbBond } from "../../../typechain-types";

describe("AirDrop", function () {
  let ambBond: AmbBond;
  let airDrop: AirDrop;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  async function deploy() {
    const [owner, user] = await ethers.getSigners();

    const AmbBondFactory = await ethers.getContractFactory("AmbBond");
    const ambBond = await AmbBondFactory.deploy(owner.address);

    const AirDropFactory = await ethers.getContractFactory("AirDrop");
    const airDrop = await AirDropFactory.deploy(ambBond.address, owner.address);

    await ambBond.grantRole(await ambBond.MINTER_ROLE(), owner.address);
    await ambBond.mint(airDrop.address, 10);

    return { ambBond, airDrop, owner, user };
  }

  beforeEach(async function () {
    ({ ambBond, airDrop, owner, user } = await loadFixture(deploy));
  });

  describe("claim", function () {
    it("claim ok", async function () {
      const category = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("staking"));
      const amount = 10;
      const signature = sign(owner, user.address, category, amount);

      await expect(airDrop.connect(user).claim(category, amount, signature))
        .to.changeTokenBalance(ambBond, user, amount)
        .to.emit(airDrop, "Claim")
        .withArgs(user.address, category, amount);
    });

    it("claim wrong sign", async function () {
      const category = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("staking"));
      const amount = 10;
      const signature = sign(owner, owner.address, category, 10); // wrong address

      await expect(airDrop.connect(user).claim(category, amount, signature)).to.be.revertedWith("Wrong signature");
    });

    it("claim not enough bonds", async function () {
      const category = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("staking"));
      const amount = 100;
      const signature = sign(owner, user.address, category, 100);

      await expect(airDrop.connect(user).claim(category, amount, signature)).to.be.revertedWith("Run out of tokens");
    });
  });

  async function sign(signer: SignerWithAddress, userAddress: string, category: string, amount: number) {
    const msg = ethers.utils.keccak256(
      ethers.utils.solidityPack(["address", "bytes32", "uint"], [userAddress, category, amount])
    );
    return await signer.signMessage(ethers.utils.arrayify(msg));
  }
});
