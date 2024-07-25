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

    //VIEW METHODS
    function getPoolAddress(string memory _pool) external view returns (address);

    //EVENTS

    event PoolCreated(string indexed name, address indexed token);
    event PoolDeactivated(string indexed name);
    event PoolActivated(string indexed name);
}
