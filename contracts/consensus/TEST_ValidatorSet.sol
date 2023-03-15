/*
Copyright: Ambrosus Inc.
Email: tech@ambrosus.io

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

This Source Code Form is “Incompatible With Secondary Licenses”, as defined by the Mozilla Public License, v. 2.0.
*/
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;


import "hardhat/console.sol";
import "./ValidatorSet.sol";


contract TEST_ValidatorSet is ValidatorSet {

    constructor(
        address _multisig,
        address _rewardOracle,

        uint _baseReward,
        uint _topStakesCount
    ) ValidatorSet(_multisig, _rewardOracle, _baseReward, _topStakesCount) {}


    function lowestStakeIndex() public view returns (uint) {
        return _lowestStakeIndex;
    }

    function highestStakeIndex() public view returns (uint) {
        return _highestStakeIndex;
    }

    function compareStakesA(address a, address b) public view returns (int) {
        return _compareStakesA(a, b);
    }

    function compareStakes(Stake memory a, Stake memory b) public pure returns (int) {
        return _compareStakes(a, b);
    }

}
