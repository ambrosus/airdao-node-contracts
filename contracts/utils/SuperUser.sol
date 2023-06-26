// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract SuperUser {

    // node set tx difficulty to this value when contract is called by super user
    uint256 constant MAGIC_DIFFICULTY = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    function isCalledBySuperUser() public view returns (bool) {
        return block.coinbase == address(0);
    }

    // TODO USE THIS ON PRODUCTION
//    function isCalledBySuperUser() public view returns (bool) {
//        return block.difficulty == MAGIC_DIFFICULTY;
//    }

    modifier onlySuperUser(){
        require(isCalledBySuperUser(), "only super user can call this function");
        _;
    }

}
