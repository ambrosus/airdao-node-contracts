//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract StakingTiers is AccessControlUpgradeable, UUPSUpgradeable {
    mapping (address => uint) public tiers;

    function initialize(address[] memory addresses_, uint[] memory tiers_) public initializer {
        require(addresses_.length == tiers_.length, "Addresses and tiers arrays have different length");

        for (uint i = 0; i < addresses_.length; i++) {
            tiers[addresses_[i]] = tiers_[i];
        }
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function getTier(address user) public view returns (uint) {
        return tiers[user];
    }

    function setTier(address user, uint tier) public onlyRole(DEFAULT_ADMIN_ROLE){
        tiers[user] = tier;
    }

}

