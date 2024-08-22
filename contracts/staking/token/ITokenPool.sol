//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ITokenPool {
    //OWNER METHODS
    function activate() external;
    function deactivate() external;

    //PUBLIC METHODS
    function stake(uint amount) external;
    function unstake(uint amount) external;

    //VIEW METHODS
    function getStake(address user) external view returns (uint);

    //EVENTS
    event StakeChanged(address indexed user, uint amount);
    event MinStakeValueChanged(uint minStakeValue);
    event InterestAdded(uint amount);
    event InterestRateChanged(uint interest, uint interestRate);
    event LockPeriodChanged(uint period);
    event RewardTokenPriceChanged(uint price);
    event FastUnstakePenaltyChanged(uint penalty);
    event RewardClaimed(address indexed user, uint amount);
    event Deactivated();
    event Activated();
}
