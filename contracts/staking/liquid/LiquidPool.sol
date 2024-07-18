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

    uint public minStakeValue;
    uint public lockPeriod;

    uint public interest;  // user will get interest % of his stake
    uint public interestPeriod;  // period in seconds for interest calculation
    uint internal lastInterestTime; // newReward = totalStAmb * (interest/1e6) * (timePassed / interestPeriod)

    uint internal totalRewards;  // rewards from interest, includes totalRewardsDebt, can be much greater than real rewards
    uint internal totalRewardsDebt; // real rewards = totalRewards - totalRewardsDebt
    uint256[50] __gap;

    // rewards that has been "claimed" before stake changes.
    mapping(address => uint) internal rewardsCanClaim;

    // new stakes will immediately have rewards to claim (coz of how shares works), so we need to
    // artificially decrease their stakes by some value.
    mapping(address => uint) internal rewardsDebt;



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

        lastInterestTime = block.timestamp;

        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ADMIN METHODS

    function setInterest(uint interest_, uint interestPeriod_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(interest_ >= 0 && interest_ <= 1000000, "Invalid percent value");
        interest = interest_;
        interestPeriod = interestPeriod_;
    }

    function setLockPeriod(uint lockPeriod_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        lockPeriod = lockPeriod_;
    }

    // PUBLIC METHODS

    function stake() public payable {
        require(msg.value >= minStakeValue, "Pool: stake value too low");

        _beforeUserStakeChanged(msg.sender);  // "claim" rewards before stake changes

        uint rewardsAmount = _calcRewards(msg.value);

        totalRewards += rewardsAmount;
        rewardsDebt[msg.sender] += rewardsAmount;


        stAmb.mint(msg.sender, msg.value);
        nodeManager.stake{value: msg.value}();

        emit StakeChanged(msg.sender, int(msg.value));
    }

    function unstake(uint amount, uint desiredCoeff) public {
        require(amount <= getStake(msg.sender), "Sender has not enough tokens");

        _beforeUserStakeChanged(msg.sender);  // claim rewards before stake changes

        uint rewardsAmount = _calcRewards(amount);

        totalRewards -= rewardsAmount;
        rewardsDebt[msg.sender] -= rewardsAmount;


        stAmb.burn(msg.sender, amount);
        nodeManager.unstake(amount);
        
        // todo lock like in server nodes manager
        payable(msg.sender).transfer(amount);
        
        _claimRewards(msg.sender, desiredCoeff);

        emit StakeChanged(msg.sender, - int(amount));
    }

    function claimRewards(uint desiredCoeff) public {
        _beforeUserStakeChanged(msg.sender);
        _claimRewards(msg.sender, desiredCoeff);
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

        if (from != address(0) && to != address(0)) {
            uint transferredDebt = rewardsDebt[from] * amount / getStake(from);
            rewardsDebt[from] -= transferredDebt;
            rewardsDebt[to] += transferredDebt;
        }
    }

    function tryInterest() external {
        if (lastInterestTime + interestPeriod < block.timestamp)
            _addInterestToDeposit();
    }

    // VIEW METHODS

    function getTotalRewards() public view returns (uint) {
        return totalRewards - totalRewardsDebt;
    }

    function getTotalStAmb() public view returns (uint) {
        return stAmb.totalSupply();
    }

    function getStake(address user) public view returns (uint) {
        return stAmb.balanceOf(user);
    }

    function getClaimAmount(address user) public view returns (uint) {
        uint rewardsAmount = _calcRewards(getStake(user));
        return rewardsAmount + rewardsCanClaim[user]- rewardsDebt[user];
    }


    // PRIVATE METHODS

    function _addInterestToDeposit() internal {
        uint timePassed = block.timestamp - lastInterestTime;
        uint newRewards = getTotalStAmb() * interest * timePassed / MILLION / interestPeriod;

        totalRewards += newRewards;
        lastInterestTime = block.timestamp;

        //  todo       emit Interest(newRewards);
    }


    // "claim" rewards for user before his stake changes
    function _beforeUserStakeChanged(address user) private {
        uint rewardsAmount = _calcRewards(getStake(user));
        //if (rewardsAmount == 0) return;

        rewardsCanClaim[user] += rewardsAmount - rewardsDebt[user];
        rewardsDebt[user] = rewardsAmount;
    }


    function _claimRewards(address user, uint desiredCoeff) private {
        require(desiredCoeff <= 100, "Invalid desired coeff");
        require(tiers.isTierAllowed(user, desiredCoeff), "User tier is too low");

        uint amount = rewardsCanClaim[user];
        if (amount == 0) return;

        rewardsCanClaim[user] = 0;

        uint ambAmount = amount * desiredCoeff / 100;
        uint bondAmount = amount - ambAmount;

        rewardsBank.withdrawAmb(payable(user), ambAmount);
        rewardsBank.withdrawErc20(bondAddress, payable(user), bondAmount);

        emit Claim(user, ambAmount, bondAmount);
    }

    function _calcRewards(uint stAmbAmount) internal view returns (uint) {
        if (getTotalStAmb() == 0) return 0;
        return stAmbAmount * totalRewards / getTotalStAmb();
    }


    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    receive() external payable {
        require(msg.sender == address(nodeManager), "Not allowed");
    }

}
