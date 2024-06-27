//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface ITokenPool {
    //OWNER METHODS
    function activate() external;
    function deactivate() external;
    function setInterest(uint _interest) external;
    function setMinStakeValue(uint _minStakeValue) external;

    //BACKEND METHODS
    function increaseStake() external;

    //PUBLIC METHODS
    function stake(uint amount) external;
    function unstake(uint amount) external;

    //VIEW METHODS
    function getStake(address user) external view returns (uint);
    function getSharePrice() external view returns (uint);
    function totalShare() external view returns (uint);

    //EVENTS
    event StakeChanged(address indexed user, uint amount);
    event InterestChanged(uint interest);
    event InterestRateChanged(uint interestRate);
    event MinStakeValueChanged(uint minStakeValue);
    event Deactivated();
    event Activated();


}
