//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./ITokenPool.sol";
import "../../funds/RewardsBank.sol";

contract TokenPool is UUPSUpgradeable, AccessControlUpgradeable, ITokenPool {
    uint constant public MILLION = 1_000_000;
    
    ERC20 public token;
    RewardsBank public bank;

    string public name;
    uint public minStakeValue;
    uint public totalStake;
    uint public totalShare;
    bool public active;
    address public rewardToken;
    uint public rewardTokenPrice; // The coefficient to calculate the reward token amount

    uint public interest;
    uint public interestRate; //Time in seconds to how often the stake is increased
    uint public lastStakeIncrease;

    mapping(address => uint) public stakes;
    mapping(address => uint) public shares;
 
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

    function setInterest(uint _interest) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interest = _interest;
        emit InterestChanged(_interest);
    }

    function setMinStakeValue(uint _minStakeValue) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeValue = _minStakeValue;
        emit MinStakeValueChanged(_minStakeValue);
    }

    function setInterestRate(uint _interestRate) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interestRate = _interestRate;
        emit InterestRateChanged(_interestRate);
    }

    // PUBLIC METHODS

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= minStakeValue, "Amount is less than minStakeValue");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint shareAmount = _calculateShare(amount);

        shares[msg.sender] += shareAmount;
        totalStake += amount;
        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(shares[msg.sender] >= amount, "Not enough stake");

        uint tokenAmount = _calculateToken(amount);
        uint rewardAmount = tokenAmount - stakes[msg.sender];

        shares[msg.sender] -= amount;
        totalStake -= tokenAmount;

        uint rewardToPay = rewardAmount * rewardTokenPrice;

        bank.withdrawErc20(rewardToken, msg.sender, rewardToPay);

        require(token.transfer(msg.sender, stakes[msg.sender]), "Transfer failed");
        emit StakeChanged(msg.sender, tokenAmount);
    }

    function onBlock() external {
        require(active, "Pool is not active");
        if (block.timestamp > lastStakeIncrease + interestRate) {
            _increaseStake();
            lastStakeIncrease = block.timestamp;
        }
    }

    // VIEW METHODS

    function getStake(address user) public view returns (uint) {
        return _calculateToken(shares[user]);
    }

    function getShare(address user) public view returns (uint) {
        return shares[user];
    }

    function getSharePrice() public view returns (uint) {
        if (totalShare == 0) return 1 ether;
        uint decimals = token.decimals();

        return totalShare * decimals / totalStake;
    }

    function getInterest() public view returns (uint) {
        return interest;
    }

    function getInterestRate() public view returns (uint) {
        return interestRate;
    }

    // INTERNAL METHODS

    function _calculateShare(uint tokenAmount) private view returns (uint) {
        uint sharePrice = getSharePrice();
        uint decimals = token.decimals();

        return tokenAmount * sharePrice / decimals;
    }

    function _calculateToken(uint shareAmount) private view returns (uint) {
        uint sharePrice = getSharePrice();
        uint decimals = token.decimals();

        return shareAmount * decimals / sharePrice;
    }

    function _increaseStake() internal {
        // Function call onBlock() must not be reverted
        if (!active) return;
        uint amount = totalStake * interest / MILLION;
        bank.withdrawErc20(address(token), address(this), amount);
        totalStake += amount;
        emit StakeChanged(address(this), amount);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
