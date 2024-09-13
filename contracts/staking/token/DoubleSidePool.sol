//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

import "hardhat/console.sol";

//The side defined by the address of the token. Zero address means native coin
contract DoubleSidePool  is Initializable, AccessControl, IOnBlockListener {

  struct MainSideConfig {
        address token;
        address rewardToken;
        uint rewardTokenPrice;
        uint minStakeValue;
        uint unstakeLockPeriod;
        uint fastUnstakePenalty;
        uint lockPeriod;
        uint interest;
        uint interestRate;
    }

    struct DependantSideConfig {
        address token;
        address rewardToken;
        uint rewardTokenPrice;
        uint minStakeValue;
        uint unstakeLockPeriod; // Time in seconds to how long the amount is locker after unstake
        uint fastUnstakePenalty;
        uint lockPeriod;
        uint interest;
        uint interestRate;
        uint maxTotalStakeValue;
        uint maxStakePerUserValue;
        uint stakeLockPeriod; // Time in seconds to how long the stake is locker before unstake
        uint stakeLimitsMultiplier;
    }

    struct SideInfo {
        uint totalStake;
        uint totalRewards;
        uint lastInterestUpdate;
        uint totalRewardsDebt;
    }

    struct SideStaker {
        uint stake;
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
    bool public hasSecondSide;

    MainSideConfig public mainSideConfig;
    SideInfo public mainSideInfo;
    DependantSideConfig public dependantSideConfig;
    SideInfo public dependantSideInfo;

    mapping(address => SideStaker) public mainSideStakers;
    mapping(address => SideStaker) public dependantSideStakers;

    //EVENTS

    event Deactivated();
    event Activated();
    event MinStakeValueChanged(bool dependant, uint minStakeValue);
    event UnstakeLockePeriodChanged(bool dependant, uint period);
    event RewardTokenPriceChanged(bool dependant, uint price);
    event FastUnstakePenaltyChanged(bool dependant, uint penalty);
    event InterestChanged(bool dependant, uint interest);
    event InterestRateChanged(bool dependant, uint interestRate);

    event MaxTotalStakeValueChanged(uint poolMaxStakeValue);
    event MaxStakePerUserValueChanged(uint maxStakePerUserValue);
    event StakeLockPeriodChanged(uint period);
    event StakeLimitsMultiplierChanged(uint value);

    event StakeChanged(bool dependant, address indexed user, uint amount);
    event Claim(bool dependant, address indexed user, uint amount);
    event Interest(bool dependant, uint amount);
    event UnstakeLocked(bool dependant, address indexed user, uint amount, uint unlockTime, uint creationTime);
    event UnstakeFast(bool dependant, address indexed user, uint amount, uint penalty);

    function initialize(
        RewardsBank rewardsBank_, LockKeeper lockkeeper_, string memory name_,
        MainSideConfig memory mainSideConfig_
    ) public  initializer {
        lockKeeper = lockkeeper_;
        rewardsBank = rewardsBank_;
        name = name_;
        active = true;
        hasSecondSide = false;

        mainSideConfig = mainSideConfig_;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // OWNER METHODS

    function addDependantSide(DependantSideConfig calldata config_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!hasSecondSide, "Second side already exists");
        hasSecondSide = true;
        dependantSideConfig = config_;
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

    // SETTERS FOR PARAMS

    function setMinStakeValue(bool dependant, uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dependant) {
            dependantSideConfig.minStakeValue = value;
        } else {
            mainSideConfig.minStakeValue = value;
        }
        emit MinStakeValueChanged(dependant, value);
    }

    function setInterest(bool dependant, uint _interest, uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dependant) {
            dependantSideConfig.interest = _interest;
            dependantSideConfig.interestRate = _interestRate;
        } else {
            mainSideConfig.interest = _interest;
            mainSideConfig.interestRate = _interestRate;
        }
        emit InterestRateChanged(dependant, _interestRate);
        emit InterestChanged(dependant, _interest);
    }

    function setUnstakeLockPeriod(bool dependant, uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dependant) {
            dependantSideConfig.unstakeLockPeriod = period;
        } else {
            mainSideConfig.unstakeLockPeriod = period;
        }
        emit UnstakeLockePeriodChanged(dependant, period);
    }

    function setRewardTokenPrice(bool dependant, uint price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dependant) {
            dependantSideConfig.rewardTokenPrice = price;
        } else {
            mainSideConfig.rewardTokenPrice = price;
        }
        emit RewardTokenPriceChanged(dependant, price);
    }

    function setFastUnstakePenalty(bool dependant, uint penalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        if (dependant) {
            dependantSideConfig.fastUnstakePenalty = penalty;
        } else {
            mainSideConfig.fastUnstakePenalty = penalty;
        }
        emit FastUnstakePenaltyChanged(dependant, penalty);
    }

    function setMaxTotalStakeValue(uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        dependantSideConfig.maxTotalStakeValue = value;
        emit MaxTotalStakeValueChanged(value);
    }

    function setStakeLockPeriod(uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        dependantSideConfig.stakeLockPeriod = period;
        emit StakeLockPeriodChanged(period);
    }

    function setStakeLimitsMultiplier(uint value) public onlyRole(DEFAULT_ADMIN_ROLE) {
        dependantSideConfig.stakeLimitsMultiplier = value;
        emit StakeLimitsMultiplierChanged(value);
    }

    //TODO: Add more setters 

    // PUBLIC METHODS

    function stake(bool dependant, uint amount) public {
        if (dependant) {
            _stakeDependantSide(msg.sender, amount);
        } else {
            _stakeMainSide(msg.sender, amount);
        }
    }

    function unstake(bool dependant, uint amount) public {
        if (dependant) {
            _unstakeDependantSide(msg.sender, amount);
        } else {
            _unstakeMainSide(msg.sender, amount);
        }
    }

    function unstakeFast(bool dependant, uint amount) public {
        if (dependant) {
            _unstakeFastDependantSide(msg.sender, amount);
        } else {
            _unstakeFastMainSide(msg.sender, amount);
        }
    }

    function claim(bool dependant) public {
        if (dependant) {
            _calcClaimableRewards(true, msg.sender);
            _claimRewards(true, msg.sender);
        } else {
            _calcClaimableRewards(false, msg.sender);
            _claimRewards(false, msg.sender);
        }
    }

    function onBlock() external {
        _addInterestMainSide();
        _addInterestDependantSide();
    }

    // VIEW METHODS

    function getMainSideConfig() public view returns (MainSideConfig memory) {
        return mainSideConfig;
    }

    function getMainSideInfo() public view returns (SideInfo memory) {
        return mainSideInfo;
    }

    function getMainSideStaker(address user) public view returns (SideStaker memory) {
        return mainSideStakers[user];
    }

    function getDependantSideConfig() public view returns (DependantSideConfig memory) {
        return dependantSideConfig;
    }
    
    function getDependantSideInfo() public view returns (SideInfo memory) {
        return dependantSideInfo;
    }

    function getDependantSideStaker(address user) public view returns (SideStaker memory) {
        return dependantSideStakers[user];
    }

    function getUserMainSideRewards(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(false, mainSideStakers[user].stake);
        if (rewardsAmount + mainSideStakers[user].claimableRewards <= mainSideStakers[user].rewardsDebt) 
            return 0;

        return rewardsAmount + mainSideStakers[user].claimableRewards - mainSideStakers[user].rewardsDebt;
    }

    function getUserDependantSideRewards(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(false, dependantSideStakers[user].stake);
        if (rewardsAmount + dependantSideStakers[user].claimableRewards <= dependantSideStakers[user].rewardsDebt) 
            return 0;

        return rewardsAmount + dependantSideStakers[user].claimableRewards - dependantSideStakers[user].rewardsDebt;
    }

    // INTERNAL METHODS

    // MAIN SIDE METHODS

    function _addInterestMainSide() internal {
        if (mainSideInfo.lastInterestUpdate + mainSideConfig.interestRate > block.timestamp) return;
        uint timePassed = block.timestamp - mainSideInfo.lastInterestUpdate;
        uint newRewards = mainSideInfo.totalStake * mainSideConfig.interest * timePassed / BILLION / mainSideConfig.interestRate;

        mainSideInfo.totalRewards += newRewards;
        mainSideInfo.lastInterestUpdate = block.timestamp;
        emit Interest(false, newRewards);
    }


    function _stakeMainSide(address user, uint amount) internal {
        require(active, "Pool is not active");
        require(amount >= mainSideConfig.minStakeValue, "Pool: stake value is too low");
        if (msg.value != 0) {
            require(mainSideConfig.token == address(0), "Pool: does not accept native coin");
            require(msg.value == amount, "Pool: wrong amount of native coin");
        } else {
            SafeERC20.safeTransferFrom(IERC20(mainSideConfig.token), msg.sender, address(this), amount);
        }

        uint rewardsAmount = _calcRewards(false, amount);

        mainSideStakers[msg.sender].stake += amount;
        mainSideStakers[msg.sender].stakedAt = block.timestamp;
        mainSideInfo.totalStake += amount;

        mainSideInfo.totalRewards += rewardsAmount;

        _updateRewardsDebt(false, user, _calcRewards(false, mainSideStakers[user].stake));
        emit StakeChanged(false, msg.sender, amount);
    }


    function _unstakeMainSide(address user, uint amount) internal {
        require(mainSideStakers[msg.sender].stake >= amount, "Not enough stake");

        uint rewardsAmount = _calcRewards(false, amount);

        mainSideStakers[msg.sender].stake -= amount;
        mainSideInfo.totalStake -= amount;

        mainSideInfo.totalRewards -= rewardsAmount;
        _updateRewardsDebt(false, user, _calcRewards(false, mainSideStakers[user].stake));

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(mainSideStakers[msg.sender].lockedWithdrawal).totalClaims > 0) // prev lock exists
            canceledAmount = lockKeeper.cancelLock(mainSideStakers[msg.sender].lockedWithdrawal);

        if (mainSideConfig.token == address(0)) {
            payable(msg.sender).transfer(amount - canceledAmount);
        } else {
            IERC20(mainSideConfig.token).approve(address(lockKeeper), amount - canceledAmount);
        }

        // lock funds
        mainSideStakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle(
            msg.sender, address(mainSideConfig.token), uint64(block.timestamp + mainSideConfig.lockPeriod), amount + canceledAmount,
            string(abi.encodePacked("TokenStaking unstake: ", _addressToString(address(mainSideConfig.token))))
        );

        _claimRewards(false, msg.sender);

        emit UnstakeLocked(false, msg.sender, amount + canceledAmount, block.timestamp + mainSideConfig.lockPeriod, block.timestamp);
        emit StakeChanged(false, msg.sender, mainSideStakers[msg.sender].stake);
    }


    function _unstakeFastMainSide(address user, uint amount) internal {
        require(mainSideStakers[msg.sender].stake >= amount, "Not enough stake");

        uint rewardsAmount = _calcRewards(false, amount);

        mainSideStakers[msg.sender].stake -= amount;
        mainSideInfo.totalStake -= amount;

        mainSideInfo.totalRewards -= rewardsAmount;
        _updateRewardsDebt(false, user, _calcRewards(false, mainSideStakers[user].stake));

        uint penalty = amount * mainSideConfig.fastUnstakePenalty / BILLION;
        if (mainSideConfig.token == address(0)) {
            payable(msg.sender).transfer(amount - penalty);
        } else {
            SafeERC20.safeTransfer(IERC20(mainSideConfig.token), msg.sender, amount - penalty);
        }

        _claimRewards(false, msg.sender);

        emit UnstakeFast(false, msg.sender, amount, penalty);
        emit StakeChanged(false, msg.sender, amount);
    }

    // DEPENDANT SIDE METHODS

    function _addInterestDependantSide() internal {
        if (dependantSideInfo.lastInterestUpdate + dependantSideConfig.interestRate > block.timestamp) return;
        uint timePassed = block.timestamp - dependantSideInfo.lastInterestUpdate;
        uint newRewards = dependantSideInfo.totalStake * dependantSideConfig.interest * timePassed / BILLION / dependantSideConfig.interestRate;

        dependantSideInfo.totalRewards += newRewards;
        dependantSideInfo.lastInterestUpdate = block.timestamp;
        emit Interest(true, newRewards);
    }

    function _stakeDependantSide(address user, uint amount) internal {
        require(active, "Pool is not active");
        require(amount >= dependantSideConfig.minStakeValue, "Pool: stake value is too low");
        if (msg.value != 0) {
            require(mainSideConfig.token == address(0), "Pool: does not accept native coin");
            require(msg.value == amount, "Pool: wrong amount of native coin");
        } else {
            SafeERC20.safeTransferFrom(IERC20(mainSideConfig.token), msg.sender, address(this), amount);
        }

        uint rewardsAmount = _calcRewards(true, amount);

        dependantSideStakers[msg.sender].stake += amount;
        dependantSideInfo.totalStake += amount;

        require(dependantSideInfo.totalStake <= dependantSideConfig.maxTotalStakeValue, "Pool: max stake value exceeded");
        require(dependantSideStakers[msg.sender].stake <= _maxUserStakeValue(msg.sender), "Pool: user max stake value exceeded");
        require(dependantSideStakers[msg.sender].stake <= dependantSideConfig.maxStakePerUserValue, "Pool: max stake per user exceeded");

        dependantSideInfo.totalRewards += rewardsAmount;

        _updateRewardsDebt(true, user, _calcRewards(true, mainSideStakers[user].stake));
        emit StakeChanged(true, msg.sender, amount);
    }

    function _unstakeDependantSide(address user, uint amount) internal {
        require(dependantSideStakers[msg.sender].stake >= amount, "Not enough stake");
        require(block.timestamp - dependantSideStakers[msg.sender].stakedAt >= dependantSideConfig.stakeLockPeriod, "Stake is locked");

        uint rewardsAmount = _calcRewards(true, amount);

        dependantSideStakers[msg.sender].stake -= amount;
        dependantSideInfo.totalStake -= amount;

        dependantSideInfo.totalRewards -= rewardsAmount;
        _updateRewardsDebt(true, user, _calcRewards(true, dependantSideStakers[user].stake));

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(dependantSideStakers[msg.sender].lockedWithdrawal).totalClaims > 0) // prev lock exists
            canceledAmount = lockKeeper.cancelLock(dependantSideStakers[msg.sender].lockedWithdrawal);

        if (mainSideConfig.token == address(0)) {
            payable(msg.sender).transfer(amount - canceledAmount);
        } else {
            IERC20(mainSideConfig.token).approve(address(lockKeeper), amount - canceledAmount);
        }

        // lock funds
        dependantSideStakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle(
            msg.sender, address(mainSideConfig.token), uint64(block.timestamp + dependantSideConfig.lockPeriod), amount + canceledAmount,
            string(abi.encodePacked("TokenStaking unstake: ", _addressToString(address(dependantSideConfig.token))))
        );

        _claimRewards(true, msg.sender);

        emit UnstakeLocked(true, msg.sender, amount + canceledAmount, block.timestamp + mainSideConfig.lockPeriod, block.timestamp);
        emit StakeChanged(true, msg.sender, dependantSideStakers[msg.sender].stake);

    }
    
    function _unstakeFastDependantSide(address user, uint amount) internal {
        require(dependantSideStakers[msg.sender].stake >= amount, "Not enough stake");
        require(block.timestamp - dependantSideStakers[msg.sender].stakedAt >= dependantSideConfig.stakeLockPeriod, "Stake is locked");

        uint rewardsAmount = _calcRewards(true, amount);

        dependantSideStakers[msg.sender].stake -= amount;
        dependantSideInfo.totalStake -= amount;

        dependantSideInfo.totalRewards -= rewardsAmount;
        _updateRewardsDebt(true, user, _calcRewards(true, dependantSideStakers[user].stake));

        uint penalty = amount * dependantSideConfig.fastUnstakePenalty / BILLION;
        if (dependantSideConfig.token == address(0)) {
            payable(msg.sender).transfer(amount - penalty);
        } else {
            SafeERC20.safeTransfer(IERC20(dependantSideConfig.token), msg.sender, amount - penalty);
        }

        _claimRewards(true, msg.sender);

        emit UnstakeFast(true, msg.sender, amount, penalty);
        emit StakeChanged(true, msg.sender, amount);
    }

    function _maxUserStakeValue(address user) internal view returns (uint) {
        return mainSideStakers[user].stake * dependantSideConfig.stakeLimitsMultiplier / BILLION;
    }

    //COMMON METHODS

    // store claimable rewards
    function _calcClaimableRewards(bool dependant, address user) internal {
        if (dependant) {
            uint rewardsAmount = _calcRewards(dependant, dependantSideStakers[user].stake);
            uint rewardsWithoutDebt = rewardsAmount - dependantSideStakers[user].rewardsDebt;
            dependantSideStakers[user].claimableRewards += rewardsWithoutDebt;
            dependantSideInfo.totalRewardsDebt += rewardsWithoutDebt;
            dependantSideStakers[user].rewardsDebt += rewardsWithoutDebt;
        } else {
            uint rewardsAmount = _calcRewards(dependant, mainSideStakers[user].stake);
            uint rewardsWithoutDebt = rewardsAmount - mainSideStakers[user].rewardsDebt;
            mainSideStakers[user].claimableRewards += rewardsWithoutDebt;
            mainSideInfo.totalRewardsDebt += rewardsWithoutDebt;
            mainSideStakers[user].rewardsDebt += rewardsWithoutDebt;
        }
    }

    function _claimRewards(bool dependant, address user) internal {
        if (dependant) {
            uint amount = dependantSideStakers[user].claimableRewards;
            if (amount == 0) return;

            dependantSideStakers[user].claimableRewards = 0;

            uint rewardTokenAmount = amount * dependantSideConfig.rewardTokenPrice;
            if (dependantSideConfig.rewardToken == address(0)) {
                rewardsBank.withdrawAmb(payable(user), amount);
            } else {
                rewardsBank.withdrawErc20(dependantSideConfig.rewardToken, payable(user), rewardTokenAmount);
            }
            emit Claim(true, user, rewardTokenAmount);
        } else {
            uint amount = mainSideStakers[user].claimableRewards;
            if (amount == 0) return;

            mainSideStakers[user].claimableRewards = 0;

            uint rewardTokenAmount = amount * mainSideConfig.rewardTokenPrice;
            if (mainSideConfig.rewardToken == address(0)) {
                rewardsBank.withdrawAmb(payable(user), amount);
            } else {
                rewardsBank.withdrawErc20(mainSideConfig.rewardToken, payable(user), rewardTokenAmount);
            }
            emit Claim(false, user, rewardTokenAmount);
        }
    }

    function _calcRewards(bool dependant, uint amount) internal view returns (uint) {
        if (dependant) {
            if (dependantSideInfo.totalStake == 0 && dependantSideInfo.totalRewards == 0) return amount;
            amount * dependantSideInfo.totalRewards / dependantSideInfo.totalStake;
        } else {
            if (mainSideInfo.totalStake == 0 && mainSideInfo.totalRewards == 0) return amount;
            amount * mainSideInfo.totalRewards / mainSideInfo.totalStake;
        }
    }


    function _updateRewardsDebt(bool dependant, address user, uint newDebt) internal {
        if (dependant) {
            uint oldDebt = dependantSideStakers[user].rewardsDebt;
            if (newDebt < oldDebt) dependantSideInfo.totalRewardsDebt -= oldDebt - newDebt;
            else dependantSideInfo.totalRewardsDebt += newDebt - oldDebt;
            dependantSideStakers[user].rewardsDebt = newDebt;
        } else {
            uint oldDebt = mainSideStakers[user].rewardsDebt;
            if (newDebt < oldDebt) mainSideInfo.totalRewardsDebt -= oldDebt - newDebt;
            else mainSideInfo.totalRewardsDebt += newDebt - oldDebt;
            mainSideStakers[user].rewardsDebt = newDebt;
        }
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
