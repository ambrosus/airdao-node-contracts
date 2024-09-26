import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { AndriiTest, Dev028b, EcosystemMultisigSettings, Dev1111 } from "../utils/addresses";
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
