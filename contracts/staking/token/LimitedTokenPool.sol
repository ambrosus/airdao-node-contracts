//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

//The side defined by the address of the token. Zero address means native coin
contract LimitedTokenPool is Initializable, AccessControl, IOnBlockListener {
    using SafeERC20 for IERC20;

    struct MainConfig {
        string name;
        address limitsMultiplierToken;
        address profitableToken;
        address rewardToken;
    }

    struct LimitsConfig {
        uint rewardTokenPrice; // Represented as parts of BILLION 1 = Billion
        uint interest; // represented as parts of BILLION. 100% = Billion
        uint interestRate;
        uint minDepositValue;
        uint minStakeValue;
        uint fastUnstakePenalty;
        uint unstakeLockPeriod; // Time in seconds to how long the amount is locker after unstake
        uint stakeLockPeriod; // Time in seconds to how long the stake is locker before unstake
        uint maxTotalStakeValue;
        uint maxStakePerUserValue;
        uint stakeLimitsMultiplier; // Represented as parts of BILLION 1 = Billion
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
    bool public active;

    LockKeeper public lockKeeper;
    RewardsBank public rewardsBank;

    MainConfig public mainConfig; // immutable
    LimitsConfig public limitsConfig; // mutable
    Info public info;

    mapping(address => Staker) private stakers;

    //EVENTS

    event Deactivated();
    event Activated();
    event LimitsConfigChanged(LimitsConfig config);

    event Deposited(address indexed user, uint amount);
    event Withdrawn(address indexed user, uint amount);
    event Staked(address indexed user, uint amount, uint timestamp);
    event Claim(address indexed user, uint amount);
    event Interest(uint amount);
    event UnstakeLocked(address indexed user, uint amount, uint unlockTime, uint creationTime);

    function initialize(
        RewardsBank rewardsBank_, LockKeeper lockkeeper_, MainConfig calldata config_
    ) public  initializer {
        lockKeeper = lockkeeper_;
        rewardsBank = rewardsBank_;

        active = true;

        mainConfig = config_;
        info.lastInterestUpdate = block.timestamp;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // OWNER METHODS

    function setLimitsConfig(LimitsConfig calldata config) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(config.maxTotalStakeValue >= config.maxStakePerUserValue, "Pool: max stake per user is greater than max total stake");
        require(config.maxStakePerUserValue >= config.minStakeValue, "Pool: min stake value is greater than max stake per user");
        limitsConfig = config;
        emit LimitsConfigChanged(config);
    }

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

    // PUBLIC METHODS

    function deposit(uint amount) public payable {
        require(active, "Pool is not active");
        require(amount >= limitsConfig.minDepositValue, "Pool: deposit value is too low");
        if (msg.value != 0) {
            require(mainConfig.limitsMultiplierToken == address(0), "Pool: does not accept native coin");
            require(msg.value == amount, "Pool: wrong amount of native coin");
        } else {
            IERC20(mainConfig.limitsMultiplierToken).safeTransferFrom(msg.sender, address(this), amount);
        }

        stakers[msg.sender].deposit += amount;
        info.totalDeposit += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint amount) public {
        require(stakers[msg.sender].deposit >= amount, "Not enough deposit");

        stakers[msg.sender].deposit -= amount;
        info.totalDeposit -= amount;

        require(stakers[msg.sender].stake <= _maxUserStakeValue(msg.sender), "Pool: user max stake value exceeded");

        if (mainConfig.limitsMultiplierToken == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(mainConfig.limitsMultiplierToken).safeTransfer(msg.sender, amount);
        }

        emit Withdrawn(msg.sender, amount);
    }

    function stake(uint amount) public payable {
        require(active, "Pool is not active");
        require(amount >= limitsConfig.minStakeValue, "Pool: stake value is too low");
        if (msg.value != 0) {
            require(mainConfig.profitableToken == address(0), "Pool: does not accept native coin");
            require(msg.value == amount, "Pool: wrong amount of native coin");
        } else {
            require(mainConfig.profitableToken != address(0), "Pool: does not accept ERC20 tokens");
            IERC20(mainConfig.profitableToken).safeTransferFrom(msg.sender, address(this), amount);
        }

        _calcClaimableRewards(msg.sender);
        uint rewardsAmount = _calcRewards(amount);

        stakers[msg.sender].stake += amount;
        info.totalStake += amount;
        info.totalRewards += rewardsAmount;
        if (stakers[msg.sender].stakedAt == 0)
            stakers[msg.sender].stakedAt = block.timestamp;

        require(stakers[msg.sender].stake <= _maxUserStakeValue(msg.sender), "Pool: user max stake value exceeded");
        require(info.totalStake <= limitsConfig.maxTotalStakeValue, "Pool: max stake value exceeded");
        require(stakers[msg.sender].stake <= limitsConfig.maxStakePerUserValue, "Pool: max stake per user exceeded");

        _updateRewardsDebt(msg.sender, _calcRewards(stakers[msg.sender].stake));
        emit Staked(msg.sender, amount, block.timestamp);
    }

    function unstake(uint amount) public {
        require(stakers[msg.sender].stake >= amount, "Not enough stake");
        require(block.timestamp - stakers[msg.sender].stakedAt >= limitsConfig.stakeLockPeriod, "Stake is locked");

        _calcClaimableRewards(msg.sender);
        _claimRewards(msg.sender);
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

        if (mainConfig.profitableToken == address(0)) {
            // lock funds
            stakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle{value: amount + canceledAmount}(
                msg.sender, address(mainConfig.profitableToken), uint64(block.timestamp + limitsConfig.unstakeLockPeriod), amount + canceledAmount,
                string(abi.encodePacked("TokenStaking unstake"))
            );
        } else {
            IERC20(mainConfig.profitableToken).approve(address(lockKeeper), amount + canceledAmount);
            // lock funds
            stakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle(
                msg.sender, address(mainConfig.profitableToken), uint64(block.timestamp + limitsConfig.unstakeLockPeriod), amount + canceledAmount,
                string(abi.encodePacked("TokenStaking unstake"))
            );
        }

        emit UnstakeLocked(msg.sender, amount + canceledAmount, block.timestamp + limitsConfig.unstakeLockPeriod, block.timestamp);
    }

    function unstakeFast(uint amount) public {
        require(stakers[msg.sender].stake >= amount, "Not enough stake");
        require(block.timestamp - stakers[msg.sender].stakedAt >= limitsConfig.stakeLockPeriod, "Stake is locked");

        _calcClaimableRewards(msg.sender);
        _claimRewards(msg.sender);
        uint rewardsAmount = _calcRewards(amount);

        stakers[msg.sender].stake -= amount;
        info.totalStake -= amount;
        info.totalRewards -= rewardsAmount;

        if (stakers[msg.sender].stake == 0) stakers[msg.sender].stakedAt = 0;

        _updateRewardsDebt(msg.sender, _calcRewards(stakers[msg.sender].stake));
        uint penalty = amount * limitsConfig.fastUnstakePenalty / BILLION;
        if (mainConfig.profitableToken == address(0)) {
            payable(msg.sender).transfer(amount - penalty);
        } else {
            IERC20(mainConfig.profitableToken).safeTransfer(msg.sender, amount - penalty);
        }
    }

    function claim() public {
        _calcClaimableRewards(msg.sender);
        _claimRewards(msg.sender);
    }

    function onBlock() external {
        if (info.lastInterestUpdate + limitsConfig.interestRate < block.timestamp)
            _addInterest();
    }

    // VIEW METHODS

    function getName() public view returns (string memory) {
        return mainConfig.name;
    }

    function getStake(address user) public view returns (uint) {
        return stakers[user].stake;
    }

    function getDeposit(address user) public view returns (uint) {
        return stakers[user].deposit;
    }

    function getUserRewards(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(stakers[user].stake);
        if (rewardsAmount + stakers[user].claimableRewards <= stakers[user].rewardsDebt) 
            return 0;

        return rewardsAmount + stakers[user].claimableRewards - stakers[user].rewardsDebt;
    }

    function getMaxUserStakeValue(address user) public view returns (uint) {
        return _maxUserStakeValue(user);
    }

    // INTERNAL METHODS
    function _addInterest() internal {
        if (!active) return;
        uint timePassed = block.timestamp - info.lastInterestUpdate;
        uint newRewards = info.totalStake * limitsConfig.interest * timePassed / BILLION / limitsConfig.interestRate;

        info.totalRewards += newRewards;
        info.lastInterestUpdate = block.timestamp;
        emit Interest(newRewards);
    }

    function _maxUserStakeValue(address user) internal view returns (uint) {
        return stakers[user].deposit * limitsConfig.stakeLimitsMultiplier / BILLION;
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

       // TODO: Use decimals for reward token price
       uint rewardTokenAmount = amount * limitsConfig.rewardTokenPrice / BILLION;
       if (mainConfig.rewardToken == address(0)) {
           rewardsBank.withdrawAmb(payable(user), amount);
       } else {
           rewardsBank.withdrawErc20(mainConfig.rewardToken, payable(user), rewardTokenAmount);
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

    receive() external payable {}
}
