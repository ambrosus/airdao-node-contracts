//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./ITokenPool.sol";
import "../../funds/RewardsBank.sol";

contract TokenPool is Initializable, AccessControl, ITokenPool {
    uint constant public MILLION = 1_000_000;
    
    ERC20 public token;
    RewardsBank public bank;

    string public name;
    uint public minStakeValue;
    uint public totalStake;
    bool public active;
    address public rewardToken;
    uint public rewardTokenPrice; // The coefficient to calculate the reward token amount

    uint public interest;
    uint public interestRate; //Time in seconds to how often the stake is increased

    mapping(address => uint) public stakes;
    mapping(address => uint) public rewards;
    mapping(address => uint) private _lastChanged;

    function initialize(
        string memory name_, address token_, RewardsBank rewardsBank_, uint intereset_, 
        uint interestRate_, uint minStakeValue_, address rewardToken_, uint rewardTokenPrice_
    ) public  initializer {
        token = ERC20(token_);
        bank = rewardsBank_;

        name = name_;
        minStakeValue = minStakeValue_;
        active = true;
        rewardToken = rewardToken_;
        rewardTokenPrice = rewardTokenPrice_;

        interest = intereset_; 
        interestRate = interestRate_;
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

    // PUBLIC METHODS

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= minStakeValue, "Amount is less than minStakeValue");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        _storeReward(msg.sender);

        stakes[msg.sender] += amount;
        totalStake += amount;

        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(stakes[msg.sender] >= amount, "Not enough stake");

        _storeReward(msg.sender);

        totalStake -= amount;
        stakes[msg.sender] -= amount;

        // If all stake is withdrawn, claim rewards
        if (stakes[msg.sender] == 0 && rewards[msg.sender] > 0) {
            _claim(msg.sender);
        }

        require(token.transfer(msg.sender, stakes[msg.sender]), "Transfer failed");
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

    function getReward(address user) public view returns (uint) {
        uint unstoredReward = _calculateRewards(user);
        return rewards[user] + unstoredReward;
    }

    // INTERNAL METHODS

    function _claim(address user) internal {
        _storeReward(user);
        uint rewardAmount = rewards[user];
        require(rewardAmount > 0, "No rewards to claim");

        bank.withdrawErc20(rewardToken, user, rewardAmount);
        emit RewardClaimed(user, rewardAmount);
    }

    function _storeReward(address user) internal {
        uint rewardAmount = _calculateRewards(user);
        rewards[user] += rewardAmount;
        _lastChanged[user] = block.timestamp;
    }

    function _calculateRewards(address user) internal view returns (uint) {
        uint timePassed = block.timestamp - _lastChanged[user];
        uint reward =  stakes[user] * interest / MILLION * timePassed / interestRate;
        return reward * rewardTokenPrice;
    }
}
