import {ethers} from "hardhat";

async function main() {
  const Factory = await ethers.getContractFactory("ValidatorSet");
  const br = await Factory.deploy(
    "0x4c9785451bb2CA3E91B350C06bcB5f974cA33F79",
    [
      "0x4c9785451bb2CA3E91B350C06bcB5f974cA33F79",
      "0x90B2Ce3741188bCFCe25822113e93983ecacfcA0",
      "0xAccdb7a2268BC4Af0a1898e725138888ba1Ca6Fc",
    ],
    "0xfffffffffffffffffffffffffffffffffffffffe",
  );

  await br.deployed();

  console.log(`VS deployed to ${br.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
