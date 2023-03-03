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

    it("changeSignersMaster add", async function () {
      const calldata = (await masterMultisig.populateTransaction.changeSignersMaster([{
        contract_: multisigs[0].address,
        signersToAdd: [addresses[3]],
        isInitiatorFlags: [true],
        signersToRemove: []
      }])).data!;
      await masterMultisig.submitTransaction(masterMultisig.address, 0, calldata);

      console.log(await multisigs[0].getSigners());
      await masterMultisig.connect(signers[1]).confirmTransaction(0);
      console.log(await multisigs[0].getSigners());
      // todo
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


    it("getTransactionIds", async function () {
      const testMultisigFactory = await ethers.getContractFactory("TEST_MasterMultisig");
      const multisig = await testMultisigFactory.deploy([addresses[0], addresses[1]], [true, true], 100);

      const baseTx = {destination: multisig.address, value: 0, data: "0x00"}
      await multisig.setTransaction(0, {...baseTx, executed: true});
      await multisig.setTransaction(1, {...baseTx, executed: false});
      await multisig.setTransaction(2, {...baseTx, executed: true});
      expect(await multisig.transactionCount()).to.be.eq(3)

      const getIds = async (from: number, to: number, pending: boolean, executed: boolean) =>
        (await multisig.getTransactionIds(from, to, pending, executed)).map(r => +r);

      expect(await getIds(0, 0, false, true), "1").to.be.eql([0, 2])
      expect(await getIds(0, 0, true, true), "2").to.be.eql([0, 1, 2])
      expect(await getIds(0, 0, true, false), "3").to.be.eql([1])

      expect(await getIds(0, 1, true, true), "4").to.be.eql([0])
      expect(await getIds(0, 2, true, true), "5").to.be.eql([0, 1])
      expect(await getIds(0, 3, true, true), "6").to.be.eql([0, 1, 2])

      expect(await getIds(0, 4, true, true), "7").to.be.eql([0, 1, 2])
      expect(await getIds(2, 4, true, true), "8").to.be.eql([2])

      await expect(getIds(5, 4, true, true), "9").to.be.reverted;

    });


  });


});
