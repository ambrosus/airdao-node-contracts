import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { AndriiTest, DimaTest, EcosystemMultisigSettings, SharedDev } from "../addresses";
import { deploy } from "@airdao/deployments/deploying";
import { MasterMultisig__factory } from "../../typechain-types";

export async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploing MasterMultisig for ECOSYSTEM...");
  if (network.name == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");
    await deploy<MasterMultisig__factory>({
      contractName: ContractNames.Ecosystem_MasterMultisig,
      artifactName: "MasterMultisig",
      deployArgs: [...EcosystemMultisigSettings],
      signer: deployer,
    });
  } else {
    await deploy<MasterMultisig__factory>({
      contractName: ContractNames.Ecosystem_MasterMultisig,
      artifactName: "MasterMultisig",
      deployArgs: [[SharedDev, DimaTest, AndriiTest], [true, true, true], 51],
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
