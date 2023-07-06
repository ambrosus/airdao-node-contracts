import { ethers } from "hardhat";
import { ContractNames } from "../src";
// @ts-ignore
import { deploy } from "deployments/dist/deploy.js";
import { AirDrop__factory, AirBond__factory } from "../typechain-types";

async function main() {
  const { chainId, name: networkName } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  if (networkName == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");
    console.log("Deployer: ", deployer.address);

    const BACKEND_ADDRESS = "0x473C539f6a042AEdfECa6A756d15Db2540202270";

    // const financeInvestorsMultisig = loadDeployment(ContractNames.FinanceInvestorsMultisig, networkName).address;
    const airBond = await deploy<AirBond__factory>(
      ContractNames.AirBond,
      chainId,
      "AirBond",
      [deployer.address],
      deployer,
      true
    );
    const airDrop = await deploy<AirDrop__factory>(
      ContractNames.AirDrop,
      chainId,
      "AirDrop",
      [airBond.address, BACKEND_ADDRESS, ethers.utils.parseEther("999"), []],
      deployer,
      true
    );

    await airBond.grantRole(await airBond.DEFAULT_ADMIN_ROLE(), "0x7fadc4729bc1Ff8DAc313cb41e7527Dc6cAB2deb"); // valar
    await airBond.grantRole(await airBond.MINTER_ROLE(), deployer.address);
    await airBond.mint(airDrop.address, ethers.utils.parseEther("5000000"));
    await airDrop.transferOwnership("0x7fadc4729bc1Ff8DAc313cb41e7527Dc6cAB2deb"); // valar
  } else {
    const airBond = await deploy<AirBond__factory>(
      ContractNames.AirBond,
      chainId,
      "AirBond",
      [deployer.address],
      deployer,
      true
    );
    const airDrop = await deploy<AirDrop__factory>(
      ContractNames.AirDrop,
      chainId,
      "AirDrop",
      [airBond.address, "0x6cde5C2473DAcc1b80142D3d54ae65Cf97355682", ethers.utils.parseEther("999"), []],
      deployer
    );
    await airBond.mint(airDrop.address, ethers.utils.parseEther("5000000"));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
