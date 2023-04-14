import { ethers } from "hardhat";
import { ContractNames } from "../src";
import { deploy } from "../src/dev/deploy";
import { AirDrop__factory, AirBond__factory } from "../typechain-types";
import { chainIDToName, loadDeployment } from "../src/utils/deployments";

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const networkName = chainIDToName[chainId];

  const [deployer] = await ethers.getSigners();

  if (networkName == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");

    const BACKEND_ADDRESS = ""; // todo

    const financeInvestorsMultisig = loadDeployment(ContractNames.FinanceInvestorsMultisig, networkName).address;
    const airBond = await deploy<AirBond__factory>(
      ContractNames.AirBond,
      networkName,
      "AmbBond",
      [financeInvestorsMultisig],
      deployer,
      true
    );
    await deploy<AirDrop__factory>(
      ContractNames.AirDrop,
      networkName,
      "AirDrop",
      [airBond.address, BACKEND_ADDRESS, ethers.utils.parseEther("1000")],
      deployer
    );
  } else {
    const airBond = await deploy<AirBond__factory>(
      ContractNames.AirBond,
      networkName,
      "AmbBond",
      [deployer.address],
      deployer,
      true
    );
    const airDrop = await deploy<AirDrop__factory>(
      ContractNames.AirDrop,
      networkName,
      "AirDrop",
      [airBond.address, "0x6cde5C2473DAcc1b80142D3d54ae65Cf97355682", ethers.utils.parseEther("1000")],
      deployer
    );
    await airBond.mint(airDrop.address, ethers.utils.parseEther("10000000000"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
