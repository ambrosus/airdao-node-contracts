//SPDX-License-Identifier: UNCLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./StAMB.sol";

contract StakingTiers is AccessControlUpgradeable, UUPSUpgradeable {

    StAMB public stAmb;
    uint256[50] __gap;
    mapping (address => uint) public bonuses;

    event BonusSet(address indexed user, uint bonus);

    function initialize(StAMB stAmb_) public initializer {
        stAmb = stAmb_;
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    function isTierAllowed(address user, uint desiredTier) external returns (bool) {
        return calculateTier(user) >= desiredTier;
    }

    function calculateTier(address user) public view returns (uint) {
        uint liquidStakingTime;
        uint obtainedAt = stAmb.obtainedAt(user);
        if (obtainedAt != 0)
            liquidStakingTime = block.timestamp - obtainedAt;
        uint liquidPercent = liquidStakingTime * 75 / (3 * 365  days);

        uint nativePercent = 25 + liquidPercent + bonuses[user];
        if (nativePercent > 100) nativePercent = 100;

        return nativePercent;
    }

    function setBonus(address user, uint bonus) public onlyRole(DEFAULT_ADMIN_ROLE){
        bonuses[user] = bonus;
        emit BonusSet(user, bonus);
    }

    function setBonusBatch(address[] memory users, uint[] memory bonuses_) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(users.length == bonuses_.length, "Arrays length mismatch");
        for (uint i = 0; i < users.length; i++) {
            bonuses[users[i]] = bonuses_[i];
            emit BonusSet(users[i], bonuses_[i]);
        }
    }



    function _authorizeUpgrade(address newImplementation) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

}

