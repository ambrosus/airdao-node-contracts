// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./OnBlockNotifier.sol";

contract TEST_BlockListener is IOnBlockListener {
    bool public blockProcessed;

    function onBlock() external override {
        blockProcessed = true;
    }
}
