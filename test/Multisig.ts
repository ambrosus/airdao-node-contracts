import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {MasterMultisig, Multisig} from "../typechain-types";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";


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
    let multisigs: MasterMultisig[];

    async function deploy() {
      const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
      const MultisigFactory = await ethers.getContractFactory("Multisig");

      const masterMultisig = await MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, true], 100);
      const multisigs = [
        masterMultisig,
        await MultisigFactory.deploy([addresses[2]], [true], 100, masterMultisig.address),
        await MultisigFactory.deploy([addresses[2], addresses[3]], [true, true], 69, masterMultisig.address),
        await MultisigFactory.deploy([addresses[4], addresses[5]], [true, true], 75, masterMultisig.address),
      ];
      return {multisigs};
    }

    beforeEach(async function () {
      ({multisigs} = await loadFixture(deploy));
    });

    it("user groups", async function () {
      const multisigAddresses = multisigs.map(m => m.address)
      const result = await multisigs[0].getAllSigners(multisigAddresses);
      // todo

    });

    it("confirmations", async function () {
      const [masterMultisig, slaveMultisig] = multisigs;
      // change users of slaveMultisig
      const calldata = (await masterMultisig.populateTransaction.changeSignersMaster([{
        contract_: slaveMultisig.address,
        signersToRemove: [],
        signersToAdd: [addresses[0]],
        isInitiatorFlags: [false],
      }])).data!
      await masterMultisig.submitTransaction(masterMultisig.address, 0, calldata)

      const [txData, confirmators] = await masterMultisig.getTransactionData(0);
      // todo

      const oldGroups = [{group: "0x002", isInitiator: true}, {group: "0x001", isInitiator: true}]
      const newGroups = [{group: "0x003", isInitiator: true}, {group: "0x001", isInitiator: true}]
      // doChange(
      //   setUserGroups(user, newGroups, oldGroups),
      // )


    });

  });



});
