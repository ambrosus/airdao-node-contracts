import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ethers } from "hardhat";
import { ContractNames } from "../../../src";
import { RewardsBank__factory } from "../../../typechain-types";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  const multisig = loadDeployment(ContractNames.Ecosystem_AstradexMultisig, chainId).address;
  
  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: ContractNames.Ecosystem_Astradex_ChronosFeeCollector,
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  await(await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig)).wait();
  await (await rewardsBank.revokeRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();

}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
