//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

import "hardhat/console.sol";

contract SingleSidePool is Initializable, AccessControl, IOnBlockListener {
    uint constant public MILLION = 1_000_000;

    struct Config {
        IERC20 token;
        string name;
        address rewardToken; 
        uint rewardTokenPrice; // The coefficient to calculate the reward token amount
        uint minStakeValue;
        uint fastUnstakePenalty;
        uint interest; //Time in seconds to how often the stake is increased
        uint interestRate;
        uint lockPeriod;
    }

    struct Info {
        uint totalStake;
        uint totalRewards;
        uint lastInterestUpdate;
        uint totalRewardsDebt;
    }

    struct Staker {
        uint stake;
        uint rewardsDebt;
        uint claimableRewards;
        uint lockedWithdrawal;
    }

    bool public active;
    RewardsBank rewardsBank;
    LockKeeper lockKeeper;

    Config public config;
    Info public info;

    mapping(address => Staker) public stakers;

    //EVENTS

    event Deactivated();
    event Activated();
    event MinStakeValueChanged(uint minStakeValue);
    event InterestRateChanged(uint interest, uint interestRate);
    event LockPeriodChanged(uint period);
    event RewardTokenPriceChanged(uint price);
    event FastUnstakePenaltyChanged(uint penalty);
    event StakeChanged(address indexed user, uint amount);
    event Claim(address indexed user, uint amount);
    event Interest(uint amount);
    event UnstakeLocked(address indexed user, uint amount, uint unlockTime, uint creationTime);
    event UnstakeFast(address indexed user, uint amount, uint penalty);

    function initialize(RewardsBank bank_, LockKeeper keeper_, Config calldata config_) public  initializer {
        rewardsBank = bank_;
        lockKeeper = keeper_;
        config = config_;

        info.lastInterestUpdate = block.timestamp;

        active = true;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // OWNER METHODS

    function activate() public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!active, "Pool is already active");
        active = true;
        emit Activated();
    }

    function deactivate() public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(active, "Pool is not active");
        active = false;
        emit Deactivated();
    }

    function setMinStakeValue(uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.minStakeValue = value;
        emit MinStakeValueChanged(value);
    }

    function setInterest(uint _interest, uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _addInterest();
        config.interest = _interest;
        config.interestRate = _interestRate;
        emit InterestRateChanged(config.interest, config.interestRate);
    }

    function setLockPeriod(uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.lockPeriod = period;
        emit LockPeriodChanged(period);
    }

    function setRewardTokenPrice(uint price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.rewardTokenPrice = price;
        emit RewardTokenPriceChanged(price);
    }

    function setFastUnstakePenalty(uint penalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.fastUnstakePenalty = penalty;
        emit FastUnstakePenaltyChanged(penalty);
    }

    // PUBLIC METHODS

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= config.minStakeValue, "Pool: stake value is too low");
        require(config.token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        _stake(msg.sender, amount);

        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(stakers[msg.sender].stake >= amount, "Not enough stake");

        _unstake(msg.sender, amount);

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(stakers[msg.sender].lockedWithdrawal).totalClaims > 0) // prev lock exists
            canceledAmount = lockKeeper.cancelLock(stakers[msg.sender].lockedWithdrawal);

        config.token.approve(address(lockKeeper), amount + canceledAmount);

        // lock funds
        stakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle(
            msg.sender, address(config.token), uint64(block.timestamp + config.lockPeriod), amount + canceledAmount,
            string(abi.encodePacked("TokenStaking unstake: ", _addressToString(address(config.token))))
        );

        _claimRewards(msg.sender);

        emit UnstakeLocked(msg.sender, amount + canceledAmount, block.timestamp + config.lockPeriod, block.timestamp);
        emit StakeChanged(msg.sender, stakers[msg.sender].stake);
    }

    function unstakeFast(uint amount) public {
        require(stakers[msg.sender].stake >= amount, "Not enough stake");

        _unstake(msg.sender, amount);

        uint penalty = amount * config.fastUnstakePenalty / MILLION;
        SafeERC20.safeTransfer(config.token, msg.sender, amount - penalty);

        _claimRewards(msg.sender);

        emit UnstakeFast(msg.sender, amount, penalty);
        emit StakeChanged(msg.sender, stakers[msg.sender].stake);
    }

    function claim() public {
        console.log("claiming rewards");
        _calcClaimableRewards(msg.sender);
        _claimRewards(msg.sender);
    }

    function onBlock() external {
        _addInterest();
    }

    // VIEW METHODS

    function getConfig() public view returns (Config memory) {
        return config;
    }

    function getInfo() public view returns (Info memory) {
        return info;
    }

    function getStake(address user) public view returns (uint) {
        return stakers[user].stake;
    }

    function getUserRewards(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(stakers[user].stake);
        if (rewardsAmount + stakers[user].claimableRewards <= stakers[user].rewardsDebt) 
            return 0;

        return rewardsAmount + stakers[user].claimableRewards - stakers[user].rewardsDebt;
    }

    // INTERNAL METHODS

    // store claimable rewards
    function _calcClaimableRewards(address user) internal {
        uint rewardsAmount = _calcRewards(stakers[user].stake);
        uint rewardsWithoutDebt = rewardsAmount - stakers[user].rewardsDebt;
        stakers[user].claimableRewards += rewardsWithoutDebt;
        info.totalRewardsDebt += rewardsWithoutDebt;
        stakers[user].rewardsDebt += rewardsWithoutDebt;
    }

    function _addInterest() internal {
        if (info.lastInterestUpdate + config.interestRate > block.timestamp) return;
        uint timePassed = block.timestamp - info.lastInterestUpdate;
        uint newRewards = info.totalStake * config.interest * timePassed / MILLION / config.interestRate;

        info.totalRewards += newRewards;
        info.lastInterestUpdate = block.timestamp;
        emit Interest(newRewards);
    }

    function _stake(address user, uint amount) internal {
        uint rewardsAmount = _calcRewards(amount);

        stakers[msg.sender].stake += amount;
        info.totalStake += amount;

        info.totalRewards += rewardsAmount;

        _updateRewardsDebt(user, _calcRewards(stakers[user].stake));
    }

    function _unstake(address user, uint amount) internal {
        uint rewardsAmount = _calcRewards(amount);

        stakers[msg.sender].stake -= amount;
        info.totalStake -= amount;

        info.totalRewards -= rewardsAmount;
        _updateRewardsDebt(user, _calcRewards(stakers[user].stake));
    }

    function _updateRewardsDebt(address user, uint newDebt) internal {
        uint oldDebt = stakers[user].rewardsDebt;
        if (newDebt < oldDebt) info.totalRewardsDebt -= oldDebt - newDebt;
        else info.totalRewardsDebt += newDebt - oldDebt;
        stakers[user].rewardsDebt = newDebt;
    }

    function _claimRewards(address user) internal {
        uint amount = stakers[user].claimableRewards;
        if (amount == 0) return;

        stakers[user].claimableRewards = 0;

        uint rewardTokenAmount = amount * config.rewardTokenPrice;
        rewardsBank.withdrawErc20(config.rewardToken, payable(user), rewardTokenAmount);
        emit Claim(user, rewardTokenAmount);
    }

    function _calcRewards(uint amount) internal view returns (uint) {
        if (info.totalStake == 0 && info.totalRewards == 0) return amount;
        return amount * info.totalRewards /info.totalStake;
    }

    function _addressToString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            uint8 b = uint8(uint(uint160(x)) / (2 ** (8 * (19 - i))));
            uint8 hi = (b / 16);
            uint8 lo = (b - 16 * hi);
            s[2 * i] = _char(hi);
            s[2 * i + 1] = _char(lo);
        }
        return string(s);
    }

    function _char(uint8 b) internal pure returns (bytes1 c) {
        return bytes1(b + (b < 10 ? 0x30 : 0x57));
    }

}
