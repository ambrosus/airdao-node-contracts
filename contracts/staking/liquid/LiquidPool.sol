// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";
import {IOnBlockListener} from "../../consensus/OnBlockNotifier.sol";
import "./StAMB.sol";
import "./StakingTiers.sol";
import "./LiquidNodesManager.sol";

contract LiquidPool is UUPSUpgradeable, AccessControlUpgradeable, IOnBlockListener {
    uint constant private BILLION = 1000000000;

    LiquidNodesManager public nodeManager;
    RewardsBank public rewardsBank;
    StakingTiers public tiers;
    LockKeeper public lockKeeper;
    address public bondAddress;
    StAMB public stAmb;

    uint public minStakeValue;
    uint public unstakeLockTime;

    uint public interest;  // user will get interest % of his stake. Sets in parts per billion
    uint public interestPeriod;  // period in seconds for interest calculation
    uint internal lastInterestTime; // newReward = totalStAmb * (interest/1e6) * (timePassed / interestPeriod)
    uint public fastUnstakePenalty; // penalty in parts per million

    uint public totalRewards;  // rewards from interest, includes totalRewardsDebt, can be much greater than real rewards
    uint public totalRewardsDebt; // real rewards = totalRewards - totalRewardsDebt

    // rewards that has been "claimed" before stake changes.
    mapping(address => uint) internal rewardsCanClaim;

    // new stakes will immediately have rewards to claim (coz of how shares works), so we need to
    // artificially decrease their stakes by some value.
    mapping(address => uint) public rewardsDebt;

    mapping(address => uint) public lockedWithdraws; // nodeAddress => lockId

    uint256[10] __gap;


    event StakeChanged(address indexed account, int amount);
    event Claim(address indexed account, uint ambAmount, uint bondAmount);
    event Interest(uint amount);
    event UnstakeLocked(address indexed account, uint amount, uint unlockTime, uint creationTime);
    event UnstakeFast(address indexed account, uint amount, uint penalty);


    function initialize(
        LiquidNodesManager nodeManager_, RewardsBank rewardsBank_, StakingTiers tiers_,
        LockKeeper lockKeeper_, address bondAddress_, StAMB stAmb_,
        uint interest_, uint interestPeriod_, uint minStakeValue_, uint unstakeLockTime_, uint fastUnstakePenalty_
    ) public initializer {
        require(minStakeValue_ > 0, "Pool min stake value is zero");
        require(interest_ >= 0 && interest_ <= BILLION, "Invalid percent value");

        nodeManager = nodeManager_;
        rewardsBank = rewardsBank_;
        tiers = tiers_;
        lockKeeper = lockKeeper_;
        bondAddress = bondAddress_;
        stAmb = stAmb_;

        interest = interest_;
        interestPeriod = interestPeriod_;

        minStakeValue = minStakeValue_;
        unstakeLockTime = unstakeLockTime_;
        fastUnstakePenalty = fastUnstakePenalty_;

        lastInterestTime = block.timestamp;

        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ADMIN METHODS

    function setInterest(uint interest_, uint interestPeriod_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(interest_ >= 0 && interest_ <= BILLION, "Invalid percent value");
        interest = interest_;
        interestPeriod = interestPeriod_;
    }

    function setUnstakeLockTime(uint unstakeLockTime_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        unstakeLockTime = unstakeLockTime_;
    }

    function setMinStakeValue(uint minStakeValue_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeValue = minStakeValue_;
    }

    function setFastUnstakePenalty(uint penalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        fastUnstakePenalty = penalty;
    }

    // PUBLIC METHODS

    function stake() public payable {
        // todo final stake value should be checked here ?
        require(msg.value >= minStakeValue, "Pool: stake value too low");

        _stake(msg.sender, msg.value);

        nodeManager.stake{value: msg.value}();

        emit StakeChanged(msg.sender, int(msg.value));
    }

    function unstakeFast(uint amount, uint desiredCoeff) public {
        require(amount <= getStake(msg.sender), "Sender has not enough tokens");

        _unstake(msg.sender, amount);

        nodeManager.unstake(amount);

        uint penalty = amount * fastUnstakePenalty / BILLION;
        payable(msg.sender).transfer(amount - penalty);

        _claimRewards(msg.sender, desiredCoeff);

        emit StakeChanged(msg.sender, - int(amount));
        emit UnstakeFast(msg.sender, amount, penalty);
    }

    function unstake(uint amount, uint desiredCoeff) public {
        require(amount <= getStake(msg.sender), "Sender has not enough tokens");

        _unstake(msg.sender, amount);

        nodeManager.unstake(amount);

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(lockedWithdraws[msg.sender]).totalClaims > 0)  // prev lock exists
            canceledAmount = lockKeeper.cancelLock(lockedWithdraws[msg.sender]);

        // lock funds
        lockedWithdraws[msg.sender] = lockKeeper.lockSingle{value: amount + canceledAmount}(
            msg.sender, address(0),
            uint64(block.timestamp + unstakeLockTime), amount + canceledAmount,
            "LiquidStaking unstake"
        );

        _claimRewards(msg.sender, desiredCoeff);

        emit StakeChanged(msg.sender, - int(amount));
        emit UnstakeLocked(msg.sender, amount + canceledAmount, block.timestamp + unstakeLockTime, block.timestamp);
    }

    function claimRewards(uint desiredCoeff) public {
        _beforeUserStakeChanged(msg.sender);

        _claimRewards(msg.sender, desiredCoeff);
    }

    // external methods

    // this method is called by stAMB contract before token transfer
    // it's used to calculate user rewards before his stake changes
    // it's also called on mint and burn
    function beforeTokenTransfer(address from, address to, uint256 amount) external {
        require(msg.sender == address(stAmb), "Only stAMB can call this method");
        if (from != address(0))
            _beforeUserStakeChanged(from);
        if (to != address(0))
            _beforeUserStakeChanged(to);


        if (from != address(0) && to != address(0)) {
            uint transferredDebt = rewardsDebt[from] * amount / getStake(from);
            rewardsDebt[from] -= transferredDebt;
            rewardsDebt[to] += transferredDebt;
        }
    }

    function onBlock() external {
        if (lastInterestTime + interestPeriod < block.timestamp)
            _addInterestToDeposit();
    }

    // VIEW METHODS

    function getTotalRewards() public view returns (uint) {
        return totalRewards - totalRewardsDebt;
    }

    function getTotalStAmb() public view returns (uint) {
        return stAmb.totalSupply();
    }

    function getStake(address user) public view returns (uint) {
        return stAmb.balanceOf(user);
    }

    function getClaimAmount(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(getStake(user));

        if (rewardsAmount + rewardsCanClaim[user] <= rewardsDebt[user])
            return 0;

        return rewardsAmount + rewardsCanClaim[user] - rewardsDebt[user];
    }

    // PRIVATE METHODS

    function _addInterestToDeposit() internal {
        uint timePassed = block.timestamp - lastInterestTime;
        uint newRewards = getTotalStAmb() * interest * timePassed / BILLION / interestPeriod;

        totalRewards += newRewards;
        lastInterestTime = block.timestamp;

        emit Interest(newRewards);
    }


    function _stake(address user, uint amount) internal {
        uint rewardsAmount = _calcRewards(amount);

        stAmb.mint(user, amount);

        totalRewards += rewardsAmount;
        _updateRewardsDebt(user, _calcRewards(getStake(user)));
    }

    function _unstake(address user, uint amount) internal {
        uint rewardsAmount = _calcRewards(amount);

        stAmb.burn(user, amount);

        totalRewards -= rewardsAmount;
        _updateRewardsDebt(user, _calcRewards(getStake(user)));
    }

    function _updateRewardsDebt(address user, uint newDebt) internal {
        uint oldDebt = rewardsDebt[user];
        if (newDebt < oldDebt) totalRewardsDebt -= oldDebt - newDebt;
        else totalRewardsDebt += newDebt - oldDebt;
        rewardsDebt[user] = newDebt;
    }

    // "claim" rewards for user before his stake changes
    function _beforeUserStakeChanged(address user) private {
        uint rewardsAmount = _calcRewards(getStake(user));
        uint rewardWithoutDebt = rewardsAmount - rewardsDebt[user];
        rewardsCanClaim[user] += rewardWithoutDebt;
        _updateRewardsDebt(user, rewardsAmount);
    }

    function _claimRewards(address user, uint desiredCoeff) private {
        require(desiredCoeff <= 100, "Invalid desired coeff");
        require(tiers.isTierAllowed(user, desiredCoeff), "User tier is too low");

        uint amount = rewardsCanClaim[user];
        if (amount == 0) return;

        rewardsCanClaim[user] = 0;

        uint ambAmount = amount * desiredCoeff / 100;
        uint bondAmount = amount - ambAmount;

        rewardsBank.withdrawAmb(payable(user), ambAmount);
        rewardsBank.withdrawErc20(bondAddress, payable(user), bondAmount);

        emit Claim(user, ambAmount, bondAmount);
    }

    function _calcRewards(uint stAmbAmount) internal view returns (uint) {
        if (getTotalStAmb() == 0 || totalRewards == 0) return stAmbAmount;
        return stAmbAmount * totalRewards / getTotalStAmb();
    }


    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    receive() external payable {
        require(msg.sender == address(nodeManager) || msg.sender == address(lockKeeper), "Not allowed");
    }

}
