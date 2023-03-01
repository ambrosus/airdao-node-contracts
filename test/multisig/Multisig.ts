import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {MasterMultisig, Multisig} from "../../typechain-types";


describe("Multisig", function () {

  let signers: SignerWithAddress[];
  let addresses: string[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    addresses = signers.map(s => s.address);
  });

  describe("deploy", function () {
    it("must be at least 2 initiators", async function () {
      const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
      await expect(MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, false], 100)).to.be.revertedWith("must be at least 2 initiators");
    });
    it("required signers must be > 0", async function () {
      const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
      await expect(MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, true], 1)).to.be.revertedWith("required signers must be > 0");
    });
    it("threshold must be <= 100", async function () {
      const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
      await expect(MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, true], 105)).to.be.revertedWith("threshold must be <= 100");
    });


  });

  describe("not deploy", function () {
    let masterMultisig: MasterMultisig;
    let multisigs: Multisig[];

    async function deploy() {
      const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
      const MultisigFactory = await ethers.getContractFactory("Multisig");

      const masterMultisig = await MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, true], 100);
      const multisigs = [
        await MultisigFactory.deploy([addresses[2]], [true], 100, masterMultisig.address),
        await MultisigFactory.deploy([addresses[2], addresses[3]], [true, true], 69, masterMultisig.address),
        await MultisigFactory.deploy([addresses[4], addresses[5]], [true, true], 75, masterMultisig.address),
      ];
      return {masterMultisig, multisigs};
    }

    beforeEach(async function () {
      ({masterMultisig, multisigs} = await loadFixture(deploy));
    });

    it("user groups", async function () {
      const multisigAddresses = multisigs.map(m => m.address)
      const result = await masterMultisig.getAllSigners(multisigAddresses);
      // todo

    });

    it("confirmations", async function () {
      // change users of slaveMultisig
      const calldata = (await masterMultisig.populateTransaction.changeSignersMaster([{
        contract_: multisigs[0].address,
        signersToRemove: [],
        signersToAdd: [addresses[0]],
        isInitiatorFlags: [false],
      }])).data!
      await masterMultisig.submitTransaction(masterMultisig.address, 0, calldata)

      const [txData, confirmators] = await masterMultisig.getTransactionData(0);
      // todo



    });

  });



});
