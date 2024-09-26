import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { Andrii, AndriiTest, Dev028b, Igor, Kevin, Lang, Rory, Dev1111 } from "../utils/addresses";
import { deploy } from "@airdao/deployments/deploying";
import { MasterMultisig__factory } from "../../typechain-types";

export async function main() {
  const [deployer] = await ethers.getSigners();

  if (network.name == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");

    await deploy<MasterMultisig__factory>({
      contractName: ContractNames.MasterMultisig,
      artifactName: "MasterMultisig",
      deployArgs: [[Lang, Igor, Rory, Kevin, Andrii], [true, true, true, false, false], 51],
      signer: deployer,
    });
  } else {
    await deploy<MasterMultisig__factory>({
      contractName: ContractNames.MasterMultisig,
      artifactName: "MasterMultisig",
      deployArgs: [[Dev1111, Dev028b, AndriiTest], [true, true, true], 51],
      signer: deployer,
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
