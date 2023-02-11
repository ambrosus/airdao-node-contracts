// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IStaking {
    function reward(address nodeAddress, uint amount) external;
    function report(address nodeAddress) external;
    function validatorStatusChanged(address nodeAddress, bool nowValidator) external;

}
