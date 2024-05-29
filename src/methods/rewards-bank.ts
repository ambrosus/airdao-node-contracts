import {Contracts} from "../contracts/contracts";
import {BigNumberish} from "ethers";
import {ContractNames} from "../contracts/names";
import {
  RewardsBank,
} from "../../typechain-types";
import {submitTransaction2} from "../multisig/submitTransaction";

type rewardsBankContactNames =
  | ContractNames.BaseNodesManagerRewardsBank
  | ContractNames.LegacyPoolManagerRewardsBank
  | ContractNames.ServerNodesManagerRewardsBank
  | ContractNames.BondMarketplaceRewardsBank;

export async function rewardsBanksWithdrawAmb(
  contracts: Contracts,
  contractName: rewardsBankContactNames,
  addressTo: string,
  amount: BigNumberish
) {
  return await submitTransaction2<RewardsBank>(contracts, contractName, 0, (rewardsBank) =>
    rewardsBank.withdrawAmb(addressTo, amount)
  );
}

export async function rewardsBanksWithdrawBonds(
  contracts: Contracts,
  contractName: rewardsBankContactNames,
  addressTo: string,
  amount: BigNumberish
) {
  const airBond = contracts.getContractByName(ContractNames.AirBond);
  return await rewardsBanksWithdrawTokens(contracts, contractName, airBond.address, addressTo, amount);
}

export async function rewardsBanksWithdrawTokens(
  contracts: Contracts,
  contractName: rewardsBankContactNames,
  tokenAddress: string,
  addressTo: string,
  amount: BigNumberish
) {
  return await submitTransaction2<RewardsBank>(contracts, contractName, 0, (rewardsBank) =>
    rewardsBank.withdrawErc20(tokenAddress, addressTo, amount)
  );
}
