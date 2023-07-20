import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { deploy } from "deployments";
import { AirBond__factory, AirDrop__factory } from "../../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();

  if (network.name == "main") {
    console.log("--- MAINNET DEPLOYMENT ---");
    console.log("Deployer: ", deployer.address);

    const BACKEND_ADDRESS = "0x473C539f6a042AEdfECa6A756d15Db2540202270";

    // const financeInvestorsMultisig = loadDeployment(ContractNames.FinanceInvestorsMultisig, networkName).address;
    const airBond = await deploy<AirBond__factory>({
      contractName: ContractNames.AirBond,
      artifactName: "AirBond",
      deployArgs: [deployer.address],
      signer: deployer,
      loadIfAlreadyDeployed: true,
    });
    const airDrop = await deploy<AirDrop__factory>({
      contractName: ContractNames.AirDrop,
      artifactName: "AirDrop",
      deployArgs: [airBond.address, BACKEND_ADDRESS, ethers.utils.parseEther("999"), []],
      signer: deployer,
      loadIfAlreadyDeployed: true,
    });

    await airBond.grantRole(await airBond.DEFAULT_ADMIN_ROLE(), "0x7fadc4729bc1Ff8DAc313cb41e7527Dc6cAB2deb"); // valar
    await airBond.grantRole(await airBond.MINTER_ROLE(), deployer.address);
    await airBond.mint(airDrop.address, ethers.utils.parseEther("5000000"));
    await airDrop.transferOwnership("0x7fadc4729bc1Ff8DAc313cb41e7527Dc6cAB2deb"); // valar
  } else {
    const airBond = await deploy<AirBond__factory>({
      contractName: ContractNames.AirBond,
      artifactName: "AirBond",
      deployArgs: [deployer.address],
      signer: deployer,
      loadIfAlreadyDeployed: true,
    });
    const airDrop = await deploy<AirDrop__factory>({
      contractName: ContractNames.AirDrop,
      artifactName: "AirDrop",
      deployArgs: [airBond.address, "0x6cde5C2473DAcc1b80142D3d54ae65Cf97355682", ethers.utils.parseEther("999"), []],
      signer: deployer,
    });
    await airBond.mint(airDrop.address, ethers.utils.parseEther("5000000"));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
