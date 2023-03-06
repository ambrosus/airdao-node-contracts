// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract OnDemandRevert {
    constructor(){}

    function func(bool revert) public payable {
        require(!revert, "Revert!");
    }
}
