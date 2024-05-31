import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { Andrii, AndriiTest, DimaTest, Igor, Kevin, Lang, Rory, SharedDev } from "../addresses";
import { deploy } from "@airdao/deployments/deploying";
import { MasterMultisig__factory } from "../../typechain-types";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
    chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  }
  const [deployer] = await ethers.getSigners();

  if (network.name == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");

    await deploy<MasterMultisig__factory>({
      contractName: ContractNames.MasterMultisig,
      networkId: chainId,
      artifactName: "MasterMultisig",
      deployArgs: [[Lang, Igor, Rory, Kevin, Andrii], [true, true, true, false, false], 51],
      signer: deployer,
    });
  } else {
    await deploy<MasterMultisig__factory>({
      contractName: ContractNames.MasterMultisig,
      networkId: chainId,
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
