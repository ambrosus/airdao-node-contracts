// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../../funds/RewardsBank.sol";
import "./StAMB.sol";
import "./RewardToken.sol";
import "./StakingTiers.sol";
import "./NodeManager.sol";

contract LiquidPool is UUPSUpgradeable, AccessControlUpgradeable, StAMB {
    uint constant private MILLION = 1000000;

    NodeManager public nodeManager;
    RewardsBank public rewardsBank;
    StakingTiers public tiers;
    bool public active;
    uint public totalStake; 
    uint public minStakeValue;
    uint public interest;
    uint public interestRate; 
    uint public lockPeriod;
    address public bondAddress;
    mapping (address => uint) private _lastChanged;
    mapping (address => uint) public rewards; 

   function initialize(
       NodeManager nodeManager_, RewardsBank rewardsBank_, StakingTiers tiers_,
       uint interest_, uint interestRate_,uint minStakeValue_,
       address bondAddress_, uint lockPeriod_ 
   ) public initializer {
       require(minStakeValue_ > 0, "Pool min stake value is zero");
       require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");

       nodeManager = nodeManager_;
       rewardsBank = rewardsBank_;
       tiers = tiers_;
       interest = interest_;
       interestRate = interestRate_;
       minStakeValue = minStakeValue_;
       bondAddress = bondAddress_;
       lockPeriod = lockPeriod_;
       active = true;

       __StAMB_init();
       __AccessControl_init();
       _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
   }


    event StakeChanged(address indexed account, int amount);
    event Claim(address indexed account, uint ambAmount, uint bondAmount);

    // OWNER METHODS
    function setInterest(uint interest_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");
        interest = interest_;
    }

    function setInterestRate(uint interestRate_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interestRate = interestRate_;
    }

    function activate() public payable onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!active, "Pool is already active");
        active = true;
    }

    function deactivate(uint maxNodes) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(active, "Pool is not active");
    }

    function setLockPeriod(uint lockPeriod_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        lockPeriod = lockPeriod_;
    }
    
    // PUBLIC METHODS

    function stake() public payable {
        require(active, "Pool is not active");
        require(msg.value >= minStakeValue, "Pool: stake value too low");

        mint(msg.sender, msg.value);
        totalStake += msg.value;
        emit StakeChanged(msg.sender, int(msg.value)); 
        nodeManager.requestNodeCreation();
    }

    function unstake(uint amount) public {
        require(amount <= balanceOf(msg.sender), "Sender has not enough tokens");
        require(amount <= totalStake, "Total stake is less than deposit");
        require(obtainedAt(msg.sender) + lockPeriod < block.timestamp, "Lock period is not expired");

        uint tier = tiers.getTier(msg.sender);
        if (rewards[msg.sender] > 0) {
            _claim(msg.sender, tier); 
        }

        burn(msg.sender, amount);
        while (address(this).balance < amount) {
            nodeManager.requestNodeRetirement();
        }
        totalStake -= amount;
        payable(msg.sender).transfer(amount);
        emit StakeChanged(msg.sender, - int(amount));    
    }

    function claim(uint desiredCoeff) public {
        _claim(msg.sender, desiredCoeff); 
    }
   
    // PRIVATE METHODS

    function _onTransfer() internal override {
        require(balanceOf(msg.sender) != 0, "Stake is zero");
        uint userReward = _calculateUserReward(msg.sender);
        rewards[msg.sender] += userReward;
        _lastChanged[msg.sender] = block.timestamp;
    }

    
    function _claim(address account, uint desiredCoeff) private {
        uint amount = rewards[account];
        require(amount > 0, "No rewards to claim");
         
        uint tier = tiers.getTier(account);
        if (tier == 0) {
            tiers.setTier(account, 750000);
            tier = 750000;
        }
        require(tier >= desiredCoeff, "User tier is too low");
        uint bondAmount = amount * tier / MILLION;
        uint ambAmount = amount - bondAmount;
        rewardsBank.withdrawAmb(payable(account), ambAmount);
        rewardsBank.withdrawErc20(bondAddress, payable(account), bondAmount);
        rewards[account] -= amount;
        emit Claim(account, ambAmount, bondAmount);
    }

    function _calculateUserReward(address account) private returns (uint) {
        uint yield = balanceOf(account) * interest / MILLION;
        uint yieldPerSecond = yield / interestRate;

        uint timePassed = block.timestamp - _lastChanged[account];
        uint yieldForPeriod = yieldPerSecond * timePassed;
        return yieldForPeriod;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

   // VIEW METHODS

    function getStake() public view returns (uint) {
        return balanceOf(msg.sender);
    }

    function getInterest() public view returns (uint) {
        return interest;
    }

    function getLockPeriod() public view returns (uint) {
        return lockPeriod;
    }
 
    receive() external payable {
        stake();
    }

}
