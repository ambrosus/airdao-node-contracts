import { ethers } from "hardhat";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ContractNames } from "../../src";
import { Multisig__factory, Treasury__factory } from "../../typechain-types";
import {Roadmap2023MultisigSettings} from "../addresses";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
    chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  }

  const [deployer] = await ethers.getSigners();

  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.TreasuryMultisig,
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await deploy<Treasury__factory>({
    contractName: ContractNames.Treasury,
    networkId: chainId,
    artifactName: "Treasury",
    signer: deployer,
    deployArgs: [
      multisig.address,
      0 // turn off for now
      // 0.1 * 10000, // 10% fee
    ],
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
