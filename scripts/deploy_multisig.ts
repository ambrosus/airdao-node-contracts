import { ethers } from "hardhat";
import { deploy } from "../src/utils/deployments";
import { ContractNames } from "../src";
import { Andrii, AndriiTest, DimaTest, Igor, Lang, SharedDev } from "./addresses";

async function main() {
  const MultisigMasterFactory = await ethers.getContractFactory("MasterMultisig");

  const networkName = (await ethers.provider.getNetwork()).chainId.toString();

  if (networkName == "16718") {
    console.log("--- MAINNET DEPLOYMENT ---");

    await deploy(ContractNames.MasterMultisig, networkName, MultisigMasterFactory, [
      [Lang, Igor, Andrii],
      [true, true, true],
      51,
    ]);
  } else {
    await deploy(ContractNames.MasterMultisig, networkName, MultisigMasterFactory, [
      [SharedDev, DimaTest, AndriiTest],
      [true, true, true],
      51,
    ]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
