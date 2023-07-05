// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IValidatorSet {
    function newStake(address nodeAddress, uint amount, bool isAlwaysTop) external;
    function stake(address nodeAddress, uint amount) external;
    function unstake(address nodeAddress, uint amount) external;
    function getNodeStake(address nodeAddress) external view returns (uint);
//    function setAlwaysValidator(address nodeAddress, bool alwaysValidator) external;
}
