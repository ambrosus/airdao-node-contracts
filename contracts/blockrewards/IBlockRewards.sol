// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// From: https://wiki.parity.io/Block-Reward-Contract
abstract contract IBlockRewards {
    // produce rewards for the given benefactors, with corresponding reward codes.
    // only callable by `SUPER_USER`
    function reward(address[] calldata benefactors, uint16[] calldata kind) external virtual returns (address[] memory, uint256[] memory);
}
