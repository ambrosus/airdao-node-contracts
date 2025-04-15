// add BlockRewardsMode2 to validator set contract

import { ethers } from "hardhat";
import { ContractNames } from "../../src";
import { loadDeployment, upgrade } from "@airdao/deployments/deploying";
import { wrapProviderToError } from "../../src/utils/AmbErrorProvider";
import { BlockRewardsMode2, ValidatorSet__factory } from "../../typechain-types";


async function main() {
  const { chainId } = await ethers.provider.getNetwork();
  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);


  // const multisig = await deployMultisig(ContractNames.BlockRewardsMode2_Multisig, deployer, "common");
  //
  // const rewards2 = await deploy<BlockRewardsMode2__factory>({
  //   contractName: ContractNames.BlockRewardsMode2,
  //   artifactName: "BlockRewardsMode2",
  //   deployArgs: [multisig.address],
  //   signer: deployer,
  //   isUpgradeableProxy: true,
  // });

  const rewards2 = loadDeployment(ContractNames.BlockRewardsMode2, chainId, deployer) as BlockRewardsMode2;


  await upgrade<ValidatorSet__factory>({
    contractName: ContractNames.ValidatorSet,
    networkId: chainId,
    signer: deployer,
    opts: {
      call: {
        fn: "setBlockRewardsContract",
        args: [rewards2.address],
      }
    }
  });
}

main();
