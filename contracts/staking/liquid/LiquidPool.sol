// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../../funds/RewardsBank.sol";
import "./StAMB.sol";
import "./StakingTiers.sol";
import "./LiquidNodeManager.sol";

contract LiquidPool is UUPSUpgradeable, AccessControlUpgradeable {
    uint constant private MILLION = 1000000;

    LiquidNodeManager public nodeManager;
    RewardsBank public rewardsBank;
    StakingTiers public tiers;
    address public bondAddress;
    StAMB public stAmb;

    bool public active;
    uint public totalStake;
    uint public minStakeValue;
    uint public lockPeriod;

    uint public interest;  // user will get interest % of his stake
    uint public interestPeriod;  // period in seconds for interest calculation
    // userReward = userShare * (interest/1e6) * (timePassed / interestPeriod)

    mapping (address => uint) public rewards;
    mapping (address => uint) private _lastChanged;


    event StakeChanged(address indexed account, int amount);
    event Claim(address indexed account, uint ambAmount, uint bondAmount);


   function initialize(
       LiquidNodeManager nodeManager_, RewardsBank rewardsBank_, StakingTiers tiers_,
       uint interest_, uint interestPeriod_,uint minStakeValue_,
       address bondAddress_, uint lockPeriod_
   ) public initializer {
       require(minStakeValue_ > 0, "Pool min stake value is zero");
       require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");

       nodeManager = nodeManager_;
       rewardsBank = rewardsBank_;
       bondAddress = bondAddress_;
       tiers = tiers_;

       interest = interest_;
       interestPeriod = interestPeriod_;

       minStakeValue = minStakeValue_;
       lockPeriod = lockPeriod_;
       active = true;

       stAmb = new StAMB(this);

       __AccessControl_init();
       _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
   }



    // ADMIN METHODS

    function setInterest(uint interest_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");
        interest = interest_;
    }

    function setInterestRate(uint interestRate_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interestPeriod = interestRate_;
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

        stAmb.mint(msg.sender, msg.value);
        totalStake += msg.value;
        emit StakeChanged(msg.sender, int(msg.value));
        nodeManager.requestNodeCreation();
    }

    function unstake(uint amount) public {
        require(amount <= stAmb.balanceOf(msg.sender), "Sender has not enough tokens");
        require(amount <= totalStake, "Total stake is less than deposit");

        uint tier = tiers.getTier(msg.sender);
        if (rewards[msg.sender] > 0) {
            _claim(msg.sender, tier);
        }

        stAmb.burn(msg.sender, amount);
        while (address(this).balance < amount) {
            nodeManager.requestNodeRetirement();
        }
        totalStake -= amount;

        // todo lock like in server nodes manager
        payable(msg.sender).transfer(amount);

        emit StakeChanged(msg.sender, - int(amount));
    }

    function claim(uint desiredCoeff) public {
        _claim(msg.sender, desiredCoeff);
    }

    // stAMB methods

    function afterTokenTransfer(address from, address to, uint256 amount) external {
        require(msg.sender == address(stAmb), "Only stAMB can call this method");
        _onUserAPYChanged(from);
        _onUserAPYChanged(to);
    }


    // VIEW METHODS

    function getStake() public view returns (uint) {
        return stAmb.balanceOf(msg.sender);
    }

    function getInterest() public view returns (uint) {
        return interest;
    }

    function getLockPeriod() public view returns (uint) {
        return lockPeriod;
    }



    // PRIVATE METHODS


    function _onUserAPYChanged(address account) private {
        uint userReward = _calculateUserReward(account);
        rewards[account] += userReward;
        _lastChanged[account] = block.timestamp;
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
        uint timePassed = block.timestamp - _lastChanged[account];
        return stAmb.balanceOf(account) * interest * timePassed / MILLION / interestPeriod;
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}


}
