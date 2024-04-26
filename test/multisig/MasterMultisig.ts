import { expect } from "chai";
import { ethers } from "hardhat";
import { MasterMultisig } from "../../typechain-types";
import { Contract, PopulatedTransaction } from "ethers";

describe("MasterMultisig", function () {
  let MasterMultisig, masterMultisig: MasterMultisig, owner: any, addr1: any, addr2: any, ownerAddress: string;

  beforeEach(async function () {
    MasterMultisig = await ethers.getContractFactory("MasterMultisig");
    [owner, addr1, addr2] = await ethers.getSigners();
    masterMultisig = await MasterMultisig.deploy([owner.address, addr1.address], [true, false], 100);

    ownerAddress = await masterMultisig.owner(); //
  });

  it("should initialize correctly", async function () {
    expect(await masterMultisig.getSigners()).to.deep.equal([
      [owner.address, addr1.address],
      [true, false],
    ]);
  });

  it("should set the correct owner", async function () {
    expect(await masterMultisig.owner()).to.equal(ownerAddress);
  });

  it("retrieves all signers correctly", async function () {
    const multisigs = [masterMultisig.address];
    const result = await masterMultisig.getAllSigners(multisigs);
    expect(result[0].signers).to.deep.equal([owner.address, addr1.address]);
    expect(result[0].isInitiatorFlags).to.deep.equal([true, false]);
    expect(result[0].threshold).to.equal(100);
  });

  it("returns empty array for no multisigs", async function () {
    const result = await masterMultisig.getAllSigners([]);
    expect(result).to.deep.equal([]);
  });

  it("should change signers correctly", async function () {
    const calldata = masterMultisig.populateTransaction.changeSignersMaster([
      {
        contract_: masterMultisig.address,
        signersToRemove: [addr1.address],
        signersToAdd: [addr2.address],
        isInitiatorFlags: [false],
      },
    ]);

    await submitMultisigTx(masterMultisig, masterMultisig, calldata, [owner, addr1]);
    expect(await masterMultisig.getSigners()).to.deep.equal([
      [owner.address, addr2.address],
      [true, false],
    ]);
  });

  it("should not allow non-owners to change signers", async function () {
    await expect(
      masterMultisig.connect(addr1).changeSignersMaster([
        {
          contract_: masterMultisig.address,
          signersToRemove: [addr1.address],
          signersToAdd: [addr2.address],
          isInitiatorFlags: [false],
        },
      ])
    ).to.be.reverted;
  });

  it("should change owners correctly", async function () {
    const calldata = masterMultisig.populateTransaction.changeOwners([masterMultisig.address], addr1.address);
    await submitMultisigTx(masterMultisig, masterMultisig, calldata, [owner, addr1]);
    expect(await masterMultisig.owner()).to.equal(addr1.address);
  });

  it("should not allow non-owners to change owners", async function () {
    await expect(masterMultisig.connect(addr1).changeOwners([masterMultisig.address], addr1.address)).to.be.reverted;
  });
});

async function submitMultisigTx(
  multisig: Contract,
  targetContract: Contract,
  populateTransactionPromise: Promise<PopulatedTransaction>,
  signers: any[] = []
) {
  const calldata = (await populateTransactionPromise).data!;
  const receipt = await (
    await multisig.connect(signers[0]).submitTransaction(targetContract.address, 0, calldata)
  ).wait();

  const submissionEvent = receipt.events?.find((e: any) => e.event === "Submission");
  if (!submissionEvent || !submissionEvent.args) throw new Error("Submission event not found");
  const txId = submissionEvent.args[0];

  await (await multisig.connect(signers[1]).confirmTransaction(txId, { gasLimit: 1000000 })).wait();
}
