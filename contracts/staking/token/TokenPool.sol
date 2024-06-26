//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "./ShareToken.sol";
import "./ITokenPool.sol";
import "../../funds/RewardsBank.sol";

contract TokenPool is AccessControl, ITokenPool {
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");

    uint constant public MILLION = 1_000_000;
    
    ERC20 public token;
    ShareToken public share;
    RewardsBank public bank;
    uint public interest;
    uint public minStakeValue;
    uint public totalStake;
    bool public active;

    constructor(address _token, RewardsBank _rewardsBank, uint _intereset, uint _minStakeValue ) {
        token = ERC20(_token);
        share = new ShareToken();
        bank = _rewardsBank;
        interest = _intereset; 
        minStakeValue = _minStakeValue;
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

    function setInterest(uint _interest) public onlyRole(DEFAULT_ADMIN_ROLE) {
        interest = _interest;
        emit InterestChanged(_interest);
    }

    function setMinStakeValue(uint _minStakeValue) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minStakeValue = _minStakeValue;
        emit MinStakeValueChanged(_minStakeValue);
    }

    // PUBLIC METHODS

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= minStakeValue, "Amount is less than minStakeValue");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint shareAmount = _calculateShare(amount);

        share.mint(msg.sender, shareAmount);
        totalStake += amount;
        emit StakeChanged(msg.sender, amount);
    }

    function unstake(uint amount) public {
        require(active, "Pool is not active");
        require(share.balanceOf(msg.sender) >= amount, "Not enough stake");

        uint tokenAmount = _calculateToken(amount);
        require(tokenAmount <= totalStake, "Amount is more than total stake");

        share.burn(msg.sender, amount);
        totalStake -= tokenAmount;
        require(token.transfer(msg.sender, tokenAmount), "Transfer failed");
        emit StakeChanged(msg.sender, tokenAmount);
    }

    // BACKEND METHODS

    function increaseStake() public onlyRole(BACKEND_ROLE) {
        require(active, "Pool is not active");
        uint amount = totalStake * interest / MILLION;
        bank.withdrawErc20(address(token), address(this), amount);
        emit StakeChanged(address(this), amount);
    }

    // VIEW METHODS

    function getStake(address user) public view returns (uint) {
        return _calculateToken(share.balanceOf(user));
    }

    function getSharePrice() public view returns (uint) {
        uint _totalShare = share.totalSupply();
        if (_totalShare == 0) return 1 ether;
        uint decimals = token.decimals();

        return _totalShare * decimals / totalStake;
    }

    function totalShare() public view returns (uint) {
        return share.totalSupply();
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

}
