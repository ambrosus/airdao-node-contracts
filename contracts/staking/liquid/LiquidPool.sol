// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "../../funds/RewardsBank.sol";
import "./StAMB.sol";
import "./StakingTiers.sol";
import "./LiquidNodesManager.sol";

contract LiquidPool is UUPSUpgradeable, AccessControlUpgradeable {
    uint constant private MILLION = 1000000;

    LiquidNodesManager public nodeManager;
    RewardsBank public rewardsBank;
    StakingTiers public tiers;
    address public bondAddress;
    StAMB public stAmb;

    bool public active;
    uint public minStakeValue;
    uint public lockPeriod;

    uint public interest;  // user will get interest % of his stake
    uint public interestPeriod;  // period in seconds for interest calculation
    // reward = balance * (interest/1e6) * (timePassed / interestPeriod)

    uint internal totalRewards;
    uint internal totalRewardsLastChanged;

    mapping(address => uint) internal unclaimedUserRewards;


    event StakeChanged(address indexed account, int amount);
    event Claim(address indexed account, uint ambAmount, uint bondAmount);


    function initialize(
        LiquidNodesManager nodeManager_, RewardsBank rewardsBank_, StakingTiers tiers_,
        address bondAddress_, StAMB stAmb_,
        uint interest_, uint interestPeriod_, uint minStakeValue_, uint lockPeriod_
    ) public initializer {
        require(minStakeValue_ > 0, "Pool min stake value is zero");
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");

        nodeManager = nodeManager_;
        rewardsBank = rewardsBank_;
        tiers = tiers_;
        bondAddress = bondAddress_;
        stAmb = stAmb_;

        interest = interest_;
        interestPeriod = interestPeriod_;

        minStakeValue = minStakeValue_;
        lockPeriod = lockPeriod_;

        active = true;

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
        require(active, "Pool is not active");  // todo as modifier
        require(msg.value >= minStakeValue, "Pool: stake value too low");

        _beforeUserStakeChanged(msg.sender);
        totalRewards += msg.value;

        stAmb.mint(msg.sender, msg.value);
        nodeManager.stake{value: msg.value}();


        emit StakeChanged(msg.sender, int(msg.value));
    }

    function unstake(uint amount, uint desiredCoeff) public {
        require(amount <= getStake(msg.sender), "Sender has not enough tokens");

        _beforeUserStakeChanged(msg.sender);
        stAmb.burn(msg.sender, amount);

        nodeManager.unstake(amount);

        // todo lock like in server nodes manager
        payable(msg.sender).transfer(amount);


        _claim(msg.sender, desiredCoeff);

        emit StakeChanged(msg.sender, - int(amount));
    }

    function claim(uint desiredCoeff) public {
        _claim(msg.sender, desiredCoeff);
    }

    // external methods

    // this method is called by stAMB contract before token transfer
    // it's used to calculate user rewards before his stake changes
    // it's also called on mint and burn
    function beforeTokenTransfer(address from, address to, uint256 amount) external {
        require(msg.sender == address(stAmb), "Only stAMB can call this method");
        if (from != address(0))
            _beforeUserStakeChanged(from);
        if (to != address(0))
            _beforeUserStakeChanged(to);
    }

    function tryInterest() external {
        if (totalRewardsLastChanged + interestPeriod < block.timestamp)
            _addInterestToDeposit();
    }

    // VIEW METHODS

    function getTotalRewards() public view returns (uint) {
        return address(this).balance;
    }

    function getTotalStAmb() public view returns (uint) {
        return stAmb.totalSupply();
    }

    // return price multiplied by MILLION
    function getTokenPrice() public view returns (uint) {
        return getTotalRewards() * MILLION / _getTotalStAmb();
    }

    function getStake(address user) public view returns (uint) {
        return stAmb.balanceOf(user);
    }

    function getClaimAmount(address user) public view returns (uint) {
        (, uint rewards) = _getUserRewards(user);
        return rewards;
    }

    // PRIVATE METHODS

    function _getTotalStAmb() internal view returns (uint) {
        if (stAmb.totalSupply() == 0) return 1;
        return stAmb.totalSupply();
    }


    function _addInterestToDeposit() internal {
        uint timePassed = block.timestamp - totalRewardsLastChanged;
        uint newRewards = getTotalRewards() * interest * timePassed / MILLION / _getTotalStAmb();

        totalRewards += newRewards;
        totalRewardsLastChanged = block.timestamp;
    }


    function _beforeUserStakeChanged(address user) private {
        (uint newRewards,) = _getUserRewards(user);

        unclaimedUserRewards[user] += newRewards;
        totalRewards -= newRewards;
    }


    function _claim(address user, uint desiredCoeff) private {
        require(tiers.isTierAllowed(user, desiredCoeff), "User tier is too low");

        (, uint amount) = _getUserRewards(user);
//        require(amount > 0, "No rewards to claim");
        if (amount == 0) return;

        totalRewards -= amount;
        unclaimedUserRewards[user] = 0;

        uint bondAmount = amount * desiredCoeff / MILLION;
        uint ambAmount = amount - bondAmount;

        rewardsBank.withdrawAmb(payable(user), ambAmount);
        rewardsBank.withdrawErc20(bondAddress, payable(user), bondAmount);

        emit Claim(user, ambAmount, bondAmount);
    }


    function _getUserRewards(address user) internal view returns (uint rewardsNew, uint rewardsTotal) {
        uint stAmbAmount = getStake(user);
        if (stAmbAmount < 1) return (0, 0);

        rewardsNew = (stAmbAmount * getTotalRewards() / _getTotalStAmb()) - stAmbAmount;
        rewardsTotal = unclaimedUserRewards[user] + rewardsNew;
    }


    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}


}
