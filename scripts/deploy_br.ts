import {ethers} from "hardhat";

async function main() {

  const BankFactory = await ethers.getContractFactory("AmbBank");
  const BondFactory = await ethers.getContractFactory("AmbBond");

  const bank = await BankFactory.deploy({value: 100000000});
  await bank.deployed()
  const bond = await BondFactory.deploy();
  await bond.deployed()


  const Factory = await ethers.getContractFactory("BlockRewards");
  const br = await Factory.deploy(
    "0x4c9785451bb2CA3E91B350C06bcB5f974cA33F79",
    10,
    "0xfffffffffffffffffffffffffffffffffffffffe",
    bank.address,
    bond.address,
  );

  await br.deployed();

  console.log(`BR deployed to ${br.address}`);

  console.log(await br.addBeneficiary("0x90B2Ce3741188bCFCe25822113e93983ecacfcA0", 42));
  console.log(await br.beneficiaryShare("0x90B2Ce3741188bCFCe25822113e93983ecacfcA0"));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
