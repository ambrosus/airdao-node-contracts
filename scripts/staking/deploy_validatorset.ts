import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { ValidatorSet__factory } from "../../typechain-types";
import { deploy } from "@airdao/deployments/deploying";
import { deployMultisig } from "../utils/deployMultisig";

export async function main() {

  const [deployer] = await ethers.getSigners();

  const multisig = await deployMultisig(ContractNames.ValidatorSetMultisig, deployer, "common");


  const baseReward = ethers.utils.parseEther("14");
  const topStakesCount = 200;

  const rewardsOracleAddress =
    network.name == "main"
      ? "0xCa8Ee7368E4d415361A1A860974A99758dDd5019"
      : "0xb0857e3203f9e392c83f746da9a6a2ddeb6b69af"; //384cbfc4a2218ab4a5ba81e6888073ad97f98f7f7a4ff52f3c6c0eb5407fee6b

  const validatorSet = await deploy<ValidatorSet__factory>({
    contractName: ContractNames.ValidatorSet,
    artifactName: "ValidatorSet",
    deployArgs: [rewardsOracleAddress, baseReward, topStakesCount],
    signer: deployer,
    isUpgradeableProxy: true,
  });


  await (await validatorSet.grantRole(await validatorSet.DEFAULT_ADMIN_ROLE(), multisig.address)).wait();
  await (await validatorSet.grantRole(await validatorSet.REWARD_ORACLE_ROLE(), multisig.address)).wait();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
