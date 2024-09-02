//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

import "hardhat/console.sol";

contract TokenPool is Initializable, AccessControl, IOnBlockListener {
    uint constant public MILLION = 1_000_000;
    
    IERC20 public token;
    RewardsBank public rewardsBank;
    LockKeeper public lockKeeper;

    string public name;
    uint public minStakeValue;
    uint public fastUnstakePenalty;
    uint public interest;
    uint public interestRate; //Time in seconds to how often the stake is increased
    uint public lockPeriod;
    address public rewardToken;
    uint public rewardTokenPrice; // The coefficient to calculate the reward token amount

    bool public active;
    uint public totalStake;
    uint public totalRewards;

    uint private lastInterestUpdate;
    uint private totalRewardsDebt;

    mapping(address => uint) public stakes;
    mapping(address => uint) private rewardsDebt;
    mapping(address => uint) private claimableRewards;
    mapping(address => uint) private lockedWithdrawals;

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

    function initialize(
        address token_, RewardsBank rewardsBank_, LockKeeper lockkeeper_, string memory name_, uint minStakeValue_,
        uint fastUnstakePenalty_, uint intereset_, uint interestRate_, uint lockPeriod_, address rewardToken_, uint rewardTokenPrice_
    ) public  initializer {
        token = IERC20(token_);
        rewardsBank = rewardsBank_;
        lockKeeper = lockkeeper_;

        name = name_;
        minStakeValue = minStakeValue_;
        fastUnstakePenalty = fastUnstakePenalty_;
        interest = intereset_; 
        interestRate = interestRate_;
        lockPeriod = lockPeriod_;
        rewardToken = rewardToken_;
        rewardTokenPrice = rewardTokenPrice_;
        lastInterestUpdate = block.timestamp;

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
        minStakeValue = value;
        emit MinStakeValueChanged(value);
    }

    function setInterest(uint _interest, uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _addInterest();
        interest = _interest;
        interestRate = _interestRate;
        emit InterestRateChanged(interest, interestRate);
    }

    function setLockPeriod(uint period) public onlyRole(DEFAULT_ADMIN_ROLE) {
        lockPeriod = period;
        emit LockPeriodChanged(period);
    }

    function setRewardTokenPrice(uint price) public onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardTokenPrice = price;
        emit RewardTokenPriceChanged(price);
    }

    function setFastUnstakePenalty(uint penalty) public onlyRole(DEFAULT_ADMIN_ROLE) {
        fastUnstakePenalty = penalty;
        emit FastUnstakePenaltyChanged(penalty);
    }

    // PUBLIC METHODS

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= minStakeValue, "Pool: stake value is too low");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        _stake(msg.sender, amount);

        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(stakes[msg.sender] >= amount, "Not enough stake");

        _unstake(msg.sender, amount);

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(lockedWithdrawals[msg.sender]).totalClaims > 0) // prev lock exists
            canceledAmount = lockKeeper.cancelLock(lockedWithdrawals[msg.sender]);

        token.approve(address(lockKeeper), amount + canceledAmount);

        // lock funds
        lockedWithdrawals[msg.sender] = lockKeeper.lockSingle(
            msg.sender, address(token), uint64(block.timestamp + lockPeriod), amount + canceledAmount,
            string(abi.encodePacked("TokenStaking unstake: ", _addressToString(address(token))))
        );

        _claimRewards(msg.sender);

        emit UnstakeLocked(msg.sender, amount + canceledAmount, block.timestamp + lockPeriod, block.timestamp);
        emit StakeChanged(msg.sender, stakes[msg.sender]);
    }

    function unstakeFast(uint amount) public {
        require(stakes[msg.sender] >= amount, "Not enough stake");

        _unstake(msg.sender, amount);

        uint penalty = amount * fastUnstakePenalty / MILLION;
        SafeERC20.safeTransfer(token, msg.sender, amount - penalty);

        _claimRewards(msg.sender);

        emit UnstakeFast(msg.sender, amount, penalty);
        emit StakeChanged(msg.sender, stakes[msg.sender]);
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

    function getStake(address user) public view returns (uint) {
        return stakes[user];
    }

    function getInterest() public view returns (uint) {
        return interest;
    }

    function getInterestRate() public view returns (uint) {
        return interestRate;
    }

    function getUserRewards(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(stakes[user]);
        if (rewardsAmount + claimableRewards[user] <= rewardsDebt[user]) 
            return 0;

        return rewardsAmount + claimableRewards[user] - rewardsDebt[user];
    }

    // INTERNAL METHODS

    // store claimable rewards
    function _calcClaimableRewards(address user) internal {
        uint rewardsAmount = _calcRewards(stakes[user]);
        uint rewardsWithoutDebt = rewardsAmount - rewardsDebt[user];
        claimableRewards[user] += rewardsWithoutDebt;
        totalRewardsDebt += rewardsWithoutDebt;
        rewardsDebt[user] += rewardsWithoutDebt;
    }

    function _addInterest() internal {
        if (lastInterestUpdate + interestRate > block.timestamp) return;
        uint timePassed = block.timestamp - lastInterestUpdate;
        uint newRewards = totalStake * interest * timePassed / MILLION / interestRate;

        totalRewards += newRewards;
        lastInterestUpdate = block.timestamp;
        emit Interest(newRewards);
    }

    function _stake(address user, uint amount) internal {
        uint rewardsAmount = _calcRewards(amount);

        stakes[msg.sender] += amount;
        totalStake += amount;

        totalRewards += rewardsAmount;

        _updateRewardsDebt(user, _calcRewards(stakes[user]));
    }

    function _unstake(address user, uint amount) internal {
        uint rewardsAmount = _calcRewards(amount);

        stakes[msg.sender] -= amount;
        totalStake -= amount;

        totalRewards -= rewardsAmount;
        _updateRewardsDebt(user, _calcRewards(stakes[user]));
    }

    function _updateRewardsDebt(address user, uint newDebt) internal {
        uint oldDebt = rewardsDebt[user];
        if (newDebt < oldDebt) totalRewardsDebt -= oldDebt - newDebt;
        else totalRewardsDebt += newDebt - oldDebt;
        rewardsDebt[user] = newDebt;
    }

    function _claimRewards(address user) internal {
        uint amount = claimableRewards[user];
        if (amount == 0) return;

        claimableRewards[user] = 0;

        uint rewardTokenAmount = amount * rewardTokenPrice;
        rewardsBank.withdrawErc20(rewardToken, payable(user), rewardTokenAmount);
        emit Claim(user, rewardTokenAmount);
    }

    function _calcRewards(uint amount) internal view returns (uint) {
        if (totalStake == 0 && totalRewards == 0) return amount;
        return amount * totalRewards / totalStake;
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
