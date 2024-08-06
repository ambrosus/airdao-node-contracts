import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ethers } from "hardhat";
import { EcosystemMultisigSettings } from "../../addresses";
import { ContractNames } from "../../../src";
import { Multisig__factory, RewardsBank__factory } from "../../../typechain-types";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  if (chainId !== 16718)
    return;

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.Ecosystem_MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.Ecosystem_AstradexTokenSafeMultisig,
    artifactName: "Multisig",
    deployArgs: [...EcosystemMultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

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
