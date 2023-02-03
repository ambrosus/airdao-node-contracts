import {ethers} from "hardhat";

async function main() {
  const Factory = await ethers.getContractFactory("ValidatorSet");
  const br = await Factory.deploy(
    "0x4c9785451bb2CA3E91B350C06bcB5f974cA33F79",
    [
      "0x4c9785451bb2CA3E91B350C06bcB5f974cA33F79",
      "0x90B2Ce3741188bCFCe25822113e93983ecacfcA0",
      "0xAccdb7a2268BC4Af0a1898e725138888ba1Ca6Fc",
      "0x9b05bd0a0d14f3f288299214739c4fe813e84ed0",
      "0xacab1bd4578cc8b7cd553a31724456f8f7a222b5",
      "0x1665a5a9671f046a73cdb66c0799f5eb407d866c",
      "0xb0c87c931e5883bbe790c187e5b7f809549eb783",
      "0xd567798ffc512d9b38cae81715cade4016e0d9da",
      "0xab6382c343b42a8e5ae825dedfc97ea2609d9de0",
      "0x0a3c14ae043fe5e6f10d00c30b054baf0d49c6fe",
      "0x6973916c00a5f92e5b8205bceccebcc7736b2c0b"

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
