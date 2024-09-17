//_ SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./TokenPool.sol";
import "./DepositedTokenPool.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

import "hardhat/console.sol";

contract TokenPoolsManager is AccessControl{
    LockKeeper lockKeeper;
    RewardsBank public bank;
    UpgradeableBeacon public tokenPoolBeacon;
    UpgradeableBeacon public depositedTokenPoolBeacon;

    mapping(string => address) public pools;
    mapping(string => address) public doubleSidePools;

    constructor(RewardsBank bank_, LockKeeper lockKeeper_, UpgradeableBeacon singleSideBeacon_, UpgradeableBeacon doubleSideBeacon_) {
        lockKeeper = lockKeeper_;
        bank = bank_;
        tokenPoolBeacon = singleSideBeacon_;
        depositedTokenPoolBeacon = doubleSideBeacon_;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event PoolCreated(string name, address pool);
    event PoolDeactivated(string name);
    event PoolActivated(string name);
    event DepositedPoolCreated(string name, address pool);
    event DepositedPoolDeactivated(string name);
    event DepositedPoolActivated(string name);

    // OWNER METHODS

    function createTokenPool(TokenPool.Config calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        console.log("Entered createPool");
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,(address,string,address,uint256,uint256,uint256,uint256,uint256,uint256))",
            bank, lockKeeper, params);
        address pool = address(new BeaconProxy(address(tokenPoolBeacon), data));
        console.log("Pool created at address: %s", pool);
        pools[params.name] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(params.name, pool);
        return pool;
    }

    function deactivateTokenPool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        TokenPool pool = TokenPool(pools[_pool]);
        pool.deactivate();
        emit PoolDeactivated(_pool);
    }

    function activateTokenPool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        
        TokenPool pool = TokenPool(pools[_pool]);
        pool.activate();
        emit PoolActivated(_pool);
    }

    function createDeposistedTokenPool(string calldata name_, DepositedTokenPool.Config calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        console.log("Entered createDoubleSidePool");
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,(string,address,uint256,address,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))",
            bank, lockKeeper, params);
        address pool = address(new BeaconProxy(address(depositedTokenPoolBeacon), data));
        console.log("DoubleSidePool created at address: %s", pool);
        doubleSidePools[name_] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit DepositedPoolCreated(name_, pool);
        return pool;
    }

    function deactivateDoubleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(doubleSidePools[_pool] != address(0), "Pool does not exist");
        DepositedTokenPool pool = DepositedTokenPool(doubleSidePools[_pool]);
        pool.deactivate();
        emit DepositedPoolDeactivated(_pool);
    }

    function activateDoubleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(doubleSidePools[_pool] != address(0), "Pool does not exist");
        DepositedTokenPool pool = DepositedTokenPool(doubleSidePools[_pool]);
        pool.activate();
        emit DepositedPoolActivated(_pool);
    }

    // VIEW METHODS

    function getPoolAddress(string memory name) public view returns (address) {
        return pools[name];
    }

    function getDepositedPoolAdress(string memory name) public view returns (address) {
        return doubleSidePools[name];
    }

}
