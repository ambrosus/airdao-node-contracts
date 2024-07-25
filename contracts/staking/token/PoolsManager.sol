//_ SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./TokenPool.sol";
import "./IPoolsManager.sol";
import "../../funds/RewardsBank.sol";

contract PoolsManager is UUPSUpgradeable, AccessControlUpgradeable, IPoolsManager {
    RewardsBank public bank;
    UpgradeableBeacon public beacon;

    mapping(string => address) public pools;

    function initialize(RewardsBank bank_, UpgradeableBeacon beacon_) public initializer {
        bank = bank_;
        beacon = beacon_;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // OWNER METHODS

    function createPool(
        string memory name, address token_, uint interest_, uint interestRate_,
        uint minStakeValue_, address rewardToken_, uint rewardTokenPrice_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) returns (address) {
        bytes memory data = abi.encodeWithSignature(
            "initialize(string,address,address,uint,uint,uint,address,uint",
                        token_, interest_, interestRate_, minStakeValue_, rewardToken_, rewardTokenPrice_);
        address pool = address(new BeaconProxy(address(beacon), data));
        pools[name] = pool;
        bank.grantRole(bank.DEFAULT_ADMIN_ROLE(), address(pool));
        emit PoolCreated(name, token_);
        return address(pool);
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

    // INTERNAL METHODS

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    // VIEW METHODS

    function getPoolAddress(string memory name) public view returns (address) {
        return pools[name];
    }

}
