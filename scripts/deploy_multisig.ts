import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { Andrii, AndriiTest, DimaTest, Igor, Kevin, Lang, Rory, SharedDev } from "./addresses";
import { deploy } from "../src/dev/deploy";
import { MasterMultisig__factory } from "../typechain-types";

async function main() {
  const { chainId, name: networkName } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  if (networkName == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");

    await deploy<MasterMultisig__factory>(
      ContractNames.MasterMultisig,
      chainId,
      "MasterMultisig",
      [[Lang, Igor, Rory, Kevin, Andrii], [true, true, true, false, false], 51],
      deployer
    );
  } else {
    await deploy<MasterMultisig__factory>(
      ContractNames.MasterMultisig,
      chainId,
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
