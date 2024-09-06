import { deploy } from "@airdao/deployments/deploying";
import { ethers } from "hardhat";
import { Fees__factory, Finance__factory } from "../../typechain-types";
import { ContractNames } from "../../src";
import { deployMultisig } from "../utils/deployMultisig";

export async function main() {
  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.FeesMultisig, deployer);

  const treasure = await deploy<Finance__factory>({
    contractName: ContractNames.FeesTreasure,
    artifactName: "Finance",
    deployArgs: [multisig.address],
    signer: deployer,
  });

  const gasPrice = 10;
  const payAddress = treasure.address;
  const feePercent = 300000;

  const fees = await deploy<Fees__factory>({
    contractName: ContractNames.Fees,
    artifactName: "Fees",
    deployArgs: [gasPrice, payAddress, feePercent],
    signer: deployer,
    isUpgradeableProxy: true,
  });

  await (await fees.grantRole(await fees.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
