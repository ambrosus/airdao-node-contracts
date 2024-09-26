import { ethers, network } from "hardhat";
import { ContractNames } from "../../../src";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { AirDrop__factory } from "../../../typechain-types";


const BACKEND_ADDRESS_PROD = "0x473C539f6a042AEdfECa6A756d15Db2540202270";


async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  const airBond = loadDeployment(ContractNames.AirBond, chainId, deployer);

  const backendAddress = network.name == "main" ? BACKEND_ADDRESS_PROD : deployer.address;

  const airDrop = await deploy<AirDrop__factory>({
    contractName: ContractNames.AirDrop,
    artifactName: "AirDrop",
    deployArgs: [airBond.address, backendAddress, ethers.utils.parseEther("999"), []],
    signer: deployer,
  });

  await airBond.mint(airDrop.address, ethers.utils.parseEther("5000000"));
  await airDrop.transferOwnership("0x7fadc4729bc1Ff8DAc313cb41e7527Dc6cAB2deb"); // valar

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
