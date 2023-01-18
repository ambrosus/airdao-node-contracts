import {ethers} from "hardhat";

async function main() {
  const brAddr = "0x97161E6D82b8835F8e1A2969Ea766E7eE35F48D9";
  const addrs = [
    "0x4c9785451bb2CA3E91B350C06bcB5f974cA33F79",
    "0x90B2Ce3741188bCFCe25822113e93983ecacfcA0",
    "0xAccdb7a2268BC4Af0a1898e725138888ba1Ca6Fc",
  ]

  const br = await ethers.getContractAt("BlockRewards", brAddr);
  const bond = await ethers.getContractAt("AmbBond", await br.bondContract());
  const bank = await ethers.getContractAt("AmbBank", await br.bankContract());

  console.log((await ethers.provider.getBlock("latest")).number);
  for (const a of addrs) {
    console.log(await ethers.provider.getBalance(a), "AMB")
    console.log(await bond.balanceOf(a), "BOND")
  }

  console.log("bank events")
  console.log(await bank.queryFilter(bank.filters.Rewarded()))

  console.log("bond events")
  console.log(await bond.queryFilter(bond.filters.Transfer()))


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
