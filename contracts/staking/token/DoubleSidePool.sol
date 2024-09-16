//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

//The side defined by the address of the token. Zero address means native coin
contract DepositedPool  is Initializable, AccessControl, IOnBlockListener {

    struct Config {
        string name;
        address depositToken;
        uint minDepositValue;
        address profitableToken;
        address rewardToken;
        uint rewardTokenPrice;
        uint minStakeValue;
        uint unstakeLockPeriod; // Time in seconds to how long the amount is locker after unstake
        uint lockPeriod;
        uint interest;
        uint interestRate;
        uint maxTotalStakeValue;
        uint maxStakePerUserValue;
        uint stakeLockPeriod; // Time in seconds to how long the stake is locker before unstake
        uint stakeLimitsMultiplier; // Should be represented as parts of BILLION
    }

    struct Info {
        uint totalStake;
        uint totalDeposit;
        uint totalRewards;
        uint lastInterestUpdate;
        uint totalRewardsDebt;
    }

    struct Staker {
        uint stake;
        uint deposit;
        uint rewardsDebt;
        uint claimableRewards;
        uint lockedWithdrawal;
        uint stakedAt;
    }

    uint constant public BILLION = 1_000_000_000;

    LockKeeper public lockKeeper;
    RewardsBank public rewardsBank;
    
    string public name;
    bool public active;

    Config public config;
    Info public info;

    mapping(address => Staker) public stakers;

    //EVENTS

    event Deactivated();
    event Activated();
    event MinStakeValueChanged(uint minStakeValue);
    event UnstakeLockePeriodChanged(uint period);
    event RewardTokenPriceChanged(uint price);
    event FastUnstakePenaltyChanged(uint penalty);
    event InterestChanged(uint interest);
    event InterestRateChanged(uint interestRate);
    event MaxTotalStakeValueChanged(uint poolMaxStakeValue);
    event MaxStakePerUserValueChanged(uint maxStakePerUserValue);
    event StakeLockPeriodChanged(uint period);
    event StakeLimitsMultiplierChanged(uint value);

    event DepositChanged(address indexed user, uint amount);
    event StakeChanged(address indexed user, uint amount);
    event Claim(address indexed user, uint amount);
    event Interest(uint amount);
    event UnstakeLocked(address indexed user, uint amount, uint unlockTime, uint creationTime);

    function initialize(
        RewardsBank rewardsBank_, LockKeeper lockkeeper_, Config calldata config_
    ) public  initializer {
        lockKeeper = lockkeeper_;
        rewardsBank = rewardsBank_;

        active = true;

        config = config_;

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

    // SETTERS FOR PARAMS

    function setMinStakeValue(uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.minStakeValue = value;
        emit MinStakeValueChanged(value);
    }

    function setInterest(uint _interest, uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.interest = _interest;
        config.interestRate = _interestRate;

        emit InterestRateChanged(_interestRate);
        emit InterestChanged(_interest);
    }

    function setUnstakeLockPeriod(uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.unstakeLockPeriod = period;
        emit UnstakeLockePeriodChanged(period);
    }

    function setRewardTokenPrice(uint price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.rewardTokenPrice = price;
        emit RewardTokenPriceChanged(price);
    }

    function setMaxTotalStakeValue(uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.maxTotalStakeValue = value;
        emit MaxTotalStakeValueChanged(value);
    }

    function setStakeLockPeriod(uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.stakeLockPeriod = period;
        emit StakeLockPeriodChanged(period);
    }

    function setStakeLimitsMultiplier(uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        config.stakeLimitsMultiplier = value;
        emit StakeLimitsMultiplierChanged(value);
    }

    // PUBLIC METHODS

    function deposit(uint amount) public payable {
        require(active, "Pool is not active");
        require(amount >= config.minDepositValue, "Pool: deposit value is too low");
        if (msg.value != 0) {
            require(config.depositToken == address(0), "Pool: does not accept native coin");
            require(msg.value == amount, "Pool: wrong amount of native coin");
        } else {
            SafeERC20.safeTransferFrom(IERC20(config.depositToken), msg.sender, address(this), amount);
        }

        stakers[msg.sender].deposit += amount;
        info.totalDeposit += amount;

        emit DepositChanged(msg.sender, amount);
    }

    function withdraw(uint amount) public {
        require(stakers[msg.sender].deposit >= amount, "Not enough deposit");

        stakers[msg.sender].deposit -= amount;
        info.totalDeposit -= amount;

        require(stakers[msg.sender].deposit <= _maxUserStakeValue(msg.sender), "Pool: user max stake value exceeded");

        if (config.depositToken == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            SafeERC20.safeTransfer(IERC20(config.depositToken), msg.sender, amount);
        }

        emit DepositChanged(msg.sender, stakers[msg.sender].deposit);
    }

    function stake(uint amount) public payable {
        require(active, "Pool is not active");
        require(amount >= config.minStakeValue, "Pool: stake value is too low");
        if (msg.value != 0) {
            require(config.profitableToken == address(0), "Pool: does not accept native coin");
            require(msg.value == amount, "Pool: wrong amount of native coin");
        } else {
            SafeERC20.safeTransferFrom(IERC20(config.profitableToken), msg.sender, address(this), amount);
        }

        uint rewardsAmount = _calcRewards(amount);

        stakers[msg.sender].stake += amount;
        info.totalStake += amount;
        info.totalRewards += rewardsAmount;
        if (stakers[msg.sender].stakedAt == 0)
            stakers[msg.sender].stakedAt = block.timestamp;

        require(stakers[msg.sender].stake <= _maxUserStakeValue(msg.sender), "Pool: user max stake value exceeded");
        require(info.totalStake <= config.maxTotalStakeValue, "Pool: max stake value exceeded");
        require(stakers[msg.sender].stake <= config.maxStakePerUserValue, "Pool: max stake per user exceeded");

        _updateRewardsDebt(msg.sender, _calcRewards(stakers[msg.sender].stake));
        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(stakers[msg.sender].stake >= amount, "Not enough stake");
        require(block.timestamp - stakers[msg.sender].stakedAt >= config.stakeLockPeriod, "Stake is locked");

        uint rewardsAmount = _calcRewards(amount);

        stakers[msg.sender].stake -= amount;
        info.totalStake -= amount;
        info.totalRewards -= rewardsAmount;

        if (stakers[msg.sender].stake == 0) stakers[msg.sender].stakedAt = 0;

        _updateRewardsDebt(msg.sender, _calcRewards(stakers[msg.sender].stake));

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(stakers[msg.sender].lockedWithdrawal).totalClaims > 0) // prev lock exists
            canceledAmount = lockKeeper.cancelLock(stakers[msg.sender].lockedWithdrawal);

        if (config.profitableToken == address(0)) {
            // lock funds
            stakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle{value: amount + canceledAmount}(
                msg.sender, address(config.profitableToken), uint64(block.timestamp + config.lockPeriod), amount + canceledAmount,
                string(abi.encodePacked("TokenStaking unstake"))
            );
        } else {
            IERC20(config.profitableToken).approve(address(lockKeeper), amount + canceledAmount);
            // lock funds
            stakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle(
                msg.sender, address(config.profitableToken), uint64(block.timestamp + config.lockPeriod), amount + canceledAmount,
                string(abi.encodePacked("TokenStaking unstake"))
            );
        }


        _claimRewards(msg.sender);

        emit UnstakeLocked(msg.sender, amount + canceledAmount, block.timestamp + config.lockPeriod, block.timestamp);
        emit StakeChanged(msg.sender, stakers[msg.sender].stake);
    }

    function claim() public {
        _calcClaimableRewards(msg.sender);
        _claimRewards(msg.sender);
    }

    function onBlock() external {
        _addInterest();
    }

    // VIEW METHODS

    function getName() public view returns (string memory) {
        return config.name;
    }

    function getConfig() public view returns (Config memory) {
        return config;
    }
    
    function getInfo() public view returns (Info memory) {
        return info;
    }

    function getStaker(address user) public view returns (Staker memory) {
        return stakers[user];
    }

    function getUserRewards(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(stakers[user].stake);
        if (rewardsAmount + stakers[user].claimableRewards <= stakers[user].rewardsDebt) 
            return 0;

        return rewardsAmount + stakers[user].claimableRewards - stakers[user].rewardsDebt;
    }

    // INTERNAL METHODS
    function _addInterest() internal {
        if (info.lastInterestUpdate + config.interestRate > block.timestamp) return;
        uint timePassed = block.timestamp - info.lastInterestUpdate;
        uint newRewards = info.totalStake * config.interest * timePassed / BILLION / config.interestRate;

        info.totalRewards += newRewards;
        info.lastInterestUpdate = block.timestamp;
        emit Interest(newRewards);
    }

    function _maxUserStakeValue(address user) internal view returns (uint) {
        return stakers[user].deposit * config.stakeLimitsMultiplier / BILLION;
    }

    // store claimable rewards
    function _calcClaimableRewards(address user) internal {
        uint rewardsAmount = _calcRewards(stakers[user].stake);
        uint rewardsWithoutDebt = rewardsAmount - stakers[user].rewardsDebt;
        stakers[user].claimableRewards += rewardsWithoutDebt;
        info.totalRewardsDebt += rewardsWithoutDebt;
        stakers[user].rewardsDebt += rewardsWithoutDebt;
    }

    function _claimRewards(address user) internal {
       uint amount = stakers[user].claimableRewards;
       if (amount == 0) return;

       stakers[user].claimableRewards = 0;

       uint rewardTokenAmount = amount * config.rewardTokenPrice;
       if (config.rewardToken == address(0)) {
           rewardsBank.withdrawAmb(payable(user), amount);
       } else {
           rewardsBank.withdrawErc20(config.rewardToken, payable(user), rewardTokenAmount);
       }
       emit Claim(user, rewardTokenAmount);
    }

    function _calcRewards(uint amount) internal view returns (uint) {
        if (info.totalStake == 0 && info.totalRewards == 0) return amount;
        return amount * info.totalRewards / info.totalStake;
    }

    function _updateRewardsDebt(address user, uint newDebt) internal {
        uint oldDebt = stakers[user].rewardsDebt;
        if (newDebt < oldDebt) info.totalRewardsDebt -= oldDebt - newDebt;
        else info.totalRewardsDebt += newDebt - oldDebt;
        stakers[user].rewardsDebt = newDebt;
    }
}
