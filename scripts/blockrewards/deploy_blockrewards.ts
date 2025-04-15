import {deploy, loadDeployment} from "@airdao/deployments/deploying";
import {ethers} from "hardhat";
import {RewardsBank__factory, StarfleetStaking, Multisig__factory} from "../../typechain-types";
import { ContractNames } from "../../src";
import { deployMultisig } from "../utils/deployMultisig";

export async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.BlockRewardsMode2_Multisig, deployer);

  const blockRewards = await deploy<BlockRewardsMode2__factory>({
    contractName: ContractNames.BlockRewardsMode2,
    artifactName: "BlockRewardsMode2",
    deployArgs: [multisig.address],
    signer: deployer,
    isUpgradeableProxy: false,
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
