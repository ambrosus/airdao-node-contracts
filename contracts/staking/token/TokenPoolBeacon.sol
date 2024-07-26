//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract TokenPoolBeacon is UpgradeableBeacon {
    constructor(address _implementation) UpgradeableBeacon(_implementation) {}
}


