// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./LimitedTokenPool.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

contract LimitedTokenPoolsManager is AccessControl, IOnBlockListener {
    LockKeeper lockKeeper;
    RewardsBank public bank;
    UpgradeableBeacon public limitedTokenPoolBeacon;

    address[] public pools;
    
    constructor(RewardsBank bank_, LockKeeper lockKeeper_, UpgradeableBeacon doubleSideBeacon_)  {
        lockKeeper = lockKeeper_;
        bank = bank_;
        limitedTokenPoolBeacon = doubleSideBeacon_;
    }

    event LimitedPoolCreated(address pool);
    event LimitedPoolConfigured(address pool, LimitedTokenPool.LimitsConfig params);
    event LimitedPoolDeactivated(address pool);
    event LimitedPoolActivated(address pool);

    // LIMITED POOL METHODS
    function createPool(LimitedTokenPool.MainConfig calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,(string,address,address,address))",
            bank, lockKeeper, params);
        address pool = address(new BeaconProxy(address(limitedTokenPoolBeacon), data));
        pools.push(pool);
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit LimitedPoolCreated(pool);
        return pool;
    }

    function configurePool(address _pool, LimitedTokenPool.LimitsConfig calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isPool(_pool),"Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(payable(_pool));
        pool.setLimitsConfig(params);
        emit LimitedPoolConfigured(_pool, params);
    }

    function deactivatePool(address _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isPool(_pool),"Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(payable(_pool));
        pool.deactivate();
        emit LimitedPoolDeactivated(_pool);
    }

    function activatePool(address _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isPool(_pool),"Pool does not exist");
        LimitedTokenPool pool = LimitedTokenPool(payable(_pool));
        pool.activate();
        emit LimitedPoolActivated(_pool);
    }

    function onBlock() external {
        for (uint i = 0; i < pools.length; i++) {
            LimitedTokenPool pool = LimitedTokenPool(payable(pools[i]));
            pool.onBlock();
        }
    }

    function _isPool(address pool) internal view returns (bool) {
        for (uint i = 0; i < pools.length; i++) {
            if (pools[i] == pool) {
                return true;
            }
        }
        return false;
    }

}

