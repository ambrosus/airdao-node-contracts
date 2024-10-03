import { ethers } from "hardhat";
import { wrapProviderToError } from "../../../src/utils/AmbErrorProvider";
import {  loadDeployment } from "@airdao/deployments/deploying";

import {
  LimitedTokenPool
} from "../../../typechain-types";

const BILLIION = 1_000_000_000;

async function main() {
  const { chainId } = await ethers.provider.getNetwork();

  const [deployer] = await ethers.getSigners();
  wrapProviderToError(deployer.provider!);

  const hbrToken = loadDeployment("Ecosystem_HRBToken", chainId, deployer);

  const poolsManager = loadDeployment("Ecosystem_TokenPoolsManager", chainId, deployer);

  const mainConfig: LimitedTokenPool.MainConfigStruct = {
    name: "HBR-AMB",
    limitsMultiplierToken: hbrToken.address,
    profitableToken: ethers.constants.AddressZero,
    rewardToken: ethers.constants.AddressZero,
    rewardTokenPrice: 1,
    interest: 0.1 * BILLIION,
    interestRate: 24 * 60 * 60,
  };

  const createTx = await poolsManager.createLimitedTokenPool(mainConfig);
  const createReceipt = await createTx.wait();
  console.log("createReceipt", createReceipt);

  const limitsConfig: LimitedTokenPool.LimitsConfigStruct = {
    minDepositValue: 1,
    minStakeValue: 1,
    fastUnstakePenalty: 0,
    unstakeLockPeriod: 24 * 60 * 60,
    stakeLockPeriod: 24 * 60 * 60,
    maxTotalStakeValue: 1 * BILLIION,
    maxStakePerUserValue: 0.01 * BILLIION,
    stakeLimitsMultiplier: 10,
  };

  const configureLimitsTx = await poolsManager.configureLimitedTokenPoolLimits("HBR-AMB", limitsConfig);
  const configureLimitsReceipt = await configureLimitsTx.wait();
  console.log("configureLimitsReceipt", configureLimitsReceipt);

  const poolAddress = await poolsManager.getLimitedTokenPoolAdress("HBR-AMB");
  console.log("poolAddress:", poolAddress);
}


if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

