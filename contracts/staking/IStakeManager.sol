// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IStakeManager {
    function reward(address nodeAddress, uint amount) external;
    function report(address nodeAddress) external;
}
