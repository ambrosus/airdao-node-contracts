//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./ITokenPool.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

contract TokenPool is Initializable, AccessControl, ITokenPool {
    uint constant public MILLION = 1_000_000;
    
    ERC20 public token;
    RewardsBank public bank;
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

    function initialize(
        address token_, RewardsBank rewardsBank_, LockKeeper lockkeeper_, string memory name_, uint minStakeValue_,
        uint fastUnstakePenalty_, uint intereset_, uint interestRate_, uint lockPeriod_, address rewardToken_, uint rewardTokenPrice_
    ) public  initializer {
        token = ERC20(token_);
        bank = rewardsBank_;
        lockKeeper = lockkeeper_;

        name = name_;
        minStakeValue = minStakeValue_;
        fastUnstakePenalty = fastUnstakePenalty_;
        interest = intereset_; 
        interestRate = interestRate_;
        lockPeriod = lockPeriod_;
        rewardToken = rewardToken_;
        rewardTokenPrice = rewardTokenPrice_;

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
        require(amount >= minStakeValue, "Amount is less than minStakeValue");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        _calcClaimableRewards(msg.sender);

        uint rewardsAmount = _calcRewards(amount);

        stakes[msg.sender] += amount;
        totalStake += amount;

        totalRewards += rewardsAmount;
        rewardsDebt[msg.sender] += rewardsAmount;
        totalRewardsDebt += rewardsAmount;

        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(stakes[msg.sender] >= amount, "Not enough stake");

        _calcClaimableRewards(msg.sender);

        uint rewardsAmount = _calcRewards(amount);

        stakes[msg.sender] -= amount;
        totalStake -= amount;

        totalRewards -= rewardsAmount;
        rewardsDebt[msg.sender] -= rewardsAmount;
        totalRewardsDebt -= rewardsAmount;

        // cancel previous lock (if exists). canceledAmount will be added to new lock
        uint canceledAmount;
        if (lockKeeper.getLock(lockedWithdrawals[msg.sender]).totalClaims > 0) // prev lock exists
            canceledAmount = lockKeeper.cancelLock(lockedWithdrawals[msg.sender]);

        // lock funds
        lockedWithdrawals[msg.sender] = lockKeeper.lockSingle(
            msg.sender, address(token), uint64(block.timestamp + lockPeriod), amount + canceledAmount,
            string(abi.encodePacked("TokenStaking unstake: ", _addressToString(address(token))))
        );

        emit StakeChanged(msg.sender, stakes[msg.sender]);
    }

    function unstakeFast(uint amount) public {
        require(stakes[msg.sender] >= amount, "Not enough stake");

        emit StakeChanged(msg.sender, stakes[msg.sender]);
    }

    function claim() public {
        _claim(msg.sender);
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
        //TODO: implement
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
        uint timePassed = block.timestamp - lastInterestUpdate;
        uint newRewards = totalStake * interest * timePassed / (MILLION * interestRate);

        totalRewards += newRewards;
        lastInterestUpdate = block.timestamp;
        emit InterestAdded(newRewards);
    }

    function _claim(address user) internal {
        //TODO: Implement

        bank.withdrawErc20(rewardToken, user, rewardAmount);
        emit RewardClaimed(user, rewardAmount);
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

}
