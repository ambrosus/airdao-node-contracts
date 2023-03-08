import { AmbErrorProvider } from "../../src/utils/AmbErrorProvider";
import { ethers } from "ethers";
import { expect } from "chai";

const abi = ["function amountToClaim(address) view returns (uint256)", "function claim()"];

it("bank withdraw() not owner ", async function () {
  const provider = new AmbErrorProvider("https://network.ambrosus-test.io/");
  const signer = new ethers.Wallet("34d8e83fca265e9ab5bcc1094fa64e98692375bf8980d066a9edcf4953f0f2f5", provider);
  const contract = new ethers.Contract("0x9EA872c56813eeb4a70cf702CB47797D777CAD95", abi, signer);

  try {
    await contract.amountToClaim("0x9EA872c56813eeb4a70cf702CB47797D777CAD95");
  } catch (e: any) {
    expect((e.error || e).toString(), "view method").to.be.eq("Error: addr not allowed to claim");
  }
  try {
    await contract.claim();
  } catch (e: any) {
    expect((e.error || e).toString(), "non view method").to.be.eq("Error: addr not allowed to claim");
  }
});
