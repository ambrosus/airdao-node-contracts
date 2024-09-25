import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  Claim as ClaimEvent,
  Interest as InterestEvent,
  StakeChanged as StakeChangedEvent,
  UnstakeFast as UnstakeFastEvent,
  UnstakeLocked as UnstakeLockedEvent
} from "../../generated/LiquidPool/LiquidPool";
import { User, Claim, Interest, StakeChange, UnstakeFast, UnstakeLocked, StakingStats } from "../../generated/schema";

function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (!user) {
    user = new User(address.toHexString());
    user.address = address;
    user.stakedAmount = BigInt.fromI32(0);
    user.rewardsDebt = BigInt.fromI32(0);
    user.claimedRewards = BigInt.fromI32(0);
    user.lockedWithdraws = BigInt.fromI32(0);
    user.save();
  }
  return user as User;
}

function getOrCreateStakingStats(): StakingStats {
  let stats = StakingStats.load("1");
  if (!stats) {
    stats = new StakingStats("1");
    stats.totalStaked = BigInt.fromI32(0);
    stats.totalRewards = BigInt.fromI32(0);
    stats.totalRewardsDebt = BigInt.fromI32(0);
    stats.interestRate = BigInt.fromI32(0);
    stats.interestPeriod = BigInt.fromI32(0);
    stats.minStakeValue = BigInt.fromI32(0);
    stats.unstakeLockTime = BigInt.fromI32(0);
    stats.fastUnstakePenalty = BigInt.fromI32(0);
    stats.save();
  }
  return stats as StakingStats;
}

export function handleClaim(event: ClaimEvent): void {
  const user = getOrCreateUser(event.params.account);
  const claim = new Claim(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  claim.user = user.id;
  claim.ambAmount = event.params.ambAmount;
  claim.bondAmount = event.params.bondAmount;
  claim.timestamp = event.block.timestamp;
  claim.save();

  user.claimedRewards = user.claimedRewards.plus(event.params.ambAmount).plus(event.params.bondAmount);
  user.save();

  const stats = getOrCreateStakingStats();
  stats.totalRewards = stats.totalRewards.plus(event.params.ambAmount).plus(event.params.bondAmount);
  stats.save();
}

export function handleInterest(event: InterestEvent): void {
  const interest = new Interest(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  interest.amount = event.params.amount;
  interest.timestamp = event.block.timestamp;
  interest.save();

  const stats = getOrCreateStakingStats();
  stats.interestRate = event.params.amount;
  stats.save();
}

export function handleStakeChanged(event: StakeChangedEvent): void {
  const user = getOrCreateUser(event.params.account);
  const stakeChange = new StakeChange(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  stakeChange.user = user.id;
  stakeChange.amount = event.params.amount.abs();
  stakeChange.isStake = event.params.amount.gt(BigInt.fromI32(0));
  stakeChange.timestamp = event.block.timestamp;
  stakeChange.save();

  user.stakedAmount = user.stakedAmount.plus(event.params.amount);
  if (stakeChange.isStake) {
    user.lastStakeTime = event.block.timestamp;
  } else {
    user.lastUnstakeTime = event.block.timestamp;
  }
  user.save();

  const stats = getOrCreateStakingStats();
  stats.totalStaked = stats.totalStaked.plus(event.params.amount);
  stats.save();
}

export function handleUnstakeFast(event: UnstakeFastEvent): void {
  const user = getOrCreateUser(event.params.account);
  const unstakeFast = new UnstakeFast(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  unstakeFast.user = user.id;
  unstakeFast.amount = event.params.amount;
  unstakeFast.penalty = event.params.penalty;
  unstakeFast.timestamp = event.block.timestamp;
  unstakeFast.save();

  user.stakedAmount = user.stakedAmount.minus(event.params.amount);
  user.lastUnstakeTime = event.block.timestamp;
  user.save();

  const stats = getOrCreateStakingStats();
  stats.totalStaked = stats.totalStaked.minus(event.params.amount);
  stats.fastUnstakePenalty = event.params.penalty;
  stats.save();
}

export function handleUnstakeLocked(event: UnstakeLockedEvent): void {
  const user = getOrCreateUser(event.params.account);
  const unstakeLocked = new UnstakeLocked(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  unstakeLocked.user = user.id;
  unstakeLocked.amount = event.params.amount;
  unstakeLocked.unlockTime = event.params.unlockTime;
  unstakeLocked.creationTime = event.params.creationTime;
  unstakeLocked.save();

  user.lockedWithdraws = user.lockedWithdraws.plus(event.params.amount);
  user.save();

  const stats = getOrCreateStakingStats();
  stats.unstakeLockTime = event.params.unlockTime.minus(event.params.creationTime);
  stats.save();
}
