import { ethers } from "hardhat";
import { wrapProviderToError } from "../../../src/utils/AmbErrorProvider";
import {  loadDeployment } from "@airdao/deployments/deploying";

import {
  LimitedTokenPool,
  LimitedTokenPoolsManager
} from "../../../typechain-types";

const BILLIION = 1_000_000_000;

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

  const hbrToken = loadDeployment("Ecosystem_HBRToken", chainId, deployer);

  const poolsManager = loadDeployment("Ecosystem_LimitedTokenPoolsManager", chainId, deployer) as LimitedTokenPoolsManager;

  //const pools = await poolsManager.pools(0);
  //console.log("pools", pools);

  const mainConfig: LimitedTokenPool.MainConfigStruct = {
    name: "HBR-AMB",
    limitsMultiplierToken: hbrToken.address,
    profitableToken: ethers.constants.AddressZero,
    rewardToken: ethers.constants.AddressZero,
  };

  //const createTx = await poolsManager.createPool(mainConfig);
  //const createReceipt = await createTx.wait();
  //console.log("createReceipt", createReceipt);

  const limitsConfig: LimitedTokenPool.LimitsConfigStruct = {
    rewardTokenPrice: BILLIION,
    interest: 0.1 * BILLIION,
    interestRate: 24 * 60 * 60,
    minDepositValue: 1,
    minStakeValue: 1,
    fastUnstakePenalty: 0,
    unstakeLockPeriod: 24 * 60 * 60,
    stakeLockPeriod: 24 * 60 * 60,
    maxTotalStakeValue: 1 * BILLIION,
    maxStakePerUserValue: 0.1 * BILLIION,
    stakeLimitsMultiplier: 10 * BILLIION,
  };

  const configureLimitsTx = await poolsManager.configurePool("0x93381ADEC72b8201fFe12E47e47f390f4132764f", limitsConfig);
  const configureLimitsReceipt = await configureLimitsTx.wait();
  console.log("configureLimitsReceipt", configureLimitsReceipt);
}


if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

