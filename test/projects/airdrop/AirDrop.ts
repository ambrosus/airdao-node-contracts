import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AirDrop, AmbBond } from "../../../typechain-types";
import { arrayify, keccak256, solidityPack } from "ethers/lib/utils";

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
    const airDrop = await AirDropFactory.deploy(ambBond.address, owner.address, ethers.utils.parseEther("1000"));

    await ambBond.grantRole(await ambBond.MINTER_ROLE(), owner.address);
    await ambBond.mint(airDrop.address, 50);

    return { ambBond, airDrop, owner, user };
  }

  beforeEach(async function () {
    ({ ambBond, airDrop, owner, user } = await loadFixture(deploy));
  });

  describe("claim", function () {
    it("claim ok", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [10];
      const signature = sign(owner, user.address, categories, amounts);

      await expect(airDrop.connect(user).claim(categories, amounts, signature))
        .to.changeTokenBalance(ambBond, user, 10)
        .to.emit(airDrop, "Claim")
        .withArgs(user.address, categories, amounts);
    });

    it("claim multiple ok", async function () {
      const categories = [hashCategory("staking"), hashCategory("firepot")];
      const amounts = [10, 20];
      const signature = sign(owner, user.address, categories, amounts);

      await expect(airDrop.connect(user).claim(categories, amounts, signature))
        .to.changeTokenBalance(ambBond, user, 30)
        .to.emit(airDrop, "Claim")
        .withArgs(user.address, categories, amounts);
    });

    it("claim wrong sign", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [10];
      const signature = sign(owner, owner.address, categories, amounts); // wrong address

      await expect(airDrop.connect(user).claim(categories, amounts, signature)).to.be.revertedWith("Wrong signature");
    });

    it("claim contract has not enough bonds", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [100];
      const signature = sign(owner, user.address, categories, amounts);

      await expect(airDrop.connect(user).claim(categories, amounts, signature)).to.be.revertedWith("Run out of tokens");
    });

    it("claim user has not enough AMBs ", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [100];
      const signature = sign(owner, user.address, categories, amounts);

      await setBalance(user.address, ethers.utils.parseEther("500"));

      await expect(airDrop.connect(user).claim(categories, amounts, signature)).to.be.revertedWith("Not enough AMB");
    });
  });

  async function sign(signer: SignerWithAddress, userAddress: string, categories: string[], amounts: number[]) {
    const categoriesConcat = categories.reduce((a, i) => solidityPack(["bytes", "bytes32"], [a, i]), "0x");
    const amountsConcat = amounts.reduce((a, i) => solidityPack(["bytes", "uint"], [a, i]), "0x");

    const msg = keccak256(
      solidityPack(
        ["address", "bytes32", "bytes32"],
        [userAddress, arrayify(keccak256(categoriesConcat)), arrayify(keccak256(amountsConcat))]
      )
    );

    return await signer.signMessage(arrayify(msg));
  }
});

function hashCategory(category: string): string {
  return keccak256(ethers.utils.toUtf8Bytes(category));
}
