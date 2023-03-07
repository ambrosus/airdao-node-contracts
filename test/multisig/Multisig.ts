import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {
  MasterMultisig,
  MasterMultisig__factory,
  Multisig,
  Multisig__factory,
  OnDemandRevert
} from "../../typechain-types";
import {address} from "hardhat/internal/core/config/config-validation";


describe("Multisig", function () {
  let MultisigMasterFactory: MasterMultisig__factory;
  let MultisigFactory: Multisig__factory;

  let multisig: Multisig;
  let onDemandRevert: OnDemandRevert

  let signers: SignerWithAddress[];
  let addresses: string[];

  async function deploy() {
    const OnDemandRevertFactory = await ethers.getContractFactory("OnDemandRevert")
    const onDemandRevert = await OnDemandRevertFactory.deploy();
    const multisig = await MultisigFactory.deploy([addresses[0]], [true], 100, addresses[0])
    return {onDemandRevert, multisig}
  }

  beforeEach(async function () {
    MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");
    MultisigFactory = await ethers.getContractFactory("Multisig");

    signers = await ethers.getSigners();
    addresses = signers.map(s => s.address);

    ({multisig, onDemandRevert} = await loadFixture(deploy));
  });

  // describe("deploy", function () {
  //   it("must be at least 1 initiator", async function () {
  //     await expect(MultisigMasterFactory.deploy([addresses[0], addresses[1]], [false, false], 100))
  //       .to.be.revertedWith("must be at least 1 initiator");
  //   });
  //   it("required signers must be > 0", async function () {
  //     await expect(MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, true], 1))
  //       .to.be.revertedWith("required signers must be > 0");
  //   });
  //   it("threshold must be <= 100", async function () {
  //     await expect(MultisigMasterFactory.deploy([addresses[0], addresses[1]], [true, true], 105))
  //       .to.be.revertedWith("threshold must be <= 100");
  //   });
  // });


  describe("changeSigners", function () {


    it("not owner call should fail", async function () {
      await expect(multisig.connect(signers[1]).changeSigners([addresses[0]], [], []))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("remove signer should work", async function () {
      await multisig.changeSigners([], [addresses[1]], [false]); // firstly add signer
      await multisig.changeSigners([addresses[1]], [], []);
    });

    it("remove not existing signer should fail", async function () {
      await expect(multisig.changeSigners([addresses[1]], [], []))
        .to.be.revertedWith('Not a signer');
    });

    it("remove single signer should fail", async function () {
      await expect(multisig.changeSigners([addresses[0]], [], []))
        .to.be.revertedWith('required signers must be > 0');
    });

    it("remove all initiators should fail", async function () {
      await multisig.changeSigners([], [addresses[1]], [false]); // firstly add signer
      await expect(multisig.changeSigners([addresses[0]], [], []))
        .to.be.revertedWith('must be at least 1 initiator');
    });

    it("change isInitiator = false from single signer should fail", async function () {
      await expect(multisig.changeSigners([], [addresses[0]], [false]))
        .to.be.revertedWith('must be at least 1 initiator');
    });

    it("add same signer with same isInitiator should fail", async function () {
      await expect(multisig.changeSigners([], [addresses[0]], [true]))
        .to.be.revertedWith('Already signer');
    });

    it("add same signer with different isInitiator should change isInitiator", async function () {
      await multisig.changeSigners([], [addresses[1]], [false]);
      expect(await multisig.isInitiator(addresses[1])).to.be.false;
      await multisig.changeSigners([], [addresses[1]], [true]);
      expect(await multisig.isInitiator(addresses[1])).to.be.true;
    });

    it("different signersToAdd and isInitiatorFlags arrays length should fail", async function () {
      await expect(multisig.changeSigners([], [addresses[0]], []))
        .to.be.revertedWith('signersToAdd.length != isInitiatorFlag.length');
    });


  });


  describe("changeThreshold", function () {
    it("not owner call should fail", async function () {
      await expect(multisig.connect(signers[1]).changeThreshold(100))
        .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it("value > 100 should fail", async function () {
      await expect(multisig.changeThreshold(101))
        .to.be.revertedWith('threshold must be <= 100');
    });

    it("all values should work; requiredSigners < 1 should fail", async function () {
      const signersToAdd = addresses.slice(1, 32)
      await multisig.changeSigners([], signersToAdd, signersToAdd.map(() => false));
      const signersCount = (await multisig.getSigners())[0].length;

      for (let i = 0; i <= 100; i++) {
        const requiredSigners = Math.ceil(signersCount * i / 100);
        if (requiredSigners > 0) {
          await expect(multisig.changeThreshold(i), "th-" + i).to.not.be.reverted;
          expect(await multisig.getRequiredSignersCount()).to.be.eq(requiredSigners);
        }
        else await expect(multisig.changeThreshold(i), "th-" + i).to.be.revertedWith('required signers must be > 0');
      }
    });

  });

  describe("submitTransaction", function () {
    let calldata: string;

    beforeEach(async function () {
      await multisig.changeSigners([], [addresses[1]], [false]);
      calldata = (await onDemandRevert.populateTransaction.func(false)).data!;
    });

    it("not initiator submitTransaction call should fail", async function () {
      await expect(multisig.connect(signers[1]).submitTransaction(onDemandRevert.address, 0, calldata)).to.be.revertedWith('Not a initiator');
    });

    it("0x0 destination should fail", async function () {
      await expect(multisig.submitTransaction(ethers.constants.AddressZero, 0, calldata)).to.be.revertedWith("Destination can't be 0x0");
    });

    it("msg.value != value should fail", async function () {
      await expect(multisig.submitTransaction(onDemandRevert.address, 42, calldata, {value: 32})).to.be.revertedWith("msg.value != value");
    });

    it("if two signer, tx must not be executed", async function () {
      await expect(multisig.submitTransaction(onDemandRevert.address, 0, calldata))
        .to.emit(multisig, "Submission")
        .to.not.emit(multisig, "Execution")
    });

    it("if one signer, tx must be executed", async function () {
      await multisig.changeSigners([addresses[1]], [], []);
      await expect(multisig.submitTransaction(onDemandRevert.address, 0, calldata)).to.emit(multisig, "Execution")
    });

    it("getTransactionData non existing tx should fail", async function () {
      await expect(multisig.getTransactionData(0)).to.be.revertedWith("Tx doesn't exists");
    });

    it("getTransactionData should return something", async function () {
      await multisig.submitTransaction(onDemandRevert.address, 42, calldata, {value: 42})

      const [txData, confirmators] = await multisig.getTransactionData(0);
      expect(txData.destination).to.be.eq(onDemandRevert.address);
      expect(txData.value).to.be.eq(42);
      expect(txData.data).to.be.eq(calldata);
      expect(txData.executed).to.be.false;
      expect(confirmators).to.be.eql([addresses[0]])
    });



  });

  describe("confirmations", function () {
    beforeEach(async function () {
      // add more signers (total 6)
      const signersToAdd = addresses.slice(1, 6)
      await multisig.changeSigners([], signersToAdd, signersToAdd.map(() => false));
      await multisig.changeThreshold(50);
      expect((await multisig.getSigners())[0]).to.be.length(6)

      const calldataSuccess = (await onDemandRevert.populateTransaction.func(false)).data!;
      const calldataFail = (await onDemandRevert.populateTransaction.func(true)).data!;
      await multisig.submitTransaction(onDemandRevert.address, 0, calldataSuccess);
      await multisig.submitTransaction(onDemandRevert.address, 0, calldataFail);
    });

    it("not signer confirmTransaction call should fail", async function () {
      await expect(multisig.connect(signers[10]).confirmTransaction(0)).to.be.revertedWith('Not a signer');
    });

    it("confirm not existing tx should fail", async function () {
      await expect(multisig.connect(signers[1]).confirmTransaction(42)).to.be.revertedWith("Tx doesn't exists");
    });

    it("confirm tx twice should fail", async function () {
      await multisig.connect(signers[1]).confirmTransaction(0)
      await expect(multisig.connect(signers[1]).confirmTransaction(0)).to.be.revertedWith('Already confirmed');
    });

    it("confirm already executed should fail", async function () {
      await multisig.connect(signers[1]).confirmTransaction(0)
      await expect(multisig.connect(signers[2]).confirmTransaction(0)).to.emit(multisig, "Execution")

      await expect(multisig.connect(signers[3]).confirmTransaction(0)).to.be.revertedWith('Already executed');
    });

    it("revoke already executed should fail", async function () {
      await multisig.connect(signers[1]).confirmTransaction(0)
      await expect(multisig.connect(signers[2]).confirmTransaction(0)).to.emit(multisig, "Execution")

      await expect(multisig.connect(signers[1]).revokeConfirmation(0)).to.be.revertedWith('Already executed');
    });

    it("revoke not confirmed tx should fail ", async function () {
      await expect(multisig.connect(signers[1]).revokeConfirmation(0)).to.be.revertedWith('Not confirmed');
    });

    it("confirm-revoke-confirm should work", async function () {
      await multisig.connect(signers[1]).confirmTransaction(0)
      expect(await multisig.getConfirmations(0)).to.be.eql([addresses[0], addresses[1]])

      await expect(multisig.connect(signers[1]).revokeConfirmation(0)).to.emit(multisig, "Revocation")
      expect(await multisig.getConfirmations(0)).to.be.eql([addresses[0]])

      await multisig.connect(signers[1]).confirmTransaction(0)
      expect(await multisig.getConfirmations(0)).to.be.eql([addresses[0], addresses[1]])
    });

    it("confirm should work; latest confirm should execute tx ", async function () {
      await expect(multisig.connect(signers[1]).confirmTransaction(0))
        .to.emit(multisig, "Confirmation").withArgs(addresses[1], 0)

      const [txData, confirmators] = await multisig.getTransactionData(0);
      expect(txData.executed).to.be.false;
      expect(confirmators).to.be.eql([addresses[0], addresses[1]])
      expect(await multisig.getConfirmations(0)).to.be.eql([addresses[0], addresses[1]])

      await expect(multisig.connect(signers[2]).confirmTransaction(0))
        .to.emit(multisig, "Confirmation").withArgs(addresses[2], 0)
        .to.emit(multisig, "Execution").withArgs(0)

      const [txData2, confirmators2] = await multisig.getTransactionData(0);
      expect(txData2.executed).to.be.true;
      expect(confirmators2).to.be.eql([addresses[0], addresses[1], addresses[2]])
      expect(await multisig.getConfirmations(0)).to.be.eql([addresses[0], addresses[1], addresses[2]])

    });

    it("revertOnDemand tx should fail on confirm", async function () {
      await multisig.connect(signers[1]).confirmTransaction(1)

      await expect(multisig.connect(signers[2]).confirmTransaction(1)).to.be.revertedWith("Revert!")
    });

  });

  describe("others", function () {

    it("checkBeforeSubmitTransaction", async function () {
      const calldataSuccess = (await onDemandRevert.populateTransaction.func(false)).data!;
      const calldataFail = (await onDemandRevert.populateTransaction.func(true)).data!;

      await expect(multisig.callStatic.checkBeforeSubmitTransaction(onDemandRevert.address, 0, calldataSuccess)).to.be.revertedWith('OK');
      await expect(multisig.callStatic.checkBeforeSubmitTransaction(onDemandRevert.address, 0, calldataFail)).to.be.revertedWith('Revert!');
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
