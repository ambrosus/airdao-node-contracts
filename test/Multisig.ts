import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {BaseNodes, Multisig} from "../typechain-types";
import {expect} from "chai";


describe("Multisig", function () {

  let multisig: Multisig;

  async function deploy() {
    const [owner] = await ethers.getSigners();


    const MultisigFactory = await ethers.getContractFactory("Multisig");
    const multisig = await MultisigFactory.deploy();

    return {multisig, owner};
  }

  beforeEach(async function () {
    ({multisig} = await loadFixture(deploy));
  });

  describe("setUser", function () {
    it("setUser", async function () {
      const users = await ethers.getSigners();

      await multisig.setUser(users[0].address, ["0x00000000000000000000000000000000000000000000000001"], []);
      await multisig.setUser(users[1].address, ["0x00000000000000000000000000000000000000000000000001"], []);
      await multisig.setUser(users[2].address, ["0x00000000000000000000000000000000000000000000000002"], []);
      await multisig.setUser(users[3].address, ["0x00000000000000000000000000000000000000000000000002"], []);

      expect(await multisig.getNeededConfirmsAddresses("0x00000000000000000000000000000000000000000000000001"))
        .to.eql([users[0].address, users[1].address])

    });
  });


});
