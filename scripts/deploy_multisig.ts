import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { Andrii, AndriiTest, DimaTest, Igor, Kevin, Lang, Rory, SharedDev } from "./addresses";
import { deploy } from "../src/dev/deploy";
import { MasterMultisig__factory } from "../typechain-types";

async function main() {
  const networkName = ethers.provider.network.name;
  const [deployer] = await ethers.getSigners();

  if (networkName == "16718") {
    console.log("--- MAINNET DEPLOYMENT ---");

    await deploy<MasterMultisig__factory>(
      ContractNames.MasterMultisig,
      networkName,
      "MasterMultisig",
      [[Lang, Igor, Rory, Kevin, Andrii], [true, true, true, false, false], 51],
      deployer
    );
  } else {
    await deploy<MasterMultisig__factory>(
      ContractNames.MasterMultisig,
      networkName,
      "MasterMultisig",
      [[SharedDev, DimaTest, AndriiTest], [true, true, true], 51],
      deployer
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
