//_ SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./TokenPool.sol";
import "../../funds/RewardsBank.sol";

contract TokenPoolsManager is AccessControl{
    RewardsBank public bank;
    UpgradeableBeacon public beacon;

    mapping(string => address) public pools;

    constructor(RewardsBank bank_, UpgradeableBeacon beacon_) {
        bank = bank_;
        beacon = beacon_;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event PoolCreated(string name, address pool);
    event PoolDeactivated(string name);
    event PoolActivated(string name);

    // OWNER METHODS

    function createPool(
        string memory name, address token_, uint interest_, uint interestRate_,
        uint minStakeValue_, address rewardToken_, uint rewardTokenPrice_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(string,address,address,uint256,uint256,uint256,address,uint256)",
                        name, token_, bank, interest_, interestRate_, minStakeValue_, rewardToken_, rewardTokenPrice_);
        address pool = address(new BeaconProxy(address(beacon), data));
        pools[name] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(name, pool);
        return pool;
    }

    function deactivatePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.deactivate();
        emit PoolDeactivated(_pool);
    }

    function activatePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.activate();
        emit PoolActivated(_pool);
    }

    // VIEW METHODS

    function getPoolAddress(string memory name) public view returns (address) {
        return pools[name];
    }

}
