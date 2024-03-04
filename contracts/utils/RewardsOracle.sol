// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IValidatorSet {
    function setReward(uint _baseReward) external;
}

contract RewardsOracle is AccessControl {
    bytes32 public constant REWARD_ORACLE_ROLE = keccak256("REWARD_ORACLE_ROLE");  // can provide baseReward

    IValidatorSet public validatorSet;

    uint64[5] internal _baseRewardSettings; // settings for base reward oracle:  [0] - isEnabled
    // [1] - min %, [2] - max %   (bips),
    // [3] - min reward, [4] - max reward   (bips of amb)


    event RewardSettingsChanged(uint64[5] newSettings);

    constructor(address _validatorSet){
        validatorSet = IValidatorSet(_validatorSet);
        _baseRewardSettings = [1, 16.6 * 10000, 100 * 10000, 14 * 10000, 60.8 * 10000]; // default settings: enabled, 16.6% = 14 amb, 100% = 60.8 amb
    }

    function setReward(uint _baseReward) public onlyRole(REWARD_ORACLE_ROLE) {
        validatorSet.setReward(_baseReward);
    }

    function getRewardSettings() public view returns (uint64[5] memory){
        return _baseRewardSettings;
    }

    function setRewardSettings(uint64[5] memory newSettings) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseRewardSettings = newSettings;
    }

}
