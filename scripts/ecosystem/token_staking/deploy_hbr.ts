import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { deploy } from "@airdao/deployments/deploying";
import { HBRToken__factory } from "../../../typechain-types";
import { deployMultisig } from "../../utils/deployMultisig";

async function main() {
  const {chainId} = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();

  if (chainId == 16718) {
    return;
  }

  const airBond = await deploy<HBRToken__factory>({
    contractName: ContractNames.Ecosystem_HBRToken,
    artifactName: "HBRToken",
    deployArgs: [deployer.address],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  if (chainId != 16718) {
    console.log("Granting roles to deployer (dev and test envs only)");
    await (await airBond.grantRole(await airBond.DEFAULT_ADMIN_ROLE(), deployer.address)).wait(); // 
    await (await airBond.grantRole(await airBond.MINTER_ROLE(), deployer.address)).wait();
  } else {
    console.log("Granting roles to multisig (mainnet only)");
    const multisig = await deployMultisig(ContractNames.Ecosystem_LimitedTokenPoolsManagerMultisig, deployer);
    await (await airBond.grantRole(await airBond.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
    await (await airBond.grantRole(await airBond.MINTER_ROLE(), multisig.address)).wait();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
