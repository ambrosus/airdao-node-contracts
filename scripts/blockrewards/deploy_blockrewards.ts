import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import { ethers, network } from "hardhat";
import { BlockRewardsMode2__factory, BlockRewardsMode2, Multisig__factory, ValidatorSet } from "../../typechain-types";
import { ContractNames } from "../../src";
import { deployMultisig } from "../utils/deployMultisig";

export async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  const multisig = await deployMultisig(ContractNames.BlockRewardsMode2_Multisig, deployer);

  const blockRewards = await deploy<BlockRewardsMode2__factory>({
    contractName: ContractNames.BlockRewardsMode2,
    artifactName: "BlockRewardsMode2",
    deployArgs: [multisig.address],
    signer: deployer,
    isUpgradeableProxy: false,
  });

  if (network.name != "main") {
    const validatorSet = loadDeployment(ContractNames.ValidatorSet , chainId, deployer) as ValidatorSet;
    await (await validatorSet.setBlockRewardsContract(blockRewards.address)).wait();
  }


}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
