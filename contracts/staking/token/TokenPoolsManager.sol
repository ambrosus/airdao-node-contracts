//_ SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./TokenPool.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

contract TokenPoolsManager is AccessControl, IOnBlockListener {
    LockKeeper lockKeeper;
    RewardsBank public bank;
    UpgradeableBeacon public beacon;

    address[] public pools;

    constructor(RewardsBank bank_, LockKeeper lockKeeper_, UpgradeableBeacon _beacon) {
        lockKeeper = lockKeeper_;
        bank = bank_;
        beacon = _beacon;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event PoolCreated(address pool, string name);
    event PoolConfigured(address pool, TokenPool.LimitsConfig params);
    event PoolDeactivated(address pool);
    event PoolActivated(address pool);

    // OWNER METHODS
    // TOKEN POOL METHODS
    function createPool(TokenPool.MainConfig calldata mainConfig, TokenPool.LimitsConfig calldata limitsConfig) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,(address,string,address),(uint256,uint256,uint256,uint256,uint256,uint256))",
            bank, lockKeeper, mainConfig, limitsConfig);
        address pool = address(new BeaconProxy(address(beacon), data));
        pools.push(pool);
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(pool, mainConfig.name);
        return pool;
    }

    function configurePool(address pool, TokenPool.LimitsConfig calldata limitsConfig) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isPool(pool), "Pool does not exist");
        TokenPool(payable(pool)).setLimitsConfig(limitsConfig);
        emit PoolConfigured(pool, limitsConfig);
    }

    function deactivateTokenPool(address _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isPool(_pool), "Pool does not exist");
        TokenPool pool = TokenPool(payable(_pool));
        pool.deactivate();
        emit PoolDeactivated(_pool);
    }

    function activateTokenPool(address _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_isPool(_pool), "Pool does not exist");
        TokenPool pool = TokenPool(payable(_pool));
        pool.activate();
        emit PoolActivated(_pool);
    }

    function onBlock() external {
        for (uint i = 0; i < pools.length; i++) {
            TokenPool(payable(pools[i])).onBlock();
        }
    }

    // INTERNAL METHODS

    function _isPool(address pool) internal view returns (bool) {
        for (uint i = 0; i < pools.length; i++) {
            if (pools[i] == pool) {
                return true;
            }
        }
        return false;
    }


}
