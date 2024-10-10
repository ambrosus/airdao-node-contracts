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

  const mainConfig: LimitedTokenPool.MainConfigStruct = {
    name: "HBR-AMB",
    limitsMultiplierToken: hbrToken.address,
    profitableToken: ethers.constants.AddressZero,
    rewardToken: ethers.constants.AddressZero,
  };

  const createTx = await poolsManager.createPool(mainConfig);
  const createReceipt = await createTx.wait();
  const event = createReceipt.events?.find((event) => event.event === "LimitedPoolCreated");
  const address = event?.args?.pool;
  console.log("PoolAddress: ", address);

  const limitsConfig: LimitedTokenPool.LimitsConfigStruct = {
    rewardTokenPrice: BILLIION,
    interest: 0.1 * BILLIION,
    interestRate: 30 * 60,
    minDepositValue: 1,
    minStakeValue: 1,
    fastUnstakePenalty: 0,
    unstakeLockPeriod: 0,
    stakeLockPeriod: 1 * 60,
    maxTotalStakeValue: ethers.utils.parseEther("100000000"),
    maxStakePerUserValue: ethers.utils.parseEther("10000000"),
    stakeLimitsMultiplier: 10 * BILLIION,
  };

  const configureLimitsTx = await poolsManager.configurePool(address, limitsConfig);
  const configureLimitsReceipt = await configureLimitsTx.wait();
  console.log("configureLimitsReceipt", configureLimitsReceipt);
}


if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

