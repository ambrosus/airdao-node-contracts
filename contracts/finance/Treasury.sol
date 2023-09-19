// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./Finance.sol";


contract Treasury is Finance {

    uint public fee;  // in base points (1/10000)

    constructor(address owner, uint _fee) Finance(owner) {
        require(_fee <= 10000, "fee is too big");
        fee = _fee;
    }

    function setFee(uint _fee) public onlyOwner {
        require(_fee <= 10000, "fee is too big");
        fee = _fee;
    }

    function calcFee(uint amount) public view returns (uint) {
        return amount * fee / 10000;
    }


    // receive and withdraw functions are in Finance contract
}
