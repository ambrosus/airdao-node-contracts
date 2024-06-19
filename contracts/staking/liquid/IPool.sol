// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IPool {
    function activate() external payable;
    function deactivate(uint maxNodes) external;

    function stake() external payable;
    function unstake(uint tokens) external;
    function viewStake() external view returns (uint);

    function getTokenPrice() external view returns (uint);
    function addReward() external payable;

    }
