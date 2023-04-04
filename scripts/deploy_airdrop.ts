import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { SharedDev } from "./addresses";
import { deploy } from "../src/dev/deploy";
import { AirDrop__factory, AmbBond__factory } from "../typechain-types";
import { chainIDToName, loadDeployment } from "../src/utils/deployments";

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const networkName = chainIDToName[chainId];

  const [deployer] = await ethers.getSigners();

  if (networkName == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");

    const BACKEND_ADDRESS = ""; // todo

    const financeInvestorsMultisig = loadDeployment(ContractNames.FinanceInvestorsMultisig, networkName).address;
    const ambBond = await deploy<AmbBond__factory>(
      ContractNames.AmbBond,
      networkName,
      "AmbBond",
      [financeInvestorsMultisig],
      deployer
    );
    await deploy<AirDrop__factory>(
      ContractNames.AirDrop,
      networkName,
      "AirDrop",
      [ambBond.address, BACKEND_ADDRESS],
      deployer
    );
  } else {
    const ambBond = await deploy<AmbBond__factory>(
      ContractNames.AmbBond,
      networkName,
      "AmbBond",
      [deployer.address],
      deployer
    );
    await deploy<AirDrop__factory>(
      ContractNames.AirDrop,
      networkName,
      "AirDrop",
      [ambBond.address, SharedDev],
      deployer
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
