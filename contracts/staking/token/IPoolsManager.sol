//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IPoolsManager {

    //OWNER METHODS
    function createPool(
        string memory name, address _token, uint _interest,
        uint _interestRate, uint _minStakeValue, address _rewardToken, uint _rewardTokenPrice
    ) external returns (address);
    function deactivatePool(string memory _pool) external;
    function activatePool(string memory _pool) external;
    function setInterest(string memory _pool, uint _interest) external;
    function setMinStakeValue(string memory _pool, uint _minStakeValue) external;
    function setInterestRate(string memory _pool, uint _interestRate) external;

    //VIEW METHODS
    function getPoolAddress(string memory _pool) external view returns (address);

    //EVENTS

    event PoolCreated(string indexed name, address indexed token);
    event PoolDeactivated(string indexed name);
    event PoolActivated(string indexed name);
    event InterestChanged(string indexed name, uint interest);
    event InterestRateChanged(string indexed name, uint interestRate);
    event MinStakeValueChanged(string indexed name, uint minStakeValue);

}
