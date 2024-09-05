import { deploy } from "@airdao/deployments/deploying";
import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { RewardsBank__factory } from "../../../typechain-types";
import { deployMultisig } from "../../utils/deployMultisig";

export async function main() {
  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.Ecosystem_AstradexTokenSafeMultisig, deployer, "common");

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_AstradexTokenSafe,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await rewardsBank.revokeRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
