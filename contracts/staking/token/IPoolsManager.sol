//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IPoolsMsanager {
    //OWNER METHODS
    function createPool(address token_, uint interest_, uint minStakeValue) external returns (address);
    function deactivatePool(address pool_) external;
    function activatePool(address pool_) external;
    function setInterest(address pool_, uint interest_) external;
    function setMinStakeValue(address pool_, uint minStakeValue_) external;

    //VIEW METHODS
    function getPool(address token_) external view returns (address);
    function getPoolInfo(address pool_) external view returns (address token, uint interest, uint minStakeValue, uint totalStake, uint totalShare, bool active);

    //EVENTS

    event PoolCreated(address pool, address token, uint interest, uint minStakeValue);
    event PoolDeactivated(address pool);
    event PoolActivated(address pool);
    event InterestChanged(address pool, uint interest);
    event MinStakeValueChanged(address pool, uint minStakeValue);


}
