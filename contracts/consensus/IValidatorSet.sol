// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IValidatorSet {
    function addStake(address nodeAddress, uint amount) external;
    function removeStake(address nodeAddress, uint amount) external;
    function getNodeStake(address nodeAddress) external view returns (uint);
//    function setAlwaysValidator(address nodeAddress, bool alwaysValidator) external;
}
