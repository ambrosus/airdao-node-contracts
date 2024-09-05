import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { deploy } from "@airdao/deployments/deploying";
import { AirBond__factory } from "../../typechain-types";

async function main() {
  const [deployer] = await ethers.getSigners();


  const airBond = await deploy<AirBond__factory>({
    contractName: ContractNames.AirBond,
    artifactName: "AirBond",
    deployArgs: [deployer.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });
  await airBond.grantRole(await airBond.DEFAULT_ADMIN_ROLE(), "0x7fadc4729bc1Ff8DAc313cb41e7527Dc6cAB2deb"); // valar
  await airBond.grantRole(await airBond.MINTER_ROLE(), deployer.address);


}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
