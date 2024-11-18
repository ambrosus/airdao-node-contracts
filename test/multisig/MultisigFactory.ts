import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { MultisigFactory, Multisig } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MultisigFactory", function () {
  let multisigFactory: MultisigFactory;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let ecosystemMaster: SignerWithAddress;
  let commonMaster: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2, ecosystemMaster, commonMaster] = await ethers.getSigners();
    
    const MultisigFactoryFactory = await ethers.getContractFactory("MultisigFactory");
    multisigFactory = await upgrades.deployProxy(
      MultisigFactoryFactory,
      [ecosystemMaster.address, commonMaster.address]
    ) as MultisigFactory;
    
    // Grant CREATOR_ROLE to owner
    const CREATOR_ROLE = await multisigFactory.CREATOR_ROLE();
    await multisigFactory.grantRole(CREATOR_ROLE, owner.address);
  });

  it("should initialize correctly", async function () {
    const CREATOR_ROLE = await multisigFactory.CREATOR_ROLE();
    expect(await multisigFactory.hasRole(CREATOR_ROLE, owner.address)).to.be.true;
  });

  it("should create new multisig", async function () {
    const settings = {
      signers: [owner.address, addr1.address],
      isInitiatorFlags: [true, false],
      threshold: 100,
      owner: owner.address
    };

    const multisigName = "TestMultisig";
    const tx = await multisigFactory.createMultisig(multisigName, settings);
    const receipt = await tx.wait();

    // Check event emission
    const event = receipt.events?.find(e => e.event === "MultisigCreated");
    expect(event).to.not.be.undefined;

    // Verify the multisig was stored
    const multisigAddress = await multisigFactory.getMultisigAddress(multisigName);
    expect(multisigAddress).to.not.equal(ethers.constants.AddressZero);

    // Verify the multisig configuration
    const multisig = await ethers.getContractAt("Multisig", multisigAddress);
    const [signers, flags] = await multisig.getSigners();
    expect(signers).to.deep.equal([owner.address, addr1.address]);
    expect(flags).to.deep.equal([true, false]);
  });

  it("should register existing multisigs", async function () {
    // First create a multisig directly
    const Multisig = await ethers.getContractFactory("Multisig");
    const multisig = await Multisig.deploy(
      [owner.address, addr1.address],
      [true, false],
      100,
      owner.address
    );

    // Register it in the factory
    const multisigName = "ExistingMultisig";
    await multisigFactory.registerMultisigs(
      [multisig.address],
      [multisigName]
    );

    // Verify registration
    expect(await multisigFactory.getMultisigAddress(multisigName))
      .to.equal(multisig.address);
  });

  it("should not allow non-CREATOR_ROLE to create multisigs", async function () {
    const settings = {
      signers: [owner.address, addr1.address],
      isInitiatorFlags: [true, false],
      threshold: 100,
      owner: owner.address
    };

    await expect(
      multisigFactory.connect(addr1).createMultisig("TestMultisig", settings)
    ).to.be.reverted;
  });

  it("should not allow non-CREATOR_ROLE to register multisigs", async function () {
    await expect(
      multisigFactory.connect(addr1).registerMultisigs(
        [ethers.constants.AddressZero],
        ["TestMultisig"]
      )
    ).to.be.reverted;
  });

  it("should not allow registering zero address multisigs", async function () {
    await expect(
      multisigFactory.registerMultisigs(
        [ethers.constants.AddressZero],
        ["TestMultisig"]
      )
    ).to.be.revertedWith("Invalid multisig address");
  });
});
