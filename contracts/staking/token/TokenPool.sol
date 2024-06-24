//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./ShareToken.sol";
import "../../funds/RewardsBank.sol";

// This contract should 
// - Accept sertain ERC20 token 
// - Keep track of the balance of the token
// - Calculate the share of the token for each user
// - Able to increase the stake from the bank contract by the special call from the server
// - Allow users to withdraw their token with interest

contract TokenPool is AccessControl {
    bytes32 constant public BACKEND_ROLE = keccak256("BACKEND_ROLE");

    uint constant public MILLION = 1_000_000;
    //TODO: Get decimals from the token contract
    uint constant public FIXED_POINT = 1e18;
    //TODO: Add SafeMath???
    
    uint public id;
    IERC20 public token;
    ShareToken public share;
    uint public intereset;
    uint public minStakeValue;
    uint public totalStake;
    bool public active;
    RewardsBank public bank;

    constructor(uint _id, address _token, uint _intereset, uint _minStakeValue, RewardsBank _rewardsBank) {
        id = _id;
        token = IERC20(_token);
        share = new ShareToken();
        intereset = _intereset; 
        minStakeValue = _minStakeValue;
        active = true;
        bank = _rewardsBank;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event StakeChanched(address indexed user, uint amount);

    function activate() public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!active, "Pool is already active");
        active = true;
    }

    function deactivate() public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(active, "Pool is not active");
        active = false;
    }

    function stake(uint amount) public {
        require(active, "Pool is not active");
        require(amount >= minStakeValue, "Amount is less than minStakeValue");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint shareAmount = calculateShare(amount);

        share.mint(msg.sender, shareAmount);
        totalStake += amount;
        emit Stake(msg.sender, amount);
    }

    function unstake() public {}

    function increaseStake() public onlyRole(BACKEND_ROLE) {
        require(active, "Pool is not active");
        uint amount = totalStake * intereset / MILLION;
        bank.transfer(
    }

    function getSharePrice() public view returns (uint) {
        uint totalShare = share.totalSupply();
        if (totalShare == 0) return 1 ether;

        return totalShare * FIXED_POINT / totalStake;
    }

    function calculateShare(uint tokenAmount) private view returns (uint) {
        uint sharePrice = getSharePrice();
        return tokenAmount * sharePrice / FIXED_POINT;
    }

    function calculateToken(uint shareAmount) private view returns (uint) {
        uint sharePrice = getSharePrice();
        return shareAmount * FIXED_POINT / sharePrice;
    }

}
