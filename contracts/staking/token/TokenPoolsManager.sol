//_ SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./SingleSidePool.sol";
import "./DoubleSidePool.sol";
import "../../funds/RewardsBank.sol";
import "../../LockKeeper.sol";

import "hardhat/console.sol";

contract TokenPoolsManager is AccessControl{
    LockKeeper lockKeeper;
    RewardsBank public bank;
    UpgradeableBeacon public singleSideBeacon;
    UpgradeableBeacon public doubleSideBeacon;

    mapping(string => address) public pools;
    mapping(string => address) public doubleSidePools;

    constructor(RewardsBank bank_, LockKeeper lockKeeper_, UpgradeableBeacon singleSideBeacon_, UpgradeableBeacon doubleSideBeacon_) {
        lockKeeper = lockKeeper_;
        bank = bank_;
        singleSideBeacon = singleSideBeacon_;
        doubleSideBeacon = doubleSideBeacon_;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    event PoolCreated(string name, address pool);
    event PoolDeactivated(string name);
    event PoolActivated(string name);
    event DoubleSidePoolCreate(string name, address pool);
    event DoubleSidePoolDeactivated(string name);
    event DoubleSidePoolActivated(string name);
    event DependentSideAdded(string name, address pool);

    // OWNER METHODS

    function createSingleSidePool(SingleSidePool.Config calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        console.log("Entered createPool");
        bytes memory data = abi.encodeWithSignature(
            "initialize((address,address,address,string,address,uint256,uint256,uint256,uint256,uint256,uint256))",
            params);
        address pool = address(new BeaconProxy(address(singleSideBeacon), data));
        console.log("Pool created at address: %s", pool);
        pools[params.name] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(params.name, pool);
        return pool;
    }

    function deactivateSingleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        SingleSidePool pool = SingleSidePool(pools[_pool]);
        pool.deactivate();
        emit PoolDeactivated(_pool);
    }

    function activateSingleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(pools[_pool] != address(0), "Pool does not exist");
        
        SingleSidePool pool = SingleSidePool(pools[_pool]);
        pool.activate();
        emit PoolActivated(_pool);
    }

    function createDoubleSidePool(string calldata name_, DoubleSidePool.MainSideConfig calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(address,address,string,(address,address,uint,uint,uint,uint,uint,uint,uint))",
            bank, lockKeeper, name_, params);
        address pool = address(new BeaconProxy(address(doubleSideBeacon), data));
        doubleSidePools[name_] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit DoubleSidePoolCreate(name_, pool);
        return pool;
    }

    function addDependentSide(string calldata name_, DoubleSidePool.DependantSideConfig calldata params) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(doubleSidePools[name_] != address(0), "Pool does not exist");
        DoubleSidePool pool = DoubleSidePool(doubleSidePools[name_]);
        pool.addDependentSide(params);
        emit DependentSideAdded(name_, address(pool));
    }

    function deactivateDoubleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(doubleSidePools[_pool] != address(0), "Pool does not exist");
        DoubleSidePool pool = DoubleSidePool(doubleSidePools[_pool]);
        pool.deactivate();
        emit DoubleSidePoolDeactivated(_pool);
    }

    function activateDoubleSidePool(string memory _pool) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(doubleSidePools[_pool] != address(0), "Pool does not exist");
        DoubleSidePool pool = DoubleSidePool(doubleSidePools[_pool]);
        pool.activate();
        emit DoubleSidePoolActivated(_pool);
    }

    // VIEW METHODS

    function getPoolAddress(string memory name) public view returns (address) {
        return pools[name];
    }

    function getDoubleSidePoolAddress(string memory name) public view returns (address) {
        return doubleSidePools[name];
    }

}
