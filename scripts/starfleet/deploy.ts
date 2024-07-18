import {deploy, loadDeployment} from "@airdao/deployments/deploying";
import {ethers} from "hardhat";
import {RewardsBank__factory, StarfleetStaking, Multisig__factory} from "../typechain-types";
import {ContractNames} from "./names";
import {Roadmap2023MultisigSettings} from "./addresses";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: "StarfleetStaking_Multisig",
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const rewardsBank = await deploy<RewardsBank__factory>({
    contractName: "StarfleetStaking_RewardsBank",
    artifactName: "RewardsBank",
    deployArgs: [],
    signer: deployer,
    isUpgradeableProxy: false,
    loadIfAlreadyDeployed: true,
  });

  await (await rewardsBank.grantRole(await rewardsBank.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();

  const starfleetStaking = await deploy<StarfleetStaking__factory>({
    contractName: "StarfleetStaking",
    artifactName: "StarfleetStaking",
    deployArgs: ["Starfleet staking", multisig.address, rewardsBank.address, 0, 0, 0],
    signer: deployer,
    isUpgradeableProxy: false,
  });

  await (await rewardsBank.grantRole(await starfleetStaking.DEFAULT_ADMIN_ROLE(), starfleetStaking.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
