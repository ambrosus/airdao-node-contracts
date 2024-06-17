import { loadFixture, setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { AirDrop, AirBond } from "../../../typechain-types";
import { arrayify, keccak256, solidityPack } from "ethers/lib/utils";
import { AddressZero } from "@ethersproject/constants";

describe("AirDrop", function () {
  let airBond: AirBond;
  let airDrop: AirDrop;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  async function deploy() {
    const [owner, user] = await ethers.getSigners();

    const AirBondFactory = await ethers.getContractFactory("AirBond");
    const airBond = await AirBondFactory.deploy(owner.address);

    const AirDropFactory = await ethers.getContractFactory("AirDrop");
    const hotfixClaims = [{user: ethers.constants.AddressZero, category: ethers.constants.HashZero, amount: 10}];
    const airDrop = await AirDropFactory.deploy(airBond.address, owner.address, ethers.utils.parseEther("1000"), hotfixClaims);

    await airBond.grantRole(await airBond.MINTER_ROLE(), owner.address);
    await airBond.mint(airDrop.address, 50);

    return { airBond, airDrop, owner, user };
  }

  beforeEach(async function () {
    ({ airBond, airDrop, owner, user } = await loadFixture(deploy));
  });

  describe("claim", function () {
    it("claim ok", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [10];
      const signature = sign(owner, user.address, categories, amounts);

      await expect(airDrop.connect(user).claim(categories, amounts, signature))
        .to.changeTokenBalance(airBond, user, 10)
        .to.emit(airDrop, "Claim")
        .withArgs(user.address, categories, amounts);
    });

    it("claim multiple ok", async function () {
      const categories = [hashCategory("staking"), hashCategory("firepot")];
      const amounts = [10, 20];
      const signature = sign(owner, user.address, categories, amounts);

      await expect(airDrop.connect(user).claim(categories, amounts, signature))
        .to.changeTokenBalance(airBond, user, 30)
        .to.emit(airDrop, "Claim")
        .withArgs(user.address, categories, amounts);
    });

    it("if categories length is not equal to amount length, should revert", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [100, 200];
      const signature = sign(owner, user.address, categories, amounts);

      await expect(airDrop.connect(user).claim(categories, amounts, signature)).to.be.revertedWith(
        "categories.length != amounts.length"
      );
    });

    it("if user already claimed category, should revert", async function () {
      const categories = [hashCategory("staking")];
      const amounts = [10];
      const signature = sign(owner, user.address, categories, amounts);

      await airDrop.connect(user).claim(categories, amounts, signature);

      await expect(airDrop.connect(user).claim(categories, amounts, signature)).to.be.revertedWith("Already claimed");
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

  describe("getClaimed", function () {
    it("should return the correct claimed amounts for the specified categories", async function () {
      const categories = [hashCategory("staking"), hashCategory("firepot")];
      const amounts = [10, 20];
      const signature = sign(owner, user.address, categories, amounts);

      await airDrop.connect(user).claim(categories, amounts, signature);

      const claimedAmounts = await airDrop.getClaimed(user.address, categories);
      expect(claimedAmounts).to.deep.equal(amounts);
    });
  });

  describe("withdraw", function () {
    it("withdraw ok", async function () {
      await expect(airDrop.withdraw(owner.address, 50)).to.changeTokenBalance(airBond, owner, 50);
    });

    it("withdraw not owner", async function () {
      await expect(airDrop.connect(user).withdraw(owner.address, 50)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("changeBackendAddress", async function () {
    it("should change backend address", async function () {
      const [user] = await ethers.getSigners();
      await airDrop.changeBackendAddress(user.address);

      await expect(await airDrop.backendAddress()).to.be.equal(user.address);
    });

    it("if not owner, should revert", async function () {
      const [_, nonOwner] = await ethers.getSigners();

      await expect(airDrop.connect(nonOwner).changeBackendAddress(user.address)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      expect(await airDrop.backendAddress()).to.equal(owner.address);
    });
  });

  describe("changeMinAmbBalance", async function () {
    it("should change MinAmbBalance", async function () {
      await airDrop.changeMinAmbBalance("100");

      await expect(await airDrop.minAmbBalance()).to.be.equal("100");
    });

    it("if not owner, should revert", async function () {
      const [_, nonOwner] = await ethers.getSigners();

      await expect(airDrop.connect(nonOwner).changeMinAmbBalance("100")).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );

      expect(await airDrop.minAmbBalance()).to.equal("1000000000000000000000");
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
