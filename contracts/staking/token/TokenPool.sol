//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

contract TokenPool is Initializable, AccessControl, IOnBlockListener {

    struct MainConfig {
        IERC20 token;
        string name;
        address rewardToken; 
    }

    struct LimitsConfig {
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

    uint constant public BILLION = 1_000_000_000;

    bool public active;
    RewardsBank rewardsBank;
    LockKeeper lockKeeper;

    MainConfig public mainConfig; // immutable
    LimitsConfig public limitsConfig; // mutable
    Info public info;

    mapping(address => Staker) public stakers;

    //EVENTS

    event Deactivated();
    event Activated();
    event LimitsConfigChanged(LimitsConfig limitsConfig);
    event StakeChanged(address indexed user, uint amount);
    event Claim(address indexed user, uint amount);
    event Interest(uint amount);
    event UnstakeLocked(address indexed user, uint amount, uint unlockTime, uint creationTime);
    event UnstakeFast(address indexed user, uint amount, uint penalty);

    function initialize(RewardsBank bank_, LockKeeper keeper_, MainConfig calldata mainConfig_, LimitsConfig calldata limitsConfig_) public  initializer {
        //TODO: Should validate input params
        rewardsBank = bank_;
        lockKeeper = keeper_;
        mainConfig = mainConfig_;
        limitsConfig = limitsConfig_;

        info.lastInterestUpdate = block.timestamp;

        active = true;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // OWNER METHODS

    function setLimitsConfig(LimitsConfig calldata _limitsConfig) public onlyRole(DEFAULT_ADMIN_ROLE) {
        //TODO: Validate input params
        limitsConfig = _limitsConfig;
        emit LimitsConfigChanged(_limitsConfig);
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

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= limitsConfig.minStakeValue, "Pool: stake value is too low");
        require(mainConfig.token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

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

        mainConfig.token.approve(address(lockKeeper), amount + canceledAmount);

        // lock funds
        stakers[msg.sender].lockedWithdrawal = lockKeeper.lockSingle(
            msg.sender, address(mainConfig.token), uint64(block.timestamp + limitsConfig.lockPeriod), amount + canceledAmount,
            string(abi.encodePacked("TokenStaking unstake: ", _addressToString(address(mainConfig.token))))
        );

        _claimRewards(msg.sender);

        emit UnstakeLocked(msg.sender, amount + canceledAmount, block.timestamp + limitsConfig.lockPeriod, block.timestamp);
        emit StakeChanged(msg.sender, stakers[msg.sender].stake);
    }

    function unstakeFast(uint amount) public {
        require(stakers[msg.sender].stake >= amount, "Not enough stake");

        _unstake(msg.sender, amount);

        uint penalty = amount * limitsConfig.fastUnstakePenalty / BILLION;
        SafeERC20.safeTransfer(mainConfig.token, msg.sender, amount - penalty);

        _claimRewards(msg.sender);

        emit UnstakeFast(msg.sender, amount, penalty);
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

    function getMainConfig() public view returns (MainConfig memory) {
        return mainConfig;
    }

    function getLimitsConfig() public view returns (LimitsConfig memory) {
        return limitsConfig;
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
        if (info.lastInterestUpdate + limitsConfig.interestRate > block.timestamp) return;
        uint timePassed = block.timestamp - info.lastInterestUpdate;
        uint newRewards = info.totalStake * limitsConfig.interest * timePassed / BILLION / limitsConfig.interestRate;

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

        uint rewardTokenAmount = amount * limitsConfig.rewardTokenPrice;
        rewardsBank.withdrawErc20(mainConfig.rewardToken, payable(user), rewardTokenAmount);
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
