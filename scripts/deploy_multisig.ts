import { ethers, network } from "hardhat";
import { ContractNames } from "../src";
import { Andrii, AndriiTest, DimaTest, Igor, Kevin, Lang, Rory, SharedDev } from "./addresses";
// @ts-ignore
import { deploy } from "deployments/dist/deploy.js";
import { MasterMultisig__factory } from "../typechain-types";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  if (network.name == "main") {
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

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
