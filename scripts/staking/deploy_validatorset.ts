import { ethers, network } from "hardhat";
import { ContractNames } from "../../src";
import { Multisig__factory, ValidatorSet__factory } from "../../typechain-types";
import { deploy, loadDeployment } from "@airdao/deployments/deploying";
import {Roadmap2023MultisigSettings} from "../addresses";

export async function main() {
  let { chainId } = await ethers.provider.getNetwork();
  if (process.env.MULTISIGS && process.env.MULTISIGS !== "v1") {
    chainId = (chainId.toString() + `_${process.env.MULTISIGS}`) as any;
  }

  const [deployer] = await ethers.getSigners();
  const masterMultisig = loadDeployment(ContractNames.MasterMultisig, chainId).address;

  const multisig = await deploy<Multisig__factory>({
    contractName: ContractNames.ValidatorSetMultisig,
    networkId: chainId,
    artifactName: "Multisig",
    deployArgs: [...Roadmap2023MultisigSettings, masterMultisig],
    signer: deployer,
    loadIfAlreadyDeployed: true,
  });

  const baseReward = ethers.utils.parseEther("14");
  const topStakesCount = 200;

  const rewardsOracleAddress =
    network.name == "main"
      ? "0xCa8Ee7368E4d415361A1A860974A99758dDd5019"
      : "0xb0857e3203f9e392c83f746da9a6a2ddeb6b69af"; //384cbfc4a2218ab4a5ba81e6888073ad97f98f7f7a4ff52f3c6c0eb5407fee6b

  const validatorSet = await deploy<ValidatorSet__factory>({
    contractName: ContractNames.ValidatorSet,
    networkId: chainId,
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
