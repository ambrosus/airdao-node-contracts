import { ethers, upgrades } from "hardhat";
import { ContractNames } from "../../../src";
import { loadDeployment } from "@airdao/deployments/deploying";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  console.log("Getting beacon address");
  const limitedTokenPoolManager = loadDeployment(ContractNames.Ecosystem_LimitedTokenPoolsManager, chainId, deployer);
  const beacon = await limitedTokenPoolManager.limitedTokenPoolBeacon();
  console.log("Beacon address:", beacon);

  console.log("Upgrading LimitedTokenPool Beacon");
  const limitedTokenPoolFactory = await ethers.getContractFactory("LimitedTokenPool");
  await upgrades.upgradeBeacon(beacon, limitedTokenPoolFactory);
  limitedTokenPoolFactory.attach(beacon);
  console.log("LimitedTokenPool Beacon upgraded");

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
